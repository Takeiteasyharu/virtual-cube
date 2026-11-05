const {before,after,test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
const sdk=require('firebase/firestore');
global.HistorySync=require('../history-sync.js');
global.RankingMedals=require('../ranking-medals.js');
require('../account-migration.js');
let env;
const db=(uid,provider='google.com')=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider}}).firestore();
const writer=(uid,provider)=>global.AccountMigration.create(sdk,db(uid,provider));
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-stcube-account-merge',firestore:{host:'127.0.0.1',port:8780,rules:fs.readFileSync('firestore.rules','utf8')}});});
after(async()=>env?.cleanup());
test('both account identities must authorize a private, immutable ownership proof',async()=>{
 await writer('guest','anonymous').offer('guest','google');
 await assertFails(sdk.getDoc(sdk.doc(db('outsider'),'accountLinks','guest')));
 await assert.rejects(writer('outsider').accept('guest','outsider','Other'));
 await writer('google').accept('guest','google','Google');
 assert.equal((await writer('google').sources('google')).length,1);
 await assert.rejects(writer('guest','anonymous').offer('guest','different-google'));
 await assertFails(sdk.deleteDoc(sdk.doc(db('google'),'accountLinks','guest')));
});
const record={key:'local-fixed-record-00001',time:24,tps:2,moveCount:48,scramble:'R U F2',solvedAt:Date.UTC(2026,0,2),ao5:null};
test('local import preserves the solve date and retries/concurrent tabs do not duplicate',async()=>{
 const w=writer('google');
 const results=await Promise.all([w.importSolve('google','Google',record),w.importSolve('google','Google',record)]);
 assert.equal(results.filter(Boolean).length,1);
 const s=(await sdk.getDoc(sdk.doc(db('google'),'solves','import_'+record.key+'_single'))).data();
 assert.equal(s.solvedAt.toMillis(),record.solvedAt);
 assert.equal(s.dayKey,'2026-01-02');
 assert.equal(await w.importSolve('google','Google',record),false);
 await assert.rejects(writer('outsider').importSolve('outsider','Other',record));
});
test('linked cloud copy is restartable, preserves originals and Google rating',async()=>{
 await env.withSecurityRulesDisabled(async c=>{
  await sdk.setDoc(sdk.doc(c.firestore(),'users','google'),{uid:'google',name:'Google',rating:1555});
  await sdk.setDoc(sdk.doc(c.firestore(),'users','guest'),{uid:'guest',name:'Guest',rating:1210});
  await sdk.setDoc(sdk.doc(c.firestore(),'solves','source-guest-record'),{uid:'guest',name:'Guest',mode:'virtual',source:'normal',valid:true,rankingType:'single',time:25,tps:2,moveCount:50,scramble:'R U',createdAt:sdk.Timestamp.fromMillis(Date.UTC(2026,0,1))});
 });
 await writer('google').resume('google','Google');
 await writer('google').resume('google','Google');
 assert.equal((await sdk.getDoc(sdk.doc(db('google'),'users','google'))).data().rating,1555);
 assert.equal((await sdk.getDoc(sdk.doc(db('guest','anonymous'),'users','guest'))).data().rating,1210);
 assert((await sdk.getDoc(sdk.doc(db('google'),'solves','source-guest-record'))).exists());
 const key=await global.HistorySync.digest('linked:source-guest-record');
 assert((await sdk.getDoc(sdk.doc(db('google'),'solves','import_'+key+'_single'))).exists());
 assert.equal((await sdk.getDoc(sdk.doc(db('google'),'rankingRetirements','guest'))).data().retired,true);
});
test('a failed checkpoint can resume without another copy or a rating overwrite',async()=>{
 await writer('recovery-guest','anonymous').offer('recovery-guest','recovery-google');
 await writer('recovery-google').accept('recovery-guest','recovery-google','Recovery');
 await env.withSecurityRulesDisabled(async c=>{
  await sdk.setDoc(sdk.doc(c.firestore(),'users','recovery-google'),{uid:'recovery-google',name:'Keep Name',rating:1777});
  await sdk.setDoc(sdk.doc(c.firestore(),'solves','recovery-source'),{uid:'recovery-guest',name:'Guest',mode:'virtual',source:'normal',valid:true,rankingType:'single',time:26,tps:2,moveCount:52,scramble:'F R',createdAt:sdk.Timestamp.fromMillis(Date.UTC(2026,0,1))});
 });
 let fail=true;
 const fault={...sdk,updateDoc:async(...args)=>{if(fail){fail=false;throw Error('simulated disconnect before checkpoint');}return sdk.updateDoc(...args);}};
 await assert.rejects(global.AccountMigration.create(fault,db('recovery-google')).resume('recovery-google','Keep Name'),/simulated disconnect/);
 assert.equal((await writer('recovery-google').resume('recovery-google','Keep Name')).added,0);
 const a=(await sdk.getDoc(sdk.doc(db('recovery-google'),'users','recovery-google'))).data();
 assert.equal(a.rating,1777);assert.equal(a.name,'Keep Name');
 assert((await sdk.getDoc(sdk.doc(db('recovery-google'),'solves','recovery-source'))).exists());
});
test('award-event receipts preserve original medals and prevent duplicate transfer',async()=>{
 const award='inaugural-test-event';
 await env.withSecurityRulesDisabled(async c=>{
  const d=c.firestore();
  await sdk.setDoc(sdk.doc(d,'rankingMedals','guest'),{v:1,uid:'guest',gold:1,silver:0,bronze:0});
  await sdk.setDoc(sdk.doc(d,'rankingMedals','google'),{v:1,uid:'google',gold:2,silver:3,bronze:4,lastPeriodId:'existing'});
  await sdk.setDoc(sdk.doc(d,'rankingSpecialAwards','all-inaugural-v1'),{awards:[{uid:'guest',eventId:award,rank:1,color:'gold'}]});
  await sdk.setDoc(sdk.doc(d,'rankingSpecialAwards','all-inaugural-v1','events',award),{uid:'guest',rank:1,color:'gold'});
 });
 assert.equal((await writer('google').medals('google')).added,1);
 assert.equal((await writer('google').medals('google')).added,0);
 const target=(await sdk.getDoc(sdk.doc(db('google'),'rankingMedals','google'))).data();
 assert.deepEqual([target.gold,target.silver,target.bronze],[3,3,4]);
 assert.equal((await sdk.getDoc(sdk.doc(db('guest','anonymous'),'rankingMedals','guest'))).data().gold,1);
 await assertFails(sdk.updateDoc(sdk.doc(db('google'),'rankingMedals','google'),{gold:100}));
});
test('the live normal queue and history import share the same solve-ID exclusion',async()=>{
 const P=require('../profile-records.js'),key='normal-import-race-00001',d=db('google');
 const r={...record,key,existingSolveId:key};
 const normal={solveId:key,source:'normal',mode:'virtual',rankingEligible:true,time:r.time,tps:r.tps,moveCount:r.moveCount,scramble:r.scramble,moves:[],ao5:null,ao12:null,solvedAt:new Date(r.solvedAt).toISOString()};
 await Promise.all([P.create(sdk,d).normal('google','Google',normal,global.RankingMedals.keys(r.solvedAt)),writer('google').importSolve('google','Google',r)]);
 const docs=await Promise.all(['normal_'+key+'_single','import_'+key+'_single'].map(id=>sdk.getDoc(sdk.doc(d,'solves',id))));
 assert.equal(docs.filter(s=>s.exists()).length,1);
});
test('distinct existing award events from both accounts remain intact during concurrent medal sync',async()=>{
 await env.withSecurityRulesDisabled(async c=>{
  const d=c.firestore();
  await sdk.setDoc(sdk.doc(d,'rankingMedalPeriods','today_2026-01-01_single'),{v:1,status:'finalized',winners:[{uid:'guest'},{uid:'google'}]});
  await sdk.setDoc(sdk.doc(d,'rankingMedals','guest'),{v:1,uid:'guest',gold:2,silver:0,bronze:0});
 });
 const results=await Promise.all([writer('google').medals('google'),writer('google').medals('google')]);
 assert.equal(results.reduce((n,r)=>n+r.added,0),1);
 const total=(await sdk.getDoc(sdk.doc(db('google'),'rankingMedals','google'))).data();
 assert.deepEqual([total.gold,total.silver,total.bronze],[4,3,4]);
 assert.equal((await writer('google').medals('google')).added,0);
});
test('a disconnect after the Guest offer can be resumed only by the selected Google account',async()=>{
 await writer('offered-guest','anonymous').offer('offered-guest','offered-google');
 assert.equal((await writer('offered-google').offers('offered-google')).length,1);
 assert.equal((await writer('offered-google').sources('offered-google')).length,0);
 await assert.rejects(writer('outsider').accept('offered-guest','outsider','Other'));
 await writer('offered-google').accept('offered-guest','offered-google','Selected Google');
 assert.equal((await writer('offered-google').offers('offered-google')).length,0);
 assert.equal((await writer('offered-google').sources('offered-google')).length,1);
});
