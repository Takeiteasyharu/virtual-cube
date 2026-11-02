const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const {collection,doc,setDoc,getDocs,query,where,orderBy,limit,startAfter,writeBatch}=require('firebase/firestore');
let env;after(async()=>env?.cleanup());
test('experienced-only server pages exclude 100 unplayed profiles and retain 1200 and lower ratings without missing users',async()=>{
 env=await initializeTestEnvironment({projectId:'demo-stcube-rating-query',firestore:{host:'127.0.0.1',port:8780,rules:fs.readFileSync('firestore.rules','utf8')}});
 await env.withSecurityRulesDisabled(async c=>{const db=c.firestore(),batch=writeBatch(db);for(let i=0;i<100;i++)batch.set(doc(db,'users','fresh'+i),{loginType:'google',rating:1200,rankedBattles:0});for(let i=0;i<23;i++)batch.set(doc(db,'users','played'+i),{loginType:'google',rating:i<15?1200:1100,rankedBattles:i+1});batch.set(doc(db,'users','guest'),{loginType:'guest',rating:2000,rankedBattles:10});await batch.commit();});
 const db=env.authenticatedContext('reader').firestore(),constraints=[where('loginType','==','google'),where('rankedBattles','>',0),where('rating','>=',Number.MIN_SAFE_INTEGER),orderBy('rating','desc')];
 const first=await getDocs(query(collection(db,'users'),...constraints,limit(11)));assert.equal(first.size,11);assert(first.docs.every(d=>d.data().rating===1200));
 const all=[...first.docs];let cursor=first.docs.at(-1);while(true){const next=await getDocs(query(collection(db,'users'),...constraints,startAfter(cursor),limit(10)));all.push(...next.docs);if(next.size<10)break;cursor=next.docs.at(-1);}
 assert.equal(all.length,23);assert.equal(new Set(all.map(d=>d.id)).size,23);assert(all.every(d=>d.data().rankedBattles>0&&d.data().loginType==='google'));assert.equal(all.filter(d=>d.data().rating===1200).length,15);
 const freshConstraints=[where('loginType','==','google'),where('rankedBattles','==',0),where('rating','==',1200),orderBy(require('firebase/firestore').documentId(),'desc')];
 const peek=await getDocs(query(collection(db,'users'),...freshConstraints,limit(1)));assert.equal(peek.size,1);
 const page=await getDocs(query(collection(db,'users'),...freshConstraints,startAfter(peek.docs[0]),limit(10)));assert.equal(page.size,10);assert(page.docs.every(d=>d.data().rankedBattles===0&&d.data().rating===1200));assert(!page.docs.some(d=>d.id===peek.docs[0].id));
});
