// Real browser/production input handler. Baseline is an explicit source snapshot.
const {chromium}=require('C:/Users/harut/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),baseline=process.argv.includes('--baseline');
const server=http.createServer((req,res)=>{try{let name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(name==='toy-room.css'&&process.argv.includes('--no-toy')){res.setHeader('Content-Type','text/css');res.end('');return;}const online=name==='online.js';if(baseline&&name==='cube.js')name='.input-latency-baseline.js';if(baseline&&online)name='.input-latency-online-baseline.js';res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'})[path.extname(name)]||'text/plain');let data=fs.readFileSync(path.join(root,name));if(online)data=String(data)+"\nwindow.__latencyBotUser=()=>{currentUser={uid:'local-latency',isAnonymous:true,displayName:'Test'};};";res.end(data);}catch{res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(8779,r));const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{navigator.serviceWorker.register=async()=>({update:async()=>{},addEventListener(){}});});await page.goto('http://localhost:8779');await page.waitForFunction(()=>typeof renderer!=='undefined'&&!!window.BotBattleBridge);
 if(await page.locator('#dismissBeginnerTipBtn').isVisible())await page.locator('#dismissBeginnerTipBtn').click();
 for(const mode of ['normal','bot'])for(const burst of [false,true]){
  if(mode==='bot'){await page.evaluate(async()=>{__latencyBotUser();const p=await BotBattle.prepare('R U F2',1200);BotBattle.start(p,'Latency Test',1200);BotBattle.ready();});await page.waitForTimeout(3300);}
  const result=await page.evaluate(async({burst,mode})=>{
   setAnimationSpeed('10');if(mode==='normal'){resetCube();normalSolveState='idle';readyToSolve=false;}
   const origin=getCubeSnapshot(),inputs=[],starts=[],visible=[],complete=[],frames=[];let last=performance.now();
   const onStart=e=>starts.push({move:e.detail.move,t:performance.now()});const onComplete=e=>complete.push(e.detail.move);
   addEventListener('stcube:move-start',onStart);addEventListener('stcube:move-complete',onComplete);
   const original=renderer.render;renderer.render=function(...args){const now=performance.now();frames.push(now-last);last=now;if(activeRotationGroup&&Math.abs(activeRotationGroup.rotation.x)+Math.abs(activeRotationGroup.rotation.y)+Math.abs(activeRotationGroup.rotation.z)>0&&visible.length<starts.length)visible.push(now);return original.apply(this,args);};
   const keys=burst?['i','j','h','d','s','w','k','f','g','e','l','o']:['i','j','h','d','s','w','k','f','g','e'];
   for(const key of keys){const t=performance.now();document.dispatchEvent(new KeyboardEvent('keydown',{key,code:'Key'+key.toUpperCase(),bubbles:true}));inputs.push({t,handler:performance.now()-t,move:getMoveFromKey(key)});if(burst)await new Promise(r=>setTimeout(r,8));else{while(isCubeBusy())await new Promise(r=>setTimeout(r,5));await new Promise(r=>setTimeout(r,20));}}
   while(isCubeBusy())await new Promise(r=>setTimeout(r,10));renderer.render=original;removeEventListener('stcube:move-start',onStart);removeEventListener('stcube:move-complete',onComplete);
   const expected=GuidedSolver.applyAll(origin,inputs.map(i=>i.move),getCubeMoveSpec);const correct=GuidedSolver.signature(expected)===GuidedSolver.signature(getCubeSnapshot());
   return {mode,burst,count:inputs.length,correct,order:JSON.stringify(inputs.map(i=>i.move))===JSON.stringify(complete),startMs:starts.map((s,i)=>s.t-inputs[i].t),visibleMs:visible.map((t,i)=>t-inputs[i].t),handlerMs:inputs.map(i=>i.handler),meanFrameMs:frames.reduce((a,b)=>a+b,0)/frames.length};
  },{burst,mode});assert(result.correct&&result.order);assert.equal(result.visibleMs.length,result.count);console.log(JSON.stringify({baseline,...result}));if(mode==='bot')await page.evaluate(()=>BotBattleBridge.leave());
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
