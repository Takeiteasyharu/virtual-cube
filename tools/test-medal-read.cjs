// Read-only production medal fetch, followed by local DOM presentation checks.
const cp=require('child_process'),assert=require('assert/strict');
const {chromium}=require('C:/Users/harut/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const audit=JSON.parse(cp.execFileSync(process.execPath,['tools/audit-top-medals.cjs'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
 try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('stcubeMedalNextSweepV1',String(Number.MAX_SAFE_INTEGER));navigator.serviceWorker.register=async()=>({update:async()=>{},addEventListener(){}});});
 await p.route('**/online.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nwindow.__readMedals=loadMedalTotals;'});});
 await p.goto('https://stcube3d.com/');await p.waitForFunction(()=>!!window.__readMedals);
 const result=await p.evaluate(async audit=>{
 const uidList=[...audit.top.map(p=>p.uid),...audit.totals.map(p=>p.uid)],loaded=await __readMedals(uidList,true);
 if(loaded.status!=='available')throw Error('Medal read unavailable');
 for(const t of audit.totals){const actual=RankingMedals.counts(loaded.totals.get(t.uid));for(const k of ['gold','silver','bronze'])if(actual[k]!==t[k])throw Error('Total mismatch '+k);}
 for(const top of audit.top){const actual=RankingMedals.counts(loaded.totals.get(top.uid)),expected=RankingMedals.counts(top.saved);for(const k of ['gold','silver','bronze'])if(actual[k]!==expected[k])throw Error('Top saved total mismatch');}
 let cases=0;
 for(const dark of [false,true])for(const period of ['all','today','week','month'])for(const type of ['single','ao5','tps','moves']){
 document.body.classList.toggle('dark',dark);document.getElementById('rankingModal').hidden=false;
 const entries=audit.totals.map((t,i)=>({uid:t.uid,name:'Stored medal recipient '+i,time:20+i,tps:3,moveCount:60}));
 RankingView.render({podium:document.getElementById('rankingPodium'),list:document.getElementById('onlineRankingList'),entries,type,medals:loaded.totals});
 const spans=[...document.querySelectorAll('#rankingPodium .player-medals,#onlineRankingList .player-medals')];
 if(spans.length!==entries.length)throw Error('Missing medal span '+period+' '+type);
 spans.forEach((s,i)=>{if(s.textContent!==RankingMedals.symbols(audit.totals[i]))throw Error('Symbol count mismatch');});
 document.getElementById('rankingModal').hidden=true;
 for(const recipient of audit.totals){ProfileView.render(document.getElementById('profileBody'),{name:'Stored recipient',guest:true,account:{rating:1200},stats:null,detail:null,ranks:{},real:[],medals:loaded.totals.get(recipient.uid),medalStatus:'available'});
 if(document.querySelector('#profileBody .player-medals').textContent!==RankingMedals.symbols(recipient))throw Error('Profile mismatch');}cases++;
 }
 return {publicSdkRead:true,topThreeMatchSaved:true,storedRecipients:audit.totals.length,presentationCases:cases};
 },audit);assert.deepEqual(errors,[]);console.log(JSON.stringify({width,...result,errors}));await context.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
