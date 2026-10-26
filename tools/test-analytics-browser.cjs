const {chromium}=require('C:/Users/harut/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),live=process.argv.includes('--public'),base=live?'https://stcube3d.com':'http://127.0.0.1:8779';
const server=http.createServer((req,res)=>{try{const name=new URL(req.url,base).pathname;let file=path.join(root,name);if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
async function turn(p,m){await p.evaluate(m=>performMove(m),m);await p.waitForFunction(()=>!isCubeBusy());}
(async()=>{if(!live)await new Promise(r=>server.listen(8779,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});try{
 fs.mkdirSync(path.join(root,'.bot-verification'),{recursive:true});
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',hasTouch:width<600,isMobile:width<600}),p=await context.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{navigator.serviceWorker.register=async()=>({update:async()=>{},addEventListener(){}});});
  await p.goto(base);await p.waitForFunction(()=>!!window.AnalyticsView&&!!window.submitOnlineSolve);if(await p.locator('#dismissBeginnerTipBtn').isVisible())await p.locator('#dismissBeginnerTipBtn').click();
  assert(await p.locator('#openAnalyticsBtn').isVisible());await p.locator('#openAnalyticsBtn').click();assert.match(await p.locator('#analyticsDetails').innerText(),/Complete a normal virtual solve/);await p.locator('#analyticsClose').click();
  if(!live){
   await p.evaluate(()=>{
    const history=Array.from({length:70},(_,i)=>({solveId:'fixture-'+i,mode:'virtual',source:'normal',ownerUid:i<20?'account-a':'account-b',time:20+i%15,tps:2+i/100,moveCount:40+i,date:'Saved date '+i,scramble:'R U'}));history.splice(5,0,{mode:'virtual',source:'normal',dnf:true,time:'DNF',date:'Saved DNF date'});
    history[35].time=67792;history[35].tps=0;
    history.push({mode:'virtual',source:'bot',time:1},{mode:'real',source:'normal',time:2});localStorage.setItem('virtualCubeSolveHistory',JSON.stringify(history));window.getAnalyticsIdentity=()=>null;
   });
   await p.locator('#openAnalyticsBtn').click();assert.match(await p.locator('#analyticsCoverage').innerText(),/71 available/);
   for(const [value,count]of [['10','10'],['50','50'],['100','71'],['all','71']]){await p.locator('#analyticsRange').selectOption(value);assert.equal(await p.locator('#analyticsOverview strong').first().innerText(),count);}
   assert(Number(await p.locator('#analyticsTimeChart svg').getAttribute('data-scale-top'))<100);assert.equal(await p.locator('#analyticsTimeChart .analytics-outlier').count(),1);
   const average=await p.locator('#analyticsOverview strong').nth(1).innerText();await p.locator('[data-review]').click();assert.match(await p.locator('#analyticsDetails').innerText(),/67792\.00/);assert.match(await p.locator('#analyticsDetails').innerText(),/has not been converted or excluded/);
   await p.locator('#analyticsTimeScale').selectOption('full');assert(Number(await p.locator('#analyticsTimeChart svg').getAttribute('data-scale-top'))>67792);assert.equal(await p.locator('#analyticsTimeChart .analytics-outlier').count(),0);assert.equal(await p.locator('#analyticsOverview strong').nth(1).innerText(),average);
   assert(await p.locator('#analyticsTimeChart svg').evaluate(svg=>[...svg.querySelectorAll('.analytics-axis')].every(t=>t.getBBox().x>=0)));
   await p.locator('#analyticsTimeScale').selectOption('focus');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('virtualCubeSolveHistory')).filter(r=>r.time===67792).length),1);
   for(const metric of ['ao5','ao12','time']){await p.locator('#analyticsTimeMetric').selectOption(metric);assert(await p.locator('#analyticsTimeChart svg').isVisible());}
   const plot=p.locator('#analyticsTimeChart svg'),box=await plot.boundingBox(),units=Number(await plot.getAttribute('data-width'));await plot.click({position:{x:50/units*box.width,y:60}});assert.match(await p.locator('#analyticsDetails').innerText(),/Saved date 69/);
   assert.equal(await p.locator('#analyticsReplayBtn').count(),0);
   const svg=p.locator('#analyticsTimeChart svg');await svg.focus();await p.keyboard.press('ArrowRight');assert.match(await p.locator('#analyticsDetails').innerText(),/Saved date 68/);await p.keyboard.press('Space');assert(await p.locator('#analyticsModal').isVisible());assert.equal(await p.evaluate(()=>isTimerRunning()),false);
   for(const dark of [false,true]){await p.evaluate(d=>{document.body.classList.toggle('dark',d);document.querySelector('.analytics-content').scrollTop=0;},dark);assert.equal(await p.evaluate(()=>{const m=document.querySelector('.analytics-content');return m.scrollWidth>m.clientWidth+1||document.documentElement.scrollWidth>innerWidth}),false);await p.screenshot({path:path.join(root,'.bot-verification',`analytics-${width}-${dark}.png`)});}
   await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>AnalyticsView.active),false);
   await p.evaluate(()=>window.getAnalyticsIdentity=()=>({uid:'account-a',type:'Google'}));await p.locator('#openAnalyticsBtn').click();assert.equal(await p.locator('#analyticsOverview strong').first().innerText(),'20');await p.locator('#analyticsClose').click();
   await p.evaluate(()=>window.getAnalyticsIdentity=()=>({uid:'unknown-account',type:'Guest'}));await p.locator('#openAnalyticsBtn').click();assert.equal(await p.locator('#analyticsOverview strong').first().innerText(),'0');assert.match(await p.locator('#analyticsDetails').innerText(),/No identified solves/);await p.locator('#analyticsScope').selectOption('device');assert.equal(await p.locator('#analyticsOverview strong').first().innerText(),'71');await p.locator('#analyticsClose').click();
   await p.evaluate(()=>{localStorage.setItem('virtualCubeSolveHistory','[]');window.getAnalyticsIdentity=()=>null;renderStats();});
  }
  await p.evaluate(async()=>{setAnimationSpeed('20');lockedScramble='R U F2';await scrambleCube();});await p.waitForFunction(()=>!normalScramblePreparing);await turn(p,'F2');await p.waitForTimeout(2200);await turn(p,"U'");await turn(p,"R'");await p.waitForFunction(()=>getSolves('virtual').length===1&&!!SolveReplay.data?.solveId);
  const original=await p.evaluate(()=>({cube:GuidedSolver.signature(getCubeSnapshot()),timer:document.getElementById('timerDisplay').textContent,id:getSolves('virtual')[0].solveId}));
  await p.locator('#openAnalyticsBtn').click();assert.equal(await p.locator('#analyticsOverview strong').first().innerText(),'1');assert(await p.locator('#analyticsReplayBtn').isVisible());await p.locator('#analyticsReplayBtn').click();assert(await p.locator('#replayModal').isVisible());await p.locator('#replayPlay').click();await p.waitForTimeout(100);await p.locator('#replayClose').click();
  assert.equal(await p.evaluate(()=>GuidedSolver.signature(getCubeSnapshot())),original.cube);assert.equal(await p.locator('#timerDisplay').innerText(),original.timer);
  await p.reload();await p.waitForFunction(()=>!!window.AnalyticsView&&!!SolveReplay.data);await p.locator('#openAnalyticsBtn').click();assert(await p.locator('#analyticsReplayBtn').isVisible());await p.locator('#analyticsClose').click();
  for(let i=0;i<4;i++){await p.locator('#openAnalyticsBtn').click();await p.locator('#analyticsClose').click();}assert.equal(await p.locator('#analyticsTimeChart svg').count(),0);assert.deepEqual(errors,[]);
  const overlap=await p.evaluate(()=>{const a=[...document.querySelectorAll('header .header-action')].map(e=>e.getBoundingClientRect());return a.some((r,i)=>a.slice(i+1).some(s=>r.left<s.right-1&&r.right>s.left+1&&r.top<s.bottom-1&&r.bottom>s.top+1));});assert.equal(overlap,false);
  console.log(JSON.stringify({production:live,width,emptyState:true,rangeAndCharts:!live,accountIsolation:!live,replayExactId:true,replayReload:true,noPlayCubeChanges:true,menuNoOverlap:true,closeReleasesCharts:true,errors}));await context.close();
 }
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
