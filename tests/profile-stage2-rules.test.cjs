const {before,after,test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing'),sdk=require('firebase/firestore'),{doc,setDoc,getDoc,updateDoc,deleteDoc,Timestamp,serverTimestamp,runTransaction,query,collection,where,getCountFromServer}=sdk;
const R=require('../profile-records.js'),P=require('../profile-progress.js');let env,seq=10000;const today=P.dayIndex(Date.now()),keys={today:P.dayLabel(today),week:'2026-W44',month:'2026-10'};
const db=uid=>env.authenticatedContext(uid,{firebase:{sign_in_provider:'google.com'}}).firestore();
const input=(time=20.01)=>({solveId:'12345678-1234-1234-1234-'+String(++seq).padStart(12,'0'),source:'normal',mode:'virtual',rankingEligible:true,time,scramble:'R U F2',tps:3,moveCount:60,moves:['R','U'],ao5:null,ao12:null});
async function user(uid,provider='google'){await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users',uid),{uid,name:'Tester',rating:1200,loginType:provider}));return db(uid);}
const detail=async(uid)=>(await getDoc(doc(db(uid),'users',uid,'profileStats','details'))).data();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-stcube-profile-stage2',firestore:{host:'127.0.0.1',port:8780,rules:fs.readFileSync('firestore.rules','utf8')}});});after(async()=>env?.cleanup());
test('normal statistics, activity and unlock dates commit atomically once; twelve rolling times are bounded',async()=>{
 const uid='stage2-normal',d=await user(uid),w=R.create(sdk,d),s=input();await w.normal(uid,'Tester',s,keys);await w.normal(uid,'Tester',s,keys);
 let a=await detail(uid);assert.equal(a.activeDays,1);assert.equal(a.currentStreak,1);assert(a.badgeTimes.firstSolve instanceof Timestamp);assert(a.badgeTimes.sub30 instanceof Timestamp);assert.equal(a.badgeTimes.sub20,null);
 const unlocked=a.badgeTimes.firstSolve.toMillis();for(let i=1;i<=12;i++)await w.normal(uid,'Tester',input(20+i),keys);
 a=await detail(uid);assert.equal(a.activeDays,1);assert.equal(a.recentTimes.length,12);assert.equal(P.average(a.recentTimes,5),30000);assert.equal(P.average(a.recentTimes,12),26500);assert.equal(a.badgeTimes.firstSolve.toMillis(),unlocked);
 assert.equal((await getDoc(doc(d,'users',uid,'profileStats','current'))).data().normalSolves,13);
});
test('two devices completing different events on the same UTC day count one activity day',async()=>{
 const uid='stage2-race';await user(uid);await Promise.all([R.create(sdk,db(uid)).normal(uid,'Tester',input(),keys),R.create(sdk,db(uid)).normal(uid,'Tester',input(),keys)]);
 const a=await detail(uid);assert.equal(a.activeDays,1);assert.equal(a.currentStreak,1);assert.equal(a.recentTimes.length,2);
});
async function seedTracking(uid,{count=99,last=today-1,streak=6}={}){
 const stamp=Timestamp.fromMillis((last*86400000)+1000),event={id:'seed-event',kind:'normal',timeMs:30000,moveCount:60,tpsMilli:2000,ao5Ms:0,ao12Ms:0};
 const stats=R.advance(null,event,stamp);stats.normalSolves=count;stats.pbMs=30000;
 const extra=P.advance(null,null,stats,event,stamp,last,false);extra.activeDays=streak;extra.currentStreak=streak;extra.longestStreak=streak;
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'users',uid),{uid,name:'Tester',rating:1200});await setDoc(doc(c.firestore(),'users',uid,'profileStats','current'),stats);await setDoc(doc(c.firestore(),'users',uid,'profileStats','details'),extra);});
}
test('100/1000 solve thresholds and 7/30 UTC streak thresholds unlock exactly; skipped days reset',async()=>{
 for(const [uid,count,streak,badge]of [['threshold100',99,6,'streak7'],['threshold1000',999,29,'streak30']]){
  await seedTracking(uid,{count,streak});await R.create(sdk,db(uid)).normal(uid,'Tester',input(9.99),keys);const a=await detail(uid);assert.equal(a.currentStreak,streak+1);assert(a.badgeTimes[badge] instanceof Timestamp);assert(a.badgeTimes[count===99?'solves100':'solves1000'] instanceof Timestamp);assert(a.badgeTimes.sub10 instanceof Timestamp);
 }
 await seedTracking('missed-day',{last:today-2,streak:12});await R.create(sdk,db('missed-day')).normal('missed-day','Tester',input(),keys);const a=await detail('missed-day');assert.equal(a.currentStreak,1);assert.equal(a.longestStreak,12);
});
test('Ranked wins unlock battle badges; Friend wins and BOT cannot unlock them',async()=>{
 for(const [uid,mode,bot]of [['ranked-badge','ranked',false],['friend-badge','friend',false],['bot-badge','ranked',true]]){
  const d=await user(uid),room=uid+'room';await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'battleRooms',room),{mode,isBot:bot,cubeMode:'virtual',round:1,hostUid:uid,guestUid:'opponent',status:'finished',winnerUid:uid,isDraw:false,maxPlayers:2});await setDoc(doc(c.firestore(),'battleRooms',room,'players',uid),{uid,round:1,status:'finished'});});
  const result=R.create(sdk,d).battle(uid,room+'_'+uid+'_1',room,1,{name:'Tester',moveCount:60,finalTime:20,tps:3,ratingChange:0});
  if(bot){await assert.rejects(result);assert.equal(await detail(uid),undefined);}else{await result;const a=await detail(uid);assert.equal(!!a.badgeTimes.firstWin,mode==='ranked');assert.equal(a.activeDays,1);}
 }
});
test('activity/statistics/badges are private and cannot be independently forged or assigned to another day',async()=>{
 const uid='secure-details',d=await user(uid);await R.create(sdk,d).normal(uid,'Tester',input(),keys);
 const ref=doc(d,'users',uid,'profileStats','details'),day=doc(d,'users',uid,'activityDays',String(today));
 await assertFails(getDoc(doc(db('intruder'),'users',uid,'profileStats','details')));await assertFails(getDoc(doc(db('intruder'),'users',uid,'activityDays',String(today))));
 for(const data of [{activeDays:999},{longestStreak:999},{'badgeTimes.wins100':serverTimestamp()},{recentTimes:[1,2,3]}])await assertFails(updateDoc(ref,data));
 await assertFails(deleteDoc(day));await assertFails(updateDoc(day,{dayIndex:today+1}));await assertFails(setDoc(doc(d,'users',uid,'activityDays',String(today+1)),{v:1,uid,dayIndex:today+1,firstEventId:'fake',createdAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(d,'users',uid),{ratingPeakObserved:99999}));await assertFails(updateDoc(doc(d,'users',uid),{normalSinglePbMs:1}));
});
test('Single PB ranks count one published profile per player, with competition ties',async()=>{
 for(const [uid,time]of [['single-fast',5],['single-tie-a',7],['single-tie-b',7]]){const d=await user(uid);await R.create(sdk,d).normal(uid,'Tester',input(time),keys);await R.create(sdk,d).normal(uid,'Tester',input(time+1),keys);}
 const count=await getCountFromServer(query(collection(db('single-tie-a'),'users'),where('normalSinglePbMs','<',7000)));assert.equal(count.data().count,1);
});
test('anonymous Guest writes private statistics and activity without Google-only privileges',async()=>{
 const uid='anonymous-profile',d=env.authenticatedContext(uid,{firebase:{sign_in_provider:'anonymous'}}).firestore();await setDoc(doc(d,'users',uid),{uid,name:'Guest',rating:1200,loginType:'guest'});await R.create(sdk,d).normal(uid,'Guest',input(),keys);
 const a=(await getDoc(doc(d,'users',uid,'profileStats','details'))).data();assert.equal(a.activeDays,1);assert(a.badgeTimes.firstSolve instanceof Timestamp);
});
test('older clients remain writable; a missed feature event resets rolling coverage instead of inventing history',async()=>{
 const uid='mixed-client',d=await user(uid),w=R.create(sdk,d);await w.normal(uid,'Tester',input(),keys);
 const s=input(),id='normal_'+s.solveId,stamp=serverTimestamp();await runTransaction(d,async tx=>{
  const ref=doc(d,'users',uid,'profileStats','current'),old=await tx.get(ref),e={v:1,id,uid,kind:'normal',createdAt:stamp,timeMs:Math.round(s.time*1000),moveCount:s.moveCount,tpsMilli:3000,ao5Ms:0,ao12Ms:0,singleId:id+'_single',ao5Id:''};
  tx.set(doc(d,'solves',id+'_single'),{schemaVersion:2,solveId:s.solveId,eventId:id,uid,name:'Tester',source:'normal',completed:true,valid:true,mode:'virtual',time:s.time,scramble:s.scramble,tps:s.tps,moveCount:s.moveCount,rankingType:'single',createdAt:stamp});tx.set(doc(d,'users',uid,'profileEvents',id),e);tx.set(ref,R.advance(old.data(),e,stamp));
 });
 await w.normal(uid,'Tester',input(),keys);const a=await detail(uid);assert.equal(a.coverageComplete,false);assert.equal(a.recentTimes.length,1);assert.equal(a.activeDays,1);
});
test('Battle rank counts experienced Google profiles only, independent of cached top lists',async()=>{
 await env.withSecurityRulesDisabled(async c=>{for(const [uid,loginType,rating,rankedBattles]of [['rank-strong','google',2500,10],['rank-tie','google',2400,2],['rank-new','google',3000,0],['rank-guest','guest',3000,10]])await setDoc(doc(c.firestore(),'users',uid),{uid,name:'Tester',loginType,rating,rankedBattles});});
 const s=await getCountFromServer(query(collection(db('rank-tie'),'users'),where('loginType','==','google'),where('rankedBattles','>',0),where('rating','>',2400)));assert.equal(s.data().count,1);
});
