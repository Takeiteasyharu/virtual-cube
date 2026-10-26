const {before,after,test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing'),sdk=require('firebase/firestore');
const {doc,setDoc,getDoc,Timestamp}=sdk,M=require('../matchmaking-config.js');let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-stcube-random',firestore:{host:'127.0.0.1',port:8780,rules:fs.readFileSync('firestore.rules','utf8')}});});
after(async()=>env?.cleanup());
const source=fs.readFileSync('online.js','utf8'),part=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
async function seed(uid,rating,{age=0,status='waiting'}={}){await env.withSecurityRulesDisabled(async c=>{
 const d=c.firestore();await setDoc(doc(d,'battleRooms',uid),{roomId:uid,mode:'ranked',status,hostUid:uid,guestUid:'',round:1});
 await setDoc(doc(d,'matchmaking',uid),{uid,mode:'ranked',status:'waiting',roomId:uid,rating,searchToken:uid,startedAtMs:Date.now()-age,createdAt:Timestamp.fromMillis(Date.now()-age)});
});}
function client(uid,botEnabled=true){
 const d=env.authenticatedContext(uid,{firebase:{sign_in_provider:'google.com'}}).firestore(),state={matched:'',bot:false};
 const body={classList:{contains:()=>!!state.matched||state.bot}};
 const win={Matchmaking:M,clearTimeout,clearInterval,BotBattle:{active:false,prepare:async()=>({}),start:()=>{state.bot=true;win.BotBattle.active=true;}}};
 const declarations=`const MATCHMAKING_COLLECTION='matchmaking',BATTLE_ROOMS_COLLECTION='battleRooms',MATCHMAKING_LIMIT=10,MATCHMAKING_CONFIG=window.Matchmaking.config;
 let rankedMatchAttempting=false,rankedOwnQueueRoomId=currentUser.uid,rankedSearchToken=currentUser.uid,rankedSearchGeneration=1,rankedSearchBotEnabled=${botEnabled},activeRoomId=currentUser.uid,activeRoomRole='host',botFallbackTimeout;
 const cancelMatchBtn={},randomBattleBtn={},botEnabledToggle={};
 const clearMatchmakingListeners=()=>{},clearFriendLobby=()=>{},clearMyMatchmakingEntry=()=>{},forgetRankedSearch=()=>{},setRandomStatus=()=>{},stopRankedSearchTimer=()=>{},releaseRankedSearchLock=()=>{},setTimeout=()=>0;
 const getRating=x=>Number(x.rating)||1200,getPlayerName=()=>currentUser.uid,getBattleScramble=async()=>'R U F2';
 const watchRoom=id=>{state.matched=id},joinBattleRoom=async id=>{state.matched=id};
 `;
 const code=declarations+part('function getRankedMatchRange(', '\nfunction scheduleRankedMatchExpansion(')+part('async function fallbackToBot(', '\nasync function joinBattleRoom(')+`;return {attempt:attemptRankedMatch,fallback:()=>fallbackToBot(1,currentUser.uid,{rating:1200})};`;
 const names=Object.keys(sdk);const f=new Function(...names,'db','currentUser','window','document','state',code)(...names.map(k=>sdk[k]),d,{uid},win,{body},state);
 return {...f,state,db:d};
}
test('actual production transaction matches 400 vs 2800 immediately without a prior solve',async()=>{
 await seed('large-a',400);await seed('large-b',2800);const a=client('large-a');await a.attempt();assert.equal(a.state.matched,'large-b');assert.equal((await getDoc(doc(a.db,'battleRooms','large-b'))).data().guestUid,'large-a');assert.equal((await getDoc(doc(a.db,'matchmaking','large-a'))).exists(),false);
});
test('expired and cancelled candidates cannot hide a live opponent behind them',async()=>{
 await seed('fresh-self',1200);await seed('expired',1200,{age:60000});await seed('cancelled',1200,{status:'cancelled'});await seed('live-opponent',3000);
 const c=client('fresh-self');await c.attempt();assert.equal(c.state.matched,'live-opponent');
});
test('BOT OFF rejects fallback; BOT ON cancels its queue atomically before entering local play',async()=>{
 // Isolate from other tests' unmatched hosts.
 await env.clearFirestore();await seed('bot-off',1200);const off=client('bot-off',false);await off.fallback();assert.equal(off.state.bot,false);assert((await getDoc(doc(off.db,'matchmaking','bot-off'))).exists());
 await env.clearFirestore();await seed('bot-on',1200);const on=client('bot-on');await on.fallback();assert.equal(on.state.bot,true);assert.equal((await getDoc(doc(on.db,'battleRooms','bot-on'))).data().status,'cancelled');assert.equal((await getDoc(doc(on.db,'matchmaking','bot-on'))).exists(),false);
});
test('two actual human transactions racing fallback cannot both match and enter BOT',async()=>{
 for(let i=0;i<6;i++){
  await env.clearFirestore();await seed('race-a',400);await seed('race-b',2800);const a=client('race-a'),b=client('race-b');
  await Promise.all([a.fallback(),b.attempt()]);
  const rooms=await Promise.all(['race-a','race-b'].map(id=>getDoc(doc(a.db,'battleRooms',id))));
  assert.equal(a.state.bot,false);assert(rooms.some(r=>r.data().guestUid));assert.equal(rooms.filter(r=>r.data().guestUid).length,1);
 }
});
test('nonowners cannot alter/delete another queue or join a cancelled room',async()=>{
 await env.clearFirestore();await seed('owner',1200);const c=client('stranger');
 await assertFails(sdk.updateDoc(doc(c.db,'matchmaking','owner'),{status:'matched'}));await assertFails(sdk.deleteDoc(doc(c.db,'matchmaking','owner')));
 const owner=client('owner');await owner.fallback();await assertFails(sdk.updateDoc(doc(c.db,'battleRooms','owner'),{guestUid:'stranger',updatedAt:sdk.serverTimestamp()}));
});
