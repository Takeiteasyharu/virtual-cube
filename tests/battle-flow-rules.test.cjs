const {before,after,test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing'),sdk=require('firebase/firestore');
const {doc,setDoc,getDoc,updateDoc,Timestamp}=sdk,F=require('../battle-flow.js');let env;
const R=require('../profile-records.js'),P=require('../profile-progress.js');
const db=uid=>env.authenticatedContext(uid).firestore();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-stcube-flow',firestore:{host:'127.0.0.1',port:8780,rules:fs.readFileSync('firestore.rules','utf8')}});});after(async()=>env?.cleanup());
async function seed(id){await env.withSecurityRulesDisabled(async c=>{
 const d=c.firestore(),stamp=Timestamp.fromMillis(Date.now()-1000);
 await setDoc(doc(d,'battleRooms',id),{...F.empty(),mode:'ranked',hostUid:'a',guestUid:'b',round:1,status:'solving',roundStartedAt:stamp,winnerUid:'',winnerName:'',isDraw:false,timeLimitReached:false,ratingUpdated:false});
 for(const uid of ['a','b'])await setDoc(doc(d,'battleRooms',id,'players',uid),{uid,name:uid,role:uid==='a'?'host':'guest',round:1,status:'solving',active:true,ready:false,inspectionStartTime:null,inspectionStartTimeMs:0,rematchReady:false,moveCount:0,currentCompletionScore:0,maxCompletionScore:0,timeLimitReached:false,finalTime:null,tps:null,updatedAt:stamp});
 });}
test('guest finalizes after host completion; certificates immutable and inboxes private',async()=>{
 const id='finish-after-host-leaves';await seed(id);
 await F.create(sdk,db('a')).finish(id,'a',{status:'finished',finalTime:30});
 let room=(await getDoc(doc(db('b'),'battleRooms',id))).data();assert.equal(room.status,'solving');
 await F.create(sdk,db('b')).finish(id,'b',{status:'finished',finalTime:20});
 room=(await getDoc(doc(db('b'),'battleRooms',id))).data();assert.equal(room.status,'finished');assert.equal(room.winnerUid,'b');
 await F.create(sdk,db('b')).finish(id,'b',{status:'finished',finalTime:10});assert.equal((await getDoc(doc(db('b'),'battleRooms',id))).data().roundResults.b.time,20);
 await assertFails(getDoc(doc(db('b'),'battleInboxes','a','rounds',id+'_1')));
 await assertFails(updateDoc(doc(db('a'),'battleRooms',id),{'roundResults.b.time':1}));
 await assertFails(updateDoc(doc(db('a'),'battleRooms',id,'players','a'),{status:'returned'}));
 assert.equal((await getDoc(doc(db('a'),'battleInboxes','a','rounds',id+'_1'))).data().state,'pending');
});
test('unexpired opponent cannot be forfeited; expired participant can be settled without host',async()=>{
 const id='expire-host';await seed(id);await F.create(sdk,db('b')).expire(id,'b','a');
 assert.equal((await getDoc(doc(db('b'),'battleRooms',id))).data().resultCount,0);
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'battleRooms',id,'players','a'),{updatedAt:Timestamp.fromMillis(Date.now()-100000)}));
 await F.create(sdk,db('b')).expire(id,'b','a');
 assert.equal((await getDoc(doc(db('b'),'battleRooms',id))).data().roundResults.a.status,'dnf');
 await assert.rejects(F.create(sdk,db('stranger')).finish(id,'stranger',{status:'finished',finalTime:10}));
});
test('an unfinished host can forfeit first and the guest can still submit a finished solve',async()=>{
 const id='unfinished-host-exit';await seed(id);await F.create(sdk,db('a')).finish(id,'a',{status:'dnf',finalTime:null});await F.create(sdk,db('b')).finish(id,'b',{status:'finished',finalTime:20});const r=(await getDoc(doc(db('b'),'battleRooms',id))).data();assert.equal(r.status,'finished');assert.equal(r.winnerUid,'b');assert.equal(r.roundResults.a.status,'dnf');
});
test('delayed private achievement projection uses original UTC day and is idempotent across devices',async()=>{
 const id='delayed-projection',uid='a',day=P.dayIndex(Date.now())-2;await seed(id);
 await env.withSecurityRulesDisabled(async c=>{
  await setDoc(doc(c.firestore(),'users',uid),{uid,name:uid,rating:1200});
  await updateDoc(doc(c.firestore(),'battleRooms',id),{finishedAt:Timestamp.fromMillis(day*86400000+2000),status:'finished',winnerUid:uid,winnerUids:[uid],isDraw:false,roundResults:{a:{status:'finished',time:20,score:0,name:uid,round:1,endedAt:Timestamp.fromMillis(day*86400000+1000)},b:{status:'dnf',time:null,score:0,name:'b',round:1,endedAt:Timestamp.fromMillis(day*86400000+2000)}}});
 });
 const details={name:uid,moveCount:60,finalTime:20,tps:3,ratingChange:0},run=()=>R.create(sdk,db(uid)).battle(uid,id+'_'+uid+'_1',id,1,details);
 await Promise.all([run(),run()]);
 const s=(await getDoc(doc(db(uid),'users',uid,'profileStats','current'))).data(),d=(await getDoc(doc(db(uid),'users',uid,'profileStats','details'))).data();
 assert.equal(s.rankedBattles,1);assert.equal(d.activeDays,1);assert.equal(d.lastDayIndex,day);assert(d.badgeTimes.firstWin instanceof Timestamp);
 await assertFails(getDoc(doc(db('b'),'users',uid,'activityCalendar','current')));
});
test('twenty-player Friend finalization respects Rules access limits and preserves every result',async()=>{
 const id='friend-twenty',uids=Array.from({length:20},(_,i)=>'f'+i),stamp=Timestamp.fromMillis(Date.now()-1000);
 await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await setDoc(doc(d,'battleRooms',id),{...F.empty(),cubeMode:'virtual',mode:'friend',maxPlayers:20,activePlayerUids:uids,hostUid:uids[0],guestUid:'',round:1,status:'solving',roundStartedAt:stamp,winnerUid:'',winnerName:'',isDraw:false,timeLimitReached:false});for(const uid of uids)await setDoc(doc(d,'battleRooms',id,'players',uid),{uid,name:uid,role:'player',round:1,status:'solving',active:true,ready:false,inspectionStartTime:null,inspectionStartTimeMs:0,rematchReady:false,moveCount:0,currentCompletionScore:0,maxCompletionScore:0,timeLimitReached:false,finalTime:null,tps:null,updatedAt:stamp});});
 for(let i=0;i<uids.length;i++)await F.create(sdk,db(uids[i])).finish(id,uids[i],{status:'finished',finalTime:20+i});
 const room=(await getDoc(doc(db(uids[19]),'battleRooms',id))).data();assert.equal(room.status,'finished');assert.equal(room.resultCount,20);assert.equal(room.winnerUid,uids[0]);assert.deepEqual(room.pendingParticipantUids,[]);
});
test('missing parent cannot authorize an orphan player write',async()=>{
 await assertFails(setDoc(doc(db('orphan'),'battleRooms','missing','players','orphan'),{uid:'orphan',role:'host',ready:false,active:false,status:'joined',inspectionStartTime:null,inspectionStartTimeMs:0,round:1,rematchReady:false,moveCount:0,currentCompletionScore:0,maxCompletionScore:0,timeLimitReached:false,finalTime:null,tps:null}));
 await assertFails(setDoc(doc(db('forger'),'battleRooms','forged-past-round'),{...F.empty(),hostUid:'forger',guestUid:'',round:1,status:'finished',finishedAt:Timestamp.fromMillis(1),winnerUid:'forger',winnerName:'Forged'}));
});
test('host and guest racing the actual Elo writer update both profiles exactly once',async()=>{
 const id='elo-race';await seed(id);await env.withSecurityRulesDisabled(async c=>{for(const uid of ['a','b'])await setDoc(doc(c.firestore(),'users',uid),{uid,name:uid,rating:1200,wins:0,losses:0,rankedBattles:0,rankedWins:0,rankedLosses:0,rankedDraws:0});});
 await F.create(sdk,db('a')).finish(id,'a',{status:'finished',finalTime:20});await F.create(sdk,db('b')).finish(id,'b',{status:'dnf',finalTime:null});
 await assertFails(updateDoc(doc(db('b'),'battleRooms',id),{ratingUpdated:true,ratingApplied:true,ratingChanges:{a:{before:1200,after:1216},b:{before:1200,after:1184}}}));
 const source=fs.readFileSync('online.js','utf8');
 async function execute(uid){const errors=[],context={...sdk,db:db(uid),window:{ProfileRecords:R},currentUser:{uid},activeRoomId:id,activeRoom:{mode:'ranked',flowVersion:3,round:1,ratingUpdated:false},activeRoomRole:uid==='a'?'host':'guest',activeRound:1,ratingUpdateInProgress:false,USERS_COLLECTION:'users',BATTLE_ROOMS_COLLECTION:'battleRooms',INITIAL_RATING:1200,ELO_K_FACTOR:32,refreshBattleRatingRanking:async()=>{},refreshBattleAccountRating:async()=>{},profileModal:{hidden:true},battleNotice:{textContent:''},console:{log(){},error(...a){errors.push(a)}}};
  const fn=new Function(...Object.keys(context),source.slice(source.indexOf('function defaultUserStats()'),source.indexOf('async function ensureUserProfile()'))+source.slice(source.indexOf('async function applyRankedBattleResultAsHost('),source.indexOf('function renderBattleLocalTimer('))+'return applyRankedBattleResultAsHost();');await fn(...Object.values(context));assert.deepEqual(errors,[]);
 }
 await Promise.all([execute('a'),execute('b')]);await Promise.all([execute('a'),execute('b')]);
 const a=(await getDoc(doc(db('a'),'users','a'))).data(),b=(await getDoc(doc(db('b'),'users','b'))).data();assert.equal(a.rankedBattles,1);assert.equal(b.rankedBattles,1);assert.equal(a.rating,1216);assert.equal(b.rating,1184);assert.equal(b.rankedDnfs,1);assert.equal(b.rankedLosses,0);
});
test('out-of-order historical battle days join real activity intervals without moving last activity backwards',async()=>{
 const uid='historical-calendar',today=P.dayIndex(Date.now());await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users',uid),{uid,name:uid,rating:1200}));
 const writer=R.create(sdk,db(uid));await writer.normal(uid,uid,{solveId:'calendar-normal-unique',source:'normal',mode:'virtual',rankingEligible:true,time:20,moveCount:60,tps:3,scramble:'R U',moves:['R','U'],ao5:null,ao12:null},{today:P.dayLabel(today),week:'2026-W44',month:'2026-10'});
 for(const offset of[-3,-1,-2,-5]){
  const roomId='historical-calendar-'+(-offset),day=today+offset,stamp=Timestamp.fromMillis(day*86400000+1000);
  await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await setDoc(doc(d,'battleRooms',roomId),{flowVersion:3,mode:'ranked',hostUid:uid,guestUid:'opponent',round:1,status:'finished',finishedAt:stamp,winnerUid:uid,winnerUids:[uid],isDraw:false,roundResults:{[uid]:{status:'finished',time:20,score:0,name:uid,round:1,endedAt:stamp}}});await setDoc(doc(d,'battleRooms',roomId,'players',uid),{uid,round:1,status:'finished'});});
  await writer.battle(uid,roomId+'_'+uid+'_1',roomId,1,{name:uid,finalTime:20,tps:3,moveCount:60,ratingChange:0});
 }
 const d=(await getDoc(doc(db(uid),'users',uid,'profileStats','details'))).data();assert.equal(d.activeDays,5);assert.equal(d.lastDayIndex,today);assert.equal(d.currentStreak,4);assert.equal(d.longestStreak,4);
 await assertFails(updateDoc(doc(db(uid),'users',uid,'activityCalendar','current'),{current:999,longest:999}));
});
