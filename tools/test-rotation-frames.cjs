// Actual Three.js cube and input path. No production Firebase writes. Captures
// update angles AND drawable angles; --before serves the pre-fix source snapshot.
const {chromium}=require('C:/Users/harut/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const before=process.argv.includes('--before'),root=path.resolve(__dirname,'..'),out=path.join(root,'.rotation-verification');fs.mkdirSync(out,{recursive:true});
const capture=process.argv.includes('--capture');
const server=http.createServer((req,res)=>{try{let name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(before&&name==='cube.js')name='.rotation-before.js';let data=fs.readFileSync(path.join(root,name));if(name==='online.js')data=String(data).replace('const config = window.CUBE_FIREBASE_CONFIG || {};','const config = {};')+'\nwindow.__rotationBotUser=()=>{currentUser={uid:"rotation-fixture",isAnonymous:true,displayName:"Test"};};';res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'})[path.extname(name)]||'text/plain');res.end(data);}catch{res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(8793,r));const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});const reports=[];try{
 const p=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{navigator.serviceWorker.register=async()=>({update:async()=>{},addEventListener(){}});const raf=window.requestAnimationFrame.bind(window);window.__rotationDelay=0;window.__rotationStale=0;window.requestAnimationFrame=cb=>raf(t=>{if(cb.name==='animateScene'){const stop=performance.now()+window.__rotationDelay;while(performance.now()<stop){}cb(t-window.__rotationStale);}else cb(t);});});await p.goto('http://localhost:8793');await p.waitForFunction(()=>!!window.GuidedSolver&&!!window.BotBattleBridge);
 if(await p.locator('#dismissBeginnerTipBtn').isVisible())await p.locator('#dismissBeginnerTipBtn').click();
 if(capture)await p.evaluate(async()=>{setAnimationSpeed('10');for(const m of ['R',"R'",'U',"U'",'F',"F'"]){queueCubeMove(m);while(isCubeBusy())await new Promise(r=>setTimeout(r,5));}});
 for(const mode of capture?['normal']:['normal','bot'])for(const scenario of capture?['stale-frame']:['single','burst','alternating','stale-frame','low-fps']){
  if(mode==='bot'){await p.evaluate(async()=>{__rotationBotUser();BotBattle.start(await BotBattle.prepare('R U F2',1200),'Test',1200);BotBattle.ready();});await p.waitForTimeout(3300);}
  const result=await p.evaluate(async({mode,scenario,capture})=>{
   setAnimationSpeed('10');if(mode==='normal'){resetCube();normalSolveState='idle';readyToSolve=false;}
   window.__rotationStale=scenario==='stale-frame'?30:0;window.__rotationDelay=scenario==='low-fps'?55:0;
   const origin=getCubeSnapshot(),traces=[],inputs=[],captures=[],originalRotate=rotateLayer,originalDraw=renderer.render;let rendering=null;
   rotateLayer=function(axis,layers,angle,duration,move){originalRotate(axis,layers,angle,duration,move);const group=activeRotationGroup,trace={move,axis,target:angle,duration,started:performance.now(),updates:[],frames:[]};traces.push(trace);const advance=updateActiveRotation;updateActiveRotation=function(now){advance(now);trace.updates.push({at:performance.now()-trace.started,angle:group.rotation[axis]});};rendering={group,trace};};
   renderer.render=function(...args){if(rendering&&activeRotationGroup===rendering.group)rendering.trace.frames.push({at:performance.now()-rendering.trace.started,angle:rendering.group.rotation[rendering.trace.axis]});const result=originalDraw.apply(this,args);if(capture&&rendering&&activeRotationGroup===rendering.group&&captures.length<4)captures.push({angle:rendering.group.rotation[rendering.trace.axis],png:renderer.domElement.toDataURL('image/png')});return result;};
   const pairs=['R','U','F','L','D','B'].flatMap(m=>[m,m+"'",m+'2']);
   const moves=capture?['R']:scenario==='alternating'?Array.from({length:24},(_,i)=>i%2?"R'":'R'):pairs;
   for(const move of moves){const at=performance.now();performMove(move);inputs.push({move,at});if(scenario==='single')while(isCubeBusy())await new Promise(r=>setTimeout(r,4));else await new Promise(r=>setTimeout(r,8));}
   while(isCubeBusy())await new Promise(r=>setTimeout(r,5));rotateLayer=originalRotate;renderer.render=originalDraw;window.__rotationDelay=0;window.__rotationStale=0;
   const expected=GuidedSolver.applyAll(origin,moves,getCubeMoveSpec),correct=GuidedSolver.signature(expected)===GuidedSolver.signature(getCubeSnapshot());
   const violations=[];for(const t of traces)for(const field of ['updates','frames']){let previous=0;for(const sample of t[field]){const progress=sample.angle/t.target;if(progress<previous-1e-8||progress< -1e-8||progress>1+1e-8)violations.push({move:t.move,field,previous,progress,at:sample.at});previous=progress;}}
   return {mode,scenario,correct,order:JSON.stringify(traces.map(t=>t.move))===JSON.stringify(moves),violations,traces,captures};
  },{mode,scenario,capture});
  if(capture){for(const [i,frame] of result.captures.entries())fs.writeFileSync(path.join(out,(before?'before':'after')+'-R-frame-'+i+'.png'),Buffer.from(frame.png.split(',')[1],'base64'));fs.writeFileSync(path.join(out,(before?'before':'after')+'-R-capture.json'),JSON.stringify(result.captures.map(({angle})=>({angle})),null,2));result.captures=[];}
  assert(result.correct&&result.order);if(!before)assert.equal(result.violations.length,0,JSON.stringify(result.violations));reports.push(result);console.log(JSON.stringify({before,mode,scenario,moves:result.traces.length,frames:result.traces.reduce((n,t)=>n+t.frames.length,0),violations:result.violations.length,correct:result.correct}));if(mode==='bot')await p.evaluate(()=>BotBattleBridge.leave());
 }
 if(!capture)fs.writeFileSync(path.join(out,before?'before-angles.json':'after-angles.json'),JSON.stringify(reports,null,2));assert.deepEqual(errors,[]);
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
