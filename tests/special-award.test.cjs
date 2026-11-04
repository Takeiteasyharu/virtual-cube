const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing'),sdk=require('firebase/firestore'),M=require('../tools/special-award-model.cjs');
const fixture={v:1,id:M.id,readTime:'2026-11-02T04:34:07Z',awards:M.metrics.flatMap(metric=>[1,2,3].map(rank=>({eventId:`${M.id}_${metric}_${rank}`,metric,rank,uid:'U'+rank,name:'Player '+rank,solveId:metric+rank,value:rank+10,color:M.colors[rank-1]})))};
const backup=process.env.SPECIAL_AWARD_SNAPSHOT?JSON.parse(fs.readFileSync(process.env.SPECIAL_AWARD_SNAPSHOT)):null,plan=backup?.plan||fixture;
function val(v){if('stringValue'in v)return v.stringValue;if('integerValue'in v)return +v.integerValue;if('booleanValue'in v)return v.booleanValue;if('timestampValue'in v)return sdk.Timestamp.fromDate(new Date(v.timestampValue));return null;}
let env;before(async()=>{env=await initializeTestEnvironment({projectId:'demo-stcube-special-award',firestore:{host:'127.0.0.1',port:8780,rules:fs.readFileSync('firestore.rules','utf8')}});});after(async()=>env?.cleanup());
test('fixed actual 12 awards: concurrent administrators add exactly once and preserve every existing count/name',{timeout:60000},async()=>{
 await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{
 const db=c.firestore(),uids=[...new Set(plan.awards.map(a=>a.uid))],original=new Map();
 for(const uid of uids){const raw=backup?.totals[uid],old=raw?Object.fromEntries(Object.entries(raw.fields).map(([k,v])=>[k,val(v)])):{v:1,uid,gold:backup?0:10,silver:backup?0:20,bronze:backup?0:30};original.set(uid,old);await sdk.setDoc(sdk.doc(db,'rankingMedals',uid),old);await sdk.setDoc(sdk.doc(db,'users',uid),{name:'Unchanged'});}
 await sdk.setDoc(sdk.doc(db,'rankingMedals','untouched'),{v:1,uid:'untouched',gold:99,silver:0,bronze:0});
 const result=await Promise.all([M.apply(sdk,db,plan),M.apply(sdk,db,plan),M.apply(sdk,db,plan)]);assert.equal(result.reduce((n,r)=>n+r.added,0),12);
 const events=await sdk.getDocs(sdk.collection(db,'rankingSpecialAwards',M.id,'events'));assert.equal(events.size,12);
 let added=0;for(const uid of uids){const current=(await sdk.getDoc(sdk.doc(db,'rankingMedals',uid))).data();for(const color of M.colors){const expected=plan.awards.filter(a=>a.uid===uid&&a.color===color).length;assert.equal(current[color],original.get(uid)[color]+expected);added+=expected;}assert.equal((await sdk.getDoc(sdk.doc(db,'users',uid))).data().name,'Unchanged');}
 assert.equal(added,12);assert.equal((await sdk.getDoc(sdk.doc(db,'rankingMedals','untouched'))).data().gold,99);
 const root=(await sdk.getDoc(sdk.doc(db,'rankingSpecialAwards',M.id))).data();assert.equal(root.fingerprint,M.fingerprint(plan));assert.equal(root.type,'all-inaugural');
 assert.equal((await M.apply(sdk,db,plan)).added,0);
 const changed=structuredClone(plan);changed.awards[0].name+=' changed';await assert.rejects(M.apply(sdk,db,changed),/differs/);
 console.log(JSON.stringify({actualSnapshot:!!backup,awards:12,recipients:uids.length,concurrentRuns:3,rerunAdded:0}));
 });
});
test('the production REST transaction adapter commits all events and reruns with zero writes',{timeout:60000},async()=>{
 await env.clearFirestore();const prefix='projects/demo-stcube-special-award/databases/(default)/documents';
 const base='http://127.0.0.1:8780/v1/'+prefix;
 async function call(s,body){const r=await fetch(base+s,{signal:AbortSignal.timeout(15000),method:body?'POST':'GET',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(r.status===404)return null;if(!r.ok)throw Error('Firestore '+r.status+' '+await r.text());return r.json();}
 const rest=require('../tools/special-award-rest.cjs')(call,p=>prefix+'/'+p);
 const r=await M.apply(rest,null,plan);assert.equal(r.added,12);assert.equal((await M.apply(rest,null,plan)).added,0);
 await env.withSecurityRulesDisabled(async c=>{assert.equal((await sdk.getDocs(sdk.collection(c.firestore(),'rankingSpecialAwards',M.id,'events'))).size,12);for(const uid of new Set(plan.awards.map(a=>a.uid))){const d=(await sdk.getDoc(sdk.doc(c.firestore(),'rankingMedals',uid))).data();assert.equal(d.updatedAt.constructor,sdk.Timestamp);for(const color of M.colors)assert.equal(d[color],plan.awards.filter(a=>a.uid===uid&&a.color===color).length);}});
});
test('ordinary users cannot create/change/delete special roots/events or forge increments',async()=>{
 const db=env.authenticatedContext('attacker').firestore(),root=sdk.doc(db,'rankingSpecialAwards',M.id),event=sdk.doc(db,'rankingSpecialAwards',M.id,'events','forged');
 await assertFails(sdk.setDoc(root,{status:'complete'}));await assertFails(sdk.deleteDoc(root));await assertFails(sdk.setDoc(event,{uid:'attacker',color:'gold'}));
 const uid=plan.awards[0].uid;await assertFails(sdk.updateDoc(sdk.doc(db,'rankingMedals',uid),{gold:999}));
 await assertFails(sdk.deleteDoc(sdk.doc(db,'rankingSpecialAwards',M.id,'events',plan.awards[0].eventId)));
});
test('only the single fixed award and exactly 4 x 3 distinct slots are accepted',()=>{
 assert.equal(M.validate(plan),plan);for(const mutate of [p=>p.id='another',p=>p.awards.pop(),p=>p.awards[0].color='silver',p=>p.awards[1].uid=p.awards[0].uid,p=>p.awards[0].eventId='other']){const p=structuredClone(plan);mutate(p);assert.throws(()=>M.validate(p));}
});
