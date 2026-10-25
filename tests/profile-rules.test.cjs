const {before,after,test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const sdk=require('firebase/firestore'),{doc,setDoc,getDoc,updateDoc,deleteDoc,serverTimestamp,runTransaction,writeBatch}=sdk,P=require('../profile-records.js');
let env;const uid='profile-owner',other='profile-other',id=n=>'12345678-1234-1234-1234-'+String(n).padStart(12,'0');
const input=n=>({solveId:id(n),source:'normal',mode:'virtual',rankingEligible:true,time:20.01,scramble:'R U F2',tps:3,moveCount:60,moves:['R','U'],ao5:null,ao12:null});
const keys={today:'2026-10-26',week:'2026-W44',month:'2026-10'};
const db=u=>env.authenticatedContext(u,{firebase:{sign_in_provider:'google.com'}}).firestore();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-stcube-profile',firestore:{host:'127.0.0.1',port:8780,rules:fs.readFileSync('firestore.rules','utf8')}});await env.withSecurityRulesDisabled(async c=>{for(const u of [uid,other])await setDoc(doc(c.firestore(),'users',u),{uid:u,name:'Tester',rating:1200,totalSolves:500,validSolves:500});});});
after(async()=>env?.cleanup());
test('normal Single, Ao5, legacy compatibility and tracked summary commit together once',async()=>{
 const d=db(uid),writer=P.create(sdk,d),s={...input(1),ao5:22.34,ao12:24.56};await assertSucceeds(writer.normal(uid,'Tester',s,keys));await writer.normal(uid,'Tester',s,keys);
 const stats=(await getDoc(doc(d,'users',uid,'profileStats','current'))).data();assert.equal(stats.normalSolves,1);assert.equal(stats.ao5Ms,22340);assert.equal(stats.ao12Ms,24560);assert.equal(stats.totalMoves,60);
 assert.equal((await getDoc(doc(d,'users',uid))).data().totalSolves,501);assert.equal((await getDoc(doc(d,'solves','normal_'+id(1)+'_ao5'))).data().rankingType,'ao5');
 const entry=(await getDoc(doc(d,'solves','normal_'+id(1)+'_single'))).data();assert.equal(entry.dayKey,keys.today);assert.equal(entry.weekKey,keys.week);assert.equal(entry.monthKey,keys.month);
});
test('two tabs resending the same ID count once; different simultaneous IDs both count',async()=>{
 const a=P.create(sdk,db(uid)),b=P.create(sdk,db(uid));await Promise.all([a.normal(uid,'Tester',input(2),keys),b.normal(uid,'Tester',input(2),keys)]);
 await Promise.all([a.normal(uid,'Tester',input(3),keys),b.normal(uid,'Tester',input(4),keys)]);
 assert.equal((await getDoc(doc(db(uid),'users',uid,'profileStats','current'))).data().normalSolves,4);
});
test('reject foreign reads/writes, altered summary, replayed event, event deletion and naked v2 solve',async()=>{
 const d=db(uid),o=db(other),event=doc(d,'users',uid,'profileEvents','normal_'+id(1)),data=(await getDoc(event)).data();
 await assertFails(getDoc(doc(o,'users',uid,'profileStats','current')));await assertFails(updateDoc(doc(o,'users',uid,'profileStats','current'),{normalSolves:999}));
 await assertFails(updateDoc(doc(d,'users',uid,'profileStats','current'),{normalSolves:999}));await assertFails(setDoc(event,{...data,createdAt:serverTimestamp()}));await assertFails(deleteDoc(event));await assertFails(updateDoc(event,{moveCount:999}));
 const entry=(await getDoc(doc(d,'solves','normal_'+id(1)+'_single'))).data();await assertFails(setDoc(doc(d,'solves','fake'),{...entry,createdAt:serverTimestamp()}));
 const {schemaVersion,...legacy}=entry;
 for(const source of ['battle','bot','guided','daily','replay'])await assertFails(setDoc(doc(d,'solves','legacy-'+source),{...legacy,source}));
});
async function seedRoom(roomId,mode,winner,draw=false,status='finished',bot=false){await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await setDoc(doc(d,'battleRooms',roomId),{mode,hostUid:uid,guestUid:other,round:1,status:'finished',winnerUid:winner,isDraw:draw,isBot:bot,cubeMode:'virtual',maxPlayers:2});await setDoc(doc(d,'battleRooms',roomId,'players',uid),{uid,round:1,status});});}
const details={name:'Tester',cubeMode:'virtual',finalTime:null,tps:null,moveCount:0,ratingChange:0};
test('ranked/friend win, loss, draw and DNF each count once; bot and unfinished rounds rejected',async()=>{
 const d=db(uid),w=P.create(sdk,d);for(const mode of ['ranked','friend'])for(const result of ['win','loss','draw','dnf']){
  const room=mode+'-'+result;await seedRoom(room,mode,result==='win'?uid:other,result==='draw',result==='dnf'?'dnf':'finished');
  const rid=room+'_'+uid+'_1';await assertSucceeds(w.battle(uid,rid,room,1,details));await w.battle(uid,rid,room,1,details);
 }
 const s=(await getDoc(doc(d,'users',uid,'profileStats','current'))).data();for(const mode of ['ranked','friend']){assert.equal(s[mode+'Battles'],4);for(const f of ['Wins','Losses','Draws','Dnfs'])assert.equal(s[mode+f],1);}
 const u=(await getDoc(doc(d,'users',uid))).data();assert.equal(u.friendLosses,1);assert.equal(u.friendDnfs,1);assert.equal(u.rating,1200);
 await seedRoom('bot','ranked',uid,false,'finished',true);await assert.rejects(w.battle(uid,'bot_'+uid+'_1','bot',1,details));
 await assert.rejects(w.battle(uid,'ranked-win_'+uid+'_2','ranked-win',2,details));
});
test('existing legacy battle result is neither rewritten nor backfilled',async()=>{
 await seedRoom('legacy','friend',uid);const d=db(uid),rid='legacy_'+uid+'_1';await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'battleResults',rid),{uid,mode:'friend',result:'win',legacy:true}));
 assert.equal(await P.create(sdk,d).battle(uid,rid,'legacy',1,details),false);assert(!(await getDoc(doc(d,'users',uid,'profileEvents','battle_'+rid))).exists());
});
test('a fabricated new event cannot inflate counters or finalize a foreign/nonexistent round',async()=>{
 const d=db(uid),eid='battle_missing_'+uid+'_1',stamp=serverTimestamp(),before=(await getDoc(doc(d,'users',uid,'profileStats','current'))).data();
 const e={v:1,id:eid,uid,kind:'friend',result:'win',roomId:'missing',round:1,resultId:'missing_'+uid+'_1',createdAt:stamp};
 const batch=writeBatch(d);batch.set(doc(d,'users',uid,'profileEvents',eid),e);batch.set(doc(d,'users',uid,'profileStats','current'),P.advance(before,e,stamp));batch.set(doc(d,'battleResults',e.resultId),{...details,uid,schemaVersion:2,eventId:eid,mode:'friend',result:'win',roomId:'missing',round:1});await assertFails(batch.commit());
 // A broad legacy /users update must never authorize canonical child writes.
 await assertSucceeds(updateDoc(doc(d,'users',uid),{totalSolves:999999}));
 await assertFails(updateDoc(doc(d,'users',uid,'profileStats','current'),{normalSolves:999999}));
 assert.equal((await getDoc(doc(d,'users',uid,'profileStats','current'))).data().normalSolves,4);
});
test('same round concurrent result commits are counted once and real multiplayer friend rounds remain supported',async()=>{
 const room='real-multi',rid=room+'_'+uid+'_1';await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await setDoc(doc(d,'battleRooms',room),{mode:'friend',cubeMode:'real',maxPlayers:20,activePlayerUids:[uid],hostUid:uid,guestUid:'',round:1,status:'finished',winnerUid:uid,isDraw:false});await setDoc(doc(d,'battleRooms',room,'players',uid),{uid,round:1,status:'finished'});});
 const a=P.create(sdk,db(uid)),b=P.create(sdk,db(uid));await Promise.all([a.battle(uid,rid,room,1,{...details,finalTime:0.05,cubeMode:'real'}),b.battle(uid,rid,room,1,{...details,finalTime:0.05,cubeMode:'real'})]);
 assert.equal((await getDoc(doc(db(uid),'users',uid,'profileStats','current'))).data().friendBattles,5);
});
test('existing Google/Guest profile creation and legacy normal ranking remain compatible',async()=>{
 for(const [name,provider] of [['new-google','google.com'],['new-guest','anonymous']]){const d=env.authenticatedContext(name,{firebase:{sign_in_provider:provider}}).firestore();await assertSucceeds(setDoc(doc(d,'users',name),{uid:name,rating:1200,name:'Tester',loginType:provider==='anonymous'?'guest':'google'}));await assertSucceeds(updateDoc(doc(d,'users',name),{name:'Renamed'}));
 await assertSucceeds(setDoc(doc(d,'solves','legacy-'+name),{uid:name,name:'Tester',rankingType:'single',source:'normal',mode:'virtual',valid:true,time:25,scramble:'R U',moveCount:20}));
 assert(!(await getDoc(doc(d,'users',name,'profileStats','current'))).exists());}
});
test('actual ranked Elo transaction still updates both players once, without counting a DNF as a loss',async()=>{
 const roomId='elo-regression';await seedRoom(roomId,'ranked',uid);
 await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();for(const u of [uid,other])await setDoc(doc(d,'users',u),{uid:u,name:'Tester',rating:1200,wins:0,losses:0,rankedBattles:0,rankedWins:0,rankedLosses:0,rankedDraws:0});await setDoc(doc(d,'battleRooms',roomId,'players',other),{uid:other,round:1,status:'dnf'});});
 const source=fs.readFileSync('online.js','utf8'),errors=[],notice={textContent:''};
 const context={...sdk,db:db(uid),window:{ProfileRecords:P},currentUser:{uid},activeRoomId:roomId,activeRoom:{mode:'ranked',ratingUpdated:false},activeRoomRole:'host',activeRound:1,ratingUpdateInProgress:false,USERS_COLLECTION:'users',BATTLE_ROOMS_COLLECTION:'battleRooms',INITIAL_RATING:1200,ELO_K_FACTOR:32,refreshBattleRatingRanking:async()=>{},refreshBattleAccountRating:async()=>{},profileModal:{hidden:true},battleNotice:notice,console:{log(){},error(...a){errors.push(a)}}};
 const execute=new Function(...Object.keys(context),source.slice(source.indexOf('function defaultUserStats()'),source.indexOf('async function ensureUserProfile()'))+source.slice(source.indexOf('async function applyRankedBattleResultAsHost()'),source.indexOf('function renderBattleLocalTimer('))+'return applyRankedBattleResultAsHost();');
 await execute(...Object.values(context));await execute(...Object.values(context));assert.deepEqual(errors,[]);assert.equal(notice.textContent,'');
 const a=(await getDoc(doc(db(uid),'users',uid))).data(),b=(await getDoc(doc(db(other),'users',other))).data();assert.equal(a.rating,1216);assert.equal(b.rating,1184);assert.equal(a.rankedBattles,1);assert.equal(b.rankedBattles,1);assert.equal(b.rankedLosses,0);assert.equal(b.rankedDnfs,1);
 assert.equal(a.ratingPeakObserved,1216);assert.equal(b.ratingPeakObserved,1200);assert(a.ratingPeakTrackingStartedAt instanceof sdk.Timestamp);
});
