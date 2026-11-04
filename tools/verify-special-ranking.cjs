// Read-only: compare the frozen targets against the production UI's own reader.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/harut/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const file=process.argv[2];if(!file)throw Error('Snapshot required');
(async()=>{const {plan}=JSON.parse(fs.readFileSync(file)),browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});try{
 const context=await browser.newContext({serviceWorkers:'block'}),p=await context.newPage();
 await p.addInitScript(()=>{localStorage.setItem('stcubeMedalNextSweepV1',String(Number.MAX_SAFE_INTEGER));navigator.serviceWorker.register=async()=>({update:async()=>{},addEventListener(){}});});
 await p.route('**/online.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+'\nwindow.__readSpecialRanking=getRankingEntries;'});});
 await p.goto('https://stcube3d.com/');await p.waitForFunction(()=>!!window.__readSpecialRanking);
 const result=await p.evaluate(async plan=>{
 const actual=[];for(const metric of ['single','ao5','moves','tps']){const rows=(await __readSpecialRanking(metric,'all',true)).slice(0,3);rows.forEach((s,i)=>actual.push({metric,rank:i+1,uid:s.uid,value:Number(s[metric==='tps'?'tps':metric==='moves'?'moveCount':'time'])}));}
 return actual;
 },plan);
 assert.deepEqual(result,plan.awards.map(({metric,rank,uid,value})=>({metric,rank,uid,value})));
 console.log(JSON.stringify({productionUiMatchesFixedSnapshot:true,awards:12,readOnly:true,readTime:plan.readTime}));await context.close();
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
