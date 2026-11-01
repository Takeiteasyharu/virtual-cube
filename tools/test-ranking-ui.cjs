const {chromium}=require('C:/Users/harut/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const live=process.argv.includes('--public'),base=live?'https://stcube3d.com/':'http://localhost:8792/',out=path.join(process.cwd(),'.medal-verification');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{try{let f=path.join(process.cwd(),new URL(req.url,'http://localhost').pathname);if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[path.extname(f)]||'text/plain');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
(async()=>{if(!live)await new Promise(r=>server.listen(8792,r));const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});try{
 for(const width of [1440,1024,390,320]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{localStorage.setItem('stcubeMedalNextSweepV1',String(Number.MAX_SAFE_INTEGER));navigator.serviceWorker.register=async()=>({update:async()=>{},addEventListener(){}});});await p.goto(base);await p.waitForFunction(()=>!!window.RankingView&&!!window.submitOnlineSolve);
  for(const dark of [false,true])for(const n of [0,1,2,3,10,50]){
   const geometry=await p.evaluate(({dark,n})=>{
    document.body.classList.toggle('dark',dark);document.querySelectorAll('.app-modal').forEach(m=>m.hidden=true);document.getElementById('rankingModal').hidden=false;
    const medals=new Map([['U0',{v:1,gold:8,silver:0,bronze:0}],['U1',{v:1,gold:150,silver:100,bronze:100}]]),entries=Array.from({length:n},(_,i)=>({uid:'U'+i,name:i===1?'LongPlayerName_'.repeat(9):i===0?'Waisal Qornih':'Player '+i,time:18.01+i}));
    RankingView.render({podium:document.getElementById('rankingPodium'),list:document.getElementById('onlineRankingList'),entries,medals});
    const panel=document.querySelector('#rankingModal .modal-content'),pod=document.getElementById('rankingPodium'),list=document.getElementById('onlineRankingList');
    const rect=rank=>pod.querySelector('[data-rank="'+rank+'"]')?.getBoundingClientRect(),r1=rect(1),r2=rect(2),r3=rect(3);
    return {widthOk:document.documentElement.scrollWidth<=innerWidth,modalOk:panel.scrollWidth<=panel.clientWidth+1,podium:pod.children.length,rows:list.children.length,ordered:n<3||r2.x<r1.x&&r1.x<r3.x,stepHeights:n<3||(()=>{const h=r=>pod.querySelector('.podium-place-'+r+' .podium-step').getBoundingClientRect().height;return h(1)>h(2)&&h(2)>h(3)})(),rankOnce:[...pod.querySelectorAll('.podium-position'),...list.querySelectorAll('.ranking-position')].map(e=>e.textContent).join(',')===Array.from({length:n},(_,i)=>'#'+(i+1)).join(','),markers:getComputedStyle(list).listStyleType==='none',goldExact:n===0||pod.querySelector('.player-medals').textContent==='🥇'.repeat(8),medalsFull:n<2||pod.querySelector('.podium-place-2 .player-medals').textContent===RankingMedals.symbols(medals.get('U1'))};
   },{dark,n});
   for(const k of ['widthOk','modalOk','ordered','stepHeights','rankOnce','markers','goldExact','medalsFull'])assert(geometry[k],JSON.stringify({width,dark,n,geometry}));assert.equal(geometry.podium,Math.min(n,3));assert.equal(geometry.rows,Math.max(0,n-3));
   if(n===10){await p.locator('#rankingModal .modal-content').evaluate(el=>el.scrollTop=0);await p.waitForTimeout(250);await p.screenshot({path:path.join(out,`${live?'public':'local'}-podium-${width}-${dark?'dark':'light'}.png`)});}
  }
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.podium-place-1').evaluate(el=>getComputedStyle(el).animationName),'none');assert.deepEqual(errors,[]);console.log(JSON.stringify({width,themes:2,counts:[0,1,2,3,10,50],checks:'passed',errors}));await context.close();
 }
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
