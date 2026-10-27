// Two isolated browser contexts, production client code, local Firestore only.
const {chromium}=require('C:/Users/harut/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing'),sdk=require('firebase/firestore');
const root=path.resolve(__dirname,'..'),project='demo-stcube-battle-end',reports=[];
const hook=`
import {connectFirestoreEmulator} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
const fixtureUid=localStorage.getItem('battleTestUid');
db=getFirestore(initializeApp({projectId:'${project}',apiKey:'demo',appId:'demo'}));
connectFirestoreEmulator(db,'127.0.0.1',8780,{mockUserToken:{sub:fixtureUid,firebase:{sign_in_provider:'google.com'}}});
currentUser={uid:fixtureUid,displayName:'Test Player',isAnonymous:false};getBattleScramble=async()=> 'R U F2';setupAuthUi();
window.__battleTest={start:startRankedBattle,ready:readyBattleRoom,leave:leaveBattleMode,sync:processBattleInboxes,friend:createBattleRoom,join:joinBattleRoom,get room(){return activeRoom},get id(){return activeRoomId}};
`;
const server=http.createServer((req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';let data=fs.readFileSync(path.join(root,name));if(name==='online.js')data=String(data).replace('const config = window.CUBE_FIREBASE_CONFIG || {};','const config = {};')+hook;res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[path.extname(name)]||'text/plain','Cache-Control':'no-store'}).end(data);}catch{res.writeHead(404).end();}});
async function open(browser,uid,viewport={width:1440,height:1000}){
 const context=await browser.newContext({viewport,serviceWorkers:'block',isMobile:viewport.width<600,hasTouch:viewport.width<600});context.setDefaultTimeout(20000);await context.addInitScript(uid=>{localStorage.setItem('battleTestUid',uid);navigator.serviceWorker.register=async()=>({update:async()=>{},addEventListener(){}});},uid);
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')console.log('BROWSER',uid,m.text());});await p.goto('http://127.0.0.1:8778/');await p.waitForFunction(()=>!!window.__battleTest&&!!window.opponentCube);if(await p.locator('#dismissBeginnerTipBtn').isVisible())await p.locator('#dismissBeginnerTipBtn').click();await p.evaluate(()=>setAnimationSpeed('20'));return{p,context,errors};
}
async function solve(p){await p.evaluate(()=>performMove('F2'));await p.waitForFunction(()=>!isCubeBusy());await p.waitForTimeout(3200);for(const m of ["U'","R'"]){await p.evaluate(m=>performMove(m),m);await p.waitForFunction(()=>!isCubeBusy());}assert.equal(await p.evaluate(()=>isCubeSolved()),true,JSON.stringify(await p.evaluate(()=>({input:battleInputState,end:BattleEnd.phase,room:__battleTest.room?.status,last:document.getElementById('lastMove').textContent}))));}
async function layout(p,label){fs.mkdirSync('.bot-verification',{recursive:true});for(const dark of[false,true]){await p.evaluate(d=>document.body.classList.toggle('dark',d),dark);await p.waitForTimeout(80);const ok=await p.evaluate(()=>{const el=document.querySelector('.battle-end-content'),r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1;});assert(ok,'Battle end layout '+label);await p.screenshot({path:'.bot-verification/end-'+label+'-'+dark+'.png'});}}
// Optional timing probe uses actual keydown -> shared rotation -> render path
// while two clients are in a real Emulator-backed battle (not production).
if(process.env.STCUBE_INPUT_LATENCY){
 const originalSolve=solve,measured=new WeakSet();
 solve=async p=>{
  if(!measured.has(p)){
   measured.add(p);
   for(const burst of [false,true])console.log('HUMAN_LATENCY',JSON.stringify(await p.evaluate(async burst=>{
    const origin=GuidedSolver.signature(getCubeSnapshot()),inputs=[],starts=[],visible=[],done=[];
    const start=()=>starts.push(performance.now()),complete=e=>done.push(e.detail.move);
    addEventListener('stcube:move-start',start);addEventListener('stcube:move-complete',complete);
    const draw=renderer.render;renderer.render=function(...args){if(activeRotationGroup&&Math.abs(activeRotationGroup.rotation.x)+Math.abs(activeRotationGroup.rotation.y)+Math.abs(activeRotationGroup.rotation.z)>0&&visible.length<starts.length)visible.push(performance.now());return draw.apply(this,args);};
    for(const key of burst?['i','k','j','f','h','g','d','e','s','l','w','o']:['i','k']){
     const t=performance.now();document.dispatchEvent(new KeyboardEvent('keydown',{key,code:'Key'+key.toUpperCase(),bubbles:true}));inputs.push({t,handler:performance.now()-t,move:getMoveFromKey(key)});
     if(burst)await new Promise(r=>setTimeout(r,8));else while(isCubeBusy())await new Promise(r=>setTimeout(r,5));
    }
    while(isCubeBusy())await new Promise(r=>setTimeout(r,5));renderer.render=draw;removeEventListener('stcube:move-start',start);removeEventListener('stcube:move-complete',complete);
    if(origin!==GuidedSolver.signature(getCubeSnapshot())||JSON.stringify(done)!==JSON.stringify(inputs.map(i=>i.move))||visible.length!==inputs.length)throw Error('Input order/state mismatch');
    return {burst,starts:starts.map((t,i)=>t-inputs[i].t),visible:visible.map((t,i)=>t-inputs[i].t),handlers:inputs.map(i=>i.handler)};
   },burst)));
  }
  return originalSolve(p);
 };
}
if(process.env.STCUBE_INPUT_BASELINE){
 const read=fs.readFileSync;
 fs.readFileSync=function(file,...args){
  if(String(file)===path.join(root,'cube.js'))file=path.join(root,'.input-latency-baseline.js');
  if(String(file)===path.join(root,'online.js'))file=path.join(root,'.input-latency-online-baseline.js');
  return read.call(this,file,...args);
 };
}
(async()=>{
 const env=await initializeTestEnvironment({projectId:project,firestore:{host:'127.0.0.1',port:8780,rules:fs.readFileSync('firestore.rules','utf8')}});
 await env.withSecurityRulesDisabled(async c=>{for(const uid of ['host','guest','bot','friend-host','friend-guest','friend-third'])await sdk.setDoc(sdk.doc(c.firestore(),'users',uid),{uid,name:'Test Player',rating:1200,loginType:'google'});});
 await new Promise(r=>server.listen(8778,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
 try{
  const a=await open(browser,'host'),b=await open(browser,'guest',{width:390,height:844});
  await a.p.evaluate(()=>{document.getElementById('botEnabledToggle').checked=false;document.getElementById('botEnabledToggle').dispatchEvent(new Event('change'));});
  await a.p.evaluate(()=>__battleTest.start());await b.p.evaluate(()=>__battleTest.start());for(const x of [a,b])await x.p.waitForFunction(()=>document.body.classList.contains('battle-mode'));
  const roomId=await a.p.evaluate(()=>__battleTest.id);assert.equal(roomId,await b.p.evaluate(()=>__battleTest.id));
  await a.p.evaluate(()=>__battleTest.ready());await b.p.evaluate(()=>__battleTest.ready());for(const x of [a,b])await x.p.waitForFunction(()=>battleInputState==='inspecting');
  await solve(a.p);await a.p.waitForFunction(()=>BattleEnd.phase==='result');assert.match(await a.p.locator('#battleEndTitle').innerText(),/PENDING/);
  await a.p.waitForTimeout(1800);assert.equal(await a.p.evaluate(()=>BattleEnd.phase),'result');await a.p.waitForFunction(()=>BattleEnd.phase==='replay');
  await layout(a.p,'desktop');
  for(const speed of ['1','2','4'])await a.p.locator('#battleEndSpeed').selectOption(speed);
  if(await a.p.locator('#battleEndSkip').isVisible())await a.p.locator('#battleEndSkip').click();await a.p.waitForFunction(()=>BattleEnd.phase==='leave');
  assert.equal(await a.p.locator('#rematchBotBtn,#playAgainBtn').count(),0);await a.p.locator('#battleEndLeave').click();await a.p.waitForFunction(()=>!document.body.classList.contains('battle-mode'));
  assert.notEqual(await b.p.evaluate(()=>__battleTest.room.status),'finished');await solve(b.p);await b.p.waitForFunction(()=>__battleTest.room.status==='finished'&&__battleTest.room.ratingUpdated,null,{timeout:15000});
  await env.withSecurityRulesDisabled(async c=>{const d=c.firestore(),r=(await sdk.getDoc(sdk.doc(d,'battleRooms',roomId))).data();assert.equal(r.resultCount,2);assert(r.ratingUpdated);assert.equal((await sdk.getDoc(sdk.doc(d,'users','host'))).data().rankedBattles,1);assert.equal((await sdk.getDoc(sdk.doc(d,'battleRooms',roomId,'players','host'))).data().status,'finished');});
  await a.p.reload();await a.p.waitForFunction(()=>!!window.__battleTest);await Promise.all([a.p.evaluate(()=>__battleTest.sync()),a.p.evaluate(()=>__battleTest.sync())]);
  await env.withSecurityRulesDisabled(async c=>{const s=(await sdk.getDoc(sdk.doc(c.firestore(),'users','host','profileStats','current'))).data();assert.equal(s.rankedBattles,1);});
  await b.p.waitForFunction(()=>BattleEnd.phase==='replay');await b.p.locator('#battleEndSpeed').selectOption('1');await layout(b.p,'mobile-replay');await b.p.waitForFunction(()=>BattleEnd.phase==='leave');await layout(b.p,'mobile');await b.p.locator('#battleEndLeave').click();await a.p.waitForTimeout(6000);assert.equal(await a.p.evaluate(()=>BotBattle.active),false);
  reports.push({twoClients:true,hostLeavesBeforeGuestSolve:true,ratingOnce:true,deferredProfileOnce:true,personalReplaySpeeds:[1,2,4],skip:true});
  await a.p.evaluate(()=>__battleTest.start());await b.p.evaluate(()=>__battleTest.start());for(const x of[a,b])await x.p.waitForFunction(()=>document.body.classList.contains('battle-mode'));
  const abandonedId=await a.p.evaluate(()=>__battleTest.id);await a.p.evaluate(()=>__battleTest.ready());await b.p.evaluate(()=>__battleTest.ready());for(const x of[a,b])await x.p.waitForFunction(()=>battleInputState==='inspecting');
   await a.p.evaluate(()=>performMove('F2'));await a.p.waitForFunction(()=>!isCubeBusy());await a.p.evaluate(()=>__battleTest.leave());await a.p.waitForFunction(()=>!document.body.classList.contains('battle-mode'));await solve(b.p);await b.p.waitForFunction(()=>__battleTest.room.status==='finished'&&__battleTest.room.ratingUpdated);
  assert.equal(await b.p.evaluate(()=>__battleTest.room.roundResults.host.status),'dnf');await b.p.waitForFunction(()=>BattleEnd.phase==='leave');await b.p.locator('#battleEndLeave').click();
  const pastDay=Math.floor(Date.now()/86400000)-2,old=sdk.Timestamp.fromMillis(pastDay*86400000+1000),offlineId='all-offline-recovery';
  await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await sdk.setDoc(sdk.doc(d,'battleRooms',offlineId),{...require('../battle-flow.js').empty(),mode:'ranked',cubeMode:'virtual',hostUid:'host',guestUid:'guest',round:1,status:'solving',roundStartedAt:old,pendingParticipantUids:['host','guest'],winnerUid:'',winnerName:'',isDraw:false,timeLimitReached:false,ratingUpdated:false});for(const uid of['host','guest'])await sdk.setDoc(sdk.doc(d,'battleRooms',offlineId,'players',uid),{uid,name:'Test Player',round:1,status:'solving',updatedAt:old});});
  await a.p.reload();await a.p.waitForFunction(()=>!!window.__battleTest);await a.p.evaluate(()=>__battleTest.sync());
  await env.withSecurityRulesDisabled(async c=>{const d=c.firestore(),room=(await sdk.getDoc(sdk.doc(d,'battleRooms',offlineId))).data(),stats=(await sdk.getDoc(sdk.doc(d,'users','host','profileStats','current'))).data(),detail=(await sdk.getDoc(sdk.doc(d,'users','host','profileStats','details'))).data();assert.equal(room.status,'finished');assert(room.ratingUpdated);assert.equal(Math.floor(room.finishedAt.toMillis()/86400000),pastDay);assert.equal(stats.rankedBattles,3);assert.equal(stats.rankedDnfs,2);assert.equal(detail.lastDayIndex,Math.floor(Date.now()/86400000));});
  reports.push({unfinishedExitIsDnf:true,opponentContinues:true,consecutiveRoundsClean:true,allOfflineRecoveredOnNextAccess:true,originalUtcCompletionDay:true});
  for(const x of[a,b]){assert.deepEqual(x.errors,[]);await x.context.close();}
  const friends=await Promise.all(['friend-host','friend-guest','friend-third'].map(uid=>open(browser,uid)));
  await friends[0].p.evaluate(()=>__battleTest.friend('friend'));const friendId=await friends[0].p.evaluate(()=>__battleTest.id);
  for(const x of friends.slice(1))await x.p.evaluate(id=>__battleTest.join(id),friendId);
  for(const x of friends)await x.p.evaluate(()=>__battleTest.ready());for(const x of friends)await x.p.waitForFunction(()=>battleInputState==='inspecting');
  await solve(friends[0].p);await friends[0].p.waitForFunction(()=>BattleEnd.phase==='replay');await friends[0].p.locator('#battleEndSkip').click();await friends[0].p.locator('#battleEndLeave').click();await friends[0].p.waitForFunction(()=>!document.body.classList.contains('battle-mode'));
  for(const x of friends.slice(1))await solve(x.p);await friends[2].p.waitForFunction(()=>__battleTest.room.status==='finished');
  assert.equal(await friends[2].p.evaluate(()=>__battleTest.room.resultCount),3);for(const x of friends){assert.deepEqual(x.errors,[]);await x.context.close();}reports.push({friendThreeClients:true,hostExitDoesNotCancel:true,allThreeResults:true});
  const bot=await open(browser,'bot');await bot.p.evaluate(()=>__battleTest.start());await bot.p.waitForFunction(()=>BotBattle.active,null,{timeout:20000});await bot.p.locator('#battleReadyBtn').click();await bot.p.waitForFunction(()=>battleInputState==='inspecting');await solve(bot.p);await bot.p.waitForFunction(()=>BattleEnd.phase==='replay');await bot.p.locator('#battleEndSkip').click();await bot.p.locator('#battleEndLeave').click();await bot.p.waitForTimeout(6500);assert.equal(await bot.p.evaluate(()=>BotBattle.active||document.body.classList.contains('battle-mode')),false);assert.deepEqual(bot.errors,[]);reports.push({botFallback:true,botLeaveNoRestartAfter6500ms:true});await bot.context.close();
  console.log(JSON.stringify(reports,null,2));
 }finally{await browser.close();server.close();await env.cleanup();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
