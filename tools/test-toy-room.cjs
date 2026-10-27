const {chromium}=require('C:/Users/harut/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.toy-verification');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{try{let f=path.join(root,new URL(req.url,'http://localhost').pathname);if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[path.extname(f)]||'text/plain');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(8782,r));const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});try{
 for(const [width,height]of [[1440,900],[1024,768],[390,844],[320,740]]){
  const context=await b.newContext({viewport:{width,height},serviceWorkers:'block',hasTouch:width<600,isMobile:width<600}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{navigator.serviceWorker.register=async()=>({update:async()=>{},addEventListener(){}});});await p.goto('http://localhost:8782');await p.waitForFunction(()=>!!window.ProfileView&&!!window.SolveReplay);if(await p.locator('#dismissBeginnerTipBtn').isVisible())await p.locator('#dismissBeginnerTipBtn').click();
  for(const dark of [false,true]){
   await p.evaluate(d=>document.body.classList.toggle('dark',d),dark);
   const prefix=width+'-'+(dark?'night':'day');
   async function shot(name){if(['home','guided'].includes(name))await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(230);const geometry=await p.evaluate(()=>{const mod=document.querySelector('.app-modal:not([hidden]) .modal-content');return {body:document.documentElement.scrollWidth<=innerWidth,modal:!mod||mod.scrollWidth<=mod.clientWidth+1,modBounds:!mod||(()=>{const r=mod.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})()};});assert(geometry.body&&geometry.modal&&geometry.modBounds,JSON.stringify({prefix,name,geometry}));await p.screenshot({path:path.join(out,prefix+'-'+name+'.png'),fullPage:['home','guided'].includes(name)});}
   await shot('home');
   const cube=await p.locator('#cubeContainer').boundingBox();assert(cube.width>150&&cube.height>150);
   for(const [button,modal,name]of [['openSettingsBtn','settingsModal','settings'],['openBattleBtn','battleModal','battle'],['openAnalyticsBtn','analyticsModal','analytics'],['openRankingBtn','rankingModal','ranking'],['profileBtn','profileModal','profile']]){
    await p.locator('#'+button).click();await shot(name);
    if(name==='battle'){await p.locator('[data-battle-choice="ranked"]').click();await shot('random');}
    if(name==='profile'){await p.evaluate(()=>ProfileView.render(document.getElementById('profileBody'),{name:'Alex · Cube Explorer',guest:true,createdAt:new Date().toISOString(),account:{rating:1200},stats:{normalSolves:137,totalMoves:9453,tpsMilliSum:356200,pbMs:18740,rankedBattles:12,rankedWins:7,rankedLosses:3,rankedDraws:1,rankedDnfs:1,friendBattles:8,friendWins:4,trackingStartedAt:new Date().toISOString()},detail:null,ranks:{battle:'Unrated',single:'Not published yet'},real:[]}));await shot('profile-populated');await p.locator('#profile-achievements').scrollIntoViewIfNeeded();await shot('achievements');}
    await p.locator(name==='analytics'?'#analyticsClose':`[data-close-modal="${modal}"]`).click();
   }
   await p.locator('#openDailyBtn').click();await shot('daily');await p.locator('#dailyClose').click();
   await p.evaluate(()=>GuidedSolve.setMode('guided'));await p.evaluate(async()=>{lockedScramble='R U F2';await scrambleCube();});await p.waitForFunction(()=>!normalScramblePreparing);await shot('guided');await p.evaluate(()=>GuidedSolve.setMode('normal'));await p.evaluate(()=>{resetCube();normalSolveState='idle';});
   console.log(JSON.stringify({width,height,dark,layout:true,cube,errors}));
  }
  if(width<600){
   await p.evaluate(()=>{GuidedSolve.setMode('normal');normalSolveState='idle';renderSoloActions();lockedScramble='R U F2';setAnimationSpeed('20');});
   await p.locator('#soloSpaceHint').tap();await p.waitForFunction(()=>!normalScramblePreparing&&normalInspectionActive);
   for(const key of ['h','h','f','k']){await p.locator('#moveInput').fill(key);await p.waitForFunction(()=>!isCubeBusy());if(key==='f')await p.waitForTimeout(2200);}
   await p.waitForFunction(()=>isCubeSolved()&&!isTimerRunning());assert.equal(await p.evaluate(()=>getSolves('virtual').length),1);
   await p.locator('#replayOpenBtn').tap();await p.locator('#replayPlay').tap();await p.screenshot({path:path.join(out,width+'-touch-replay.png')});await p.locator('#replayClose').tap();console.log(JSON.stringify({width,touchScramble:true,mobileTextInput:true,normalSolve:true,replayTap:true}));
  }
  await p.emulateMedia({reducedMotion:'reduce'});await p.locator('#openSettingsBtn').click();assert.equal(await p.locator('#settingsModal .modal-content').evaluate(el=>getComputedStyle(el).animationName),'none');await p.locator('[data-close-modal="settingsModal"]').click();
  for(const route of ['/about.html','/privacy.html','/rules.html','/online-battle/']){await p.goto('http://localhost:8782'+route);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);await context.close();
 }
}finally{await b.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
