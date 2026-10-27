// Local fixtures only: real Firestore transactions and Rules via the emulator.
// Never connects to production Firestore; no real credentials are used.
const {chromium}=require('C:/Users/harut/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing'),sdk=require('firebase/firestore');
 const root=path.resolve(__dirname,'..'),project='demo-stcube-random-browser',reports=[];
const hook=`
import {connectFirestoreEmulator} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
const fixtureUid=localStorage.getItem('randomTestUid');
db=getFirestore(initializeApp({projectId:'${project}',apiKey:'demo',appId:'demo'}));
connectFirestoreEmulator(db,'127.0.0.1',8780,{mockUserToken:{sub:fixtureUid,firebase:{sign_in_provider:'google.com'}}});
currentUser={uid:fixtureUid,displayName:'Test Player',isAnonymous:false};getBattleScramble=async()=> 'R U F2';setupAuthUi();
rankedRecoveryPromise=recoverAbandonedRankedSearch();await rankedRecoveryPromise;
window.__randomTest={start:startRankedBattle,cancel:cancelRandomMatch,leave:leaveBattleMode,choice:()=>setBattleChoice('ranked'),get room(){return activeRoom},get id(){return activeRoomId},get own(){return rankedOwnQueueRoomId},get token(){return rankedSearchToken},get botEnabled(){return rankedSearchBotEnabled}};
`;
const server=http.createServer((req,res)=>{try{
 const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';let data=fs.readFileSync(path.join(root,name));
 if(name==='online.js')data=String(data).replace('const config = window.CUBE_FIREBASE_CONFIG || {};','const config = {};')+hook;
 res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[path.extname(name)]||'text/plain','Cache-Control':'no-store'}).end(data);
}catch{res.writeHead(404).end();}});
async function open(browser,uid,viewport={width:1440,height:1000}){
 const context=await browser.newContext({viewport,serviceWorkers:'block',isMobile:viewport.width<600,hasTouch:viewport.width<600});
 await context.addInitScript(uid=>{localStorage.setItem('randomTestUid',uid);navigator.serviceWorker.register=async()=>({update:async()=>{},addEventListener(){}});},uid);const p=await context.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8777/');await p.waitForFunction(()=>!!window.__randomTest&&!!window.opponentCube);
 if(await p.locator('#dismissBeginnerTipBtn').isVisible())await p.locator('#dismissBeginnerTipBtn').click();
 await p.evaluate(()=>{setAnimationSpeed('20');__randomTest.choice();document.getElementById('battleModal').hidden=false;});
 return {context,p,errors};
}
async function turn(p,m){await p.evaluate(m=>performMove(m),m);await p.waitForFunction(()=>!isCubeBusy());}
(async()=>{
 const env=await initializeTestEnvironment({projectId:project,firestore:{host:'127.0.0.1',port:8780,rules:fs.readFileSync(path.join(root,'firestore.rules'),'utf8')}});
 await env.withSecurityRulesDisabled(async c=>{for(const [uid,rating]of [['solo',2100],['mobile',2100],['human-low',400],['human-high',2800]])await sdk.setDoc(sdk.doc(c.firestore(),'users',uid),{uid,name:'Test Player',rating,loginType:'google'});});
 await new Promise(r=>server.listen(8777,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
 try{
  fs.mkdirSync(path.join(root,'.bot-verification'),{recursive:true});
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
   const uid=viewport.width>600?'solo':'mobile',{context,p,errors}=await open(browser,uid,viewport);
   for(const dark of [false,true]){await p.evaluate(d=>document.body.classList.toggle('dark',d),dark);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert(await p.locator('#botEnabledToggle').isVisible());await p.screenshot({path:path.join(root,'.bot-verification',`random-${viewport.width}-${dark}.png`)});}
   const history=await p.evaluate(()=>JSON.stringify(getAllSolves())),replay=await p.evaluate(()=>JSON.stringify(SolveReplay.data)),started=Date.now();
   await p.evaluate(()=>__randomTest.start());assert(await p.locator('#botEnabledToggle').isDisabled());assert(await p.locator('#cancelMatchBtn').isVisible());
   if(viewport.width>600){const other=await context.newPage();await other.goto('http://127.0.0.1:8777/');await other.waitForFunction(()=>!!window.__randomTest);await other.evaluate(()=>__randomTest.start());assert.equal(await other.evaluate(()=>__randomTest.own),'');await other.close();}
   await p.waitForFunction(()=>BotBattle.active,null,{timeout:20000});const delay=Date.now()-started;assert(delay>=4800&&delay<18000,'fallback elapsed '+delay);
   await p.locator('#battleReadyBtn').click();await p.waitForFunction(()=>battleInputState==='inspecting');
   assert.equal(await p.evaluate(()=>GuidedSolver.signature(opponentCube.snapshot())===GuidedSolver.signature(getCubeSnapshot())),true);
   for(const m of ['F2',"U'","R'"])await turn(p,m);
   await p.waitForFunction(()=>BotBattle.diagnostics.phase==='finished',null,{timeout:20000});assert(await p.evaluate(()=>BotBattle.diagnostics.solved));
   const target=await p.evaluate(()=>BotBattle.diagnostics.target),actual=await p.evaluate(()=>BotBattle.diagnostics.actual);assert(Math.abs(target-actual)<1);
   assert.equal(await p.locator('#rematchBotBtn,#playAgainBtn').count(),0);
   await p.waitForFunction(()=>BattleEnd.phase==='leave');
   assert.equal(await p.evaluate(()=>JSON.stringify(getAllSolves())),history);assert.equal(await p.evaluate(()=>JSON.stringify(SolveReplay.data)),replay);
   await env.withSecurityRulesDisabled(async c=>{assert.equal((await sdk.getDoc(sdk.doc(c.firestore(),'users',uid))).data().rating,2100);assert(!(await sdk.getDoc(sdk.doc(c.firestore(),'matchmaking',uid))).exists());assert.equal((await sdk.getDocs(sdk.collection(c.firestore(),'battleResults'))).size,0);});
   await p.locator('#battleEndLeave').click();assert.equal(await p.evaluate(()=>BotBattle.active),false);
   assert.deepEqual(errors,[]);reports.push({viewport,botFallbackMs:delay,verifiedActualSolve:true,target,actual,leaveOnly:true,historyReplayRatingUnchanged:true,errors});await context.close();
  }
  const a=await open(browser,'human-low');await a.p.locator('#botEnabledToggle').uncheck();assert.match(await a.p.locator('#botEnabledHint').innerText(),/real player only/);
  await a.p.reload();await a.p.waitForFunction(()=>!!window.__randomTest);assert.equal(await a.p.locator('#botEnabledToggle').isChecked(),false);
  await a.p.evaluate(()=>{__randomTest.choice();document.getElementById('battleModal').hidden=false;});await a.p.evaluate(()=>__randomTest.start());
  await a.p.waitForTimeout(47000);assert.equal(await a.p.evaluate(()=>BotBattle.active),false);assert.equal(await a.p.evaluate(()=>document.body.classList.contains('battle-mode')),false);
  await env.withSecurityRulesDisabled(async c=>{const q=(await sdk.getDoc(sdk.doc(c.firestore(),'matchmaking','human-low'))).data();assert(q);assert(Date.now()-q.createdAt.toMillis()<30000);});
  const b=await open(browser,'human-high'),from=Date.now();await b.p.evaluate(()=>__randomTest.start());
  for(const p of [a.p,b.p])await p.waitForFunction(()=>document.body.classList.contains('battle-mode'));
  assert.equal(await a.p.evaluate(()=>__randomTest.id),await b.p.evaluate(()=>__randomTest.id));assert.equal(await b.p.evaluate(()=>BotBattle.active),false);assert(Date.now()-from<5000);
  reports.push({botOffPersists:true,botOffWaitedMs:47000,leaseRenewed:true,largeRatingDifference:2400,humanMatchMs:Date.now()-from,initialSolveNotRequired:true,multipleTabsSingleSearch:true});
  await a.p.evaluate(()=>__randomTest.leave());await b.p.evaluate(()=>__randomTest.leave());await a.context.close();await b.context.close();
  const c=await open(browser,'solo');await c.p.evaluate(()=>__randomTest.start());await c.p.evaluate(()=>__randomTest.cancel());await c.p.waitForTimeout(6000);assert.equal(await c.p.evaluate(()=>BotBattle.active),false);
  await c.p.evaluate(()=>__randomTest.start());await c.p.reload();await c.p.waitForFunction(()=>!!window.__randomTest);await c.p.waitForTimeout(6000);assert.equal(await c.p.evaluate(()=>BotBattle.active),false);
  await env.withSecurityRulesDisabled(async ctx=>assert.equal((await sdk.getDoc(sdk.doc(ctx.firestore(),'matchmaking','solo'))).exists(),false));
  reports.push({cancelPreventsBot:true,pagehideClearsQueue:true,reloadDoesNotResumeBot:true});await c.context.close();
  console.log(JSON.stringify(reports,null,2));
 }finally{await browser.close();server.close();await env.cleanup();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
