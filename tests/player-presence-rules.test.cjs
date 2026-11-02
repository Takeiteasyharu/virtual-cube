const {before,after,test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDocs,collection,query,where,limit,orderBy,Timestamp,serverTimestamp,deleteDoc}=require('firebase/firestore');
let env;before(async()=>{env=await initializeTestEnvironment({projectId:'demo-stcube-presence',firestore:{host:'127.0.0.1',port:8780,rules:fs.readFileSync('firestore.rules','utf8')}});});after(async()=>env?.cleanup());
const db=uid=>env.authenticatedContext(uid).firestore();
const beat=(client,uid,more={})=>setDoc(doc(client,'playerPresence',uid),{v:1,lastSeen:serverTimestamp(),...more});
test('only owner, exact schema and server time; deletion denied',async()=>{
 const a=db('a');await assertSucceeds(beat(a,'a'));await assertFails(beat(a,'victim'));
 await assertFails(beat(env.unauthenticatedContext().firestore(),'anon'));await assertFails(beat(db('bad'),'bad',{secret:'x'}));
 await assertFails(beat(db('clock'),'clock',{lastSeen:Timestamp.now()}));await assertFails(deleteDoc(doc(a,'playerPresence','a')));
});
test('concurrent tabs use one UID document and rapid duplicate updates are throttled',async()=>{
 const result=await Promise.allSettled([beat(db('race'),'race'),beat(db('race'),'race')]);assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
 await assertFails(beat(db('race'),'race'));
});
test('recent bounded query excludes expired users; unauthenticated/unbounded reads denied',async()=>{
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'playerPresence/old'),{v:1,lastSeen:Timestamp.fromMillis(Date.now()-91000)});});
 const a=db('reader'),recent=query(collection(a,'playerPresence'),where('lastSeen','>',Timestamp.fromMillis(Date.now()-90000)),orderBy('lastSeen','desc'),limit(2));
 const snap=await assertSucceeds(getDocs(recent));assert(snap.size<=2);assert(!snap.docs.some(x=>x.id==='old'));
 await assertFails(getDocs(collection(a,'playerPresence')));await assertFails(getDocs(query(collection(a,'playerPresence'),limit(3))));
 await assertFails(getDocs(query(collection(env.unauthenticatedContext().firestore(),'playerPresence'),limit(2))));
});
