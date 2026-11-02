const {chromium}=require('C:/Users/harut/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),http=require('http'),assert=require('assert/strict');
const server=http.createServer((req,res)=>{
 if(req.url==='/player-presence.js'||req.url==='/toy-room.css'){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync('.'+req.url));return;}
 res.setHeader('Content-Type','text/html');res.end('<link rel="stylesheet" href="/toy-room.css"><body><div class="app-modal" hidden></div><script src="/player-presence.js"></script>');
});
async function setup(page,uid='self'){
 await page.goto('http://localhost:8797/');await page.evaluate(uid=>{
 window.writes=0;window.opened=0;
 const sdk={setDoc:async()=>{writes++;},doc(){},serverTimestamp(){},query(){},collection(){},where(){},orderBy(){},limit(){},Timestamp:{fromMillis(){}},onSnapshot(q,fn){window.emit=(rows)=>fn({docs:rows.map(([id,at])=>({id,data:()=>({lastSeen:{toMillis:()=>at}})}))});return()=>{};}};
 window.controller=PlayerPresence.create({sdk,db:{},openBattle:()=>opened++});controller.setUser({uid});
 },uid);await page.waitForFunction(()=>!!window.emit);
}
const visible=p=>p.locator('.presence-toast').isVisible();
(async()=>{await new Promise(r=>server.listen(8797,r));const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const width of [1440,390,320]){const context=await browser.newContext({viewport:{width,height:844}}),p=await context.newPage();await setup(p);
 for(const dark of [false,true]){
 await p.evaluate(dark=>{document.body.classList.toggle('dark',dark);emit([['self',Date.now()]]);},dark);assert(!await visible(p));
 await p.evaluate(()=>emit([['other',Date.now()]]));assert(await visible(p));
 assert(await p.evaluate(()=>{const r=document.querySelector('.presence-toast').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth;}));
 await p.locator('[data-close]').click();await p.evaluate(()=>emit([['other',Date.now()]]));assert(!await visible(p));
 for(const busy of ['solving','inspection-active','battle-mode','guided-mode']){
 await p.evaluate(busy=>{emit([]);document.body.classList.add(busy);emit([['other',Date.now()]]);},busy);assert(!await visible(p));
 await p.evaluate(busy=>document.body.classList.remove(busy),busy);await p.waitForFunction(()=>!document.querySelector('.presence-toast').hidden);await p.locator('[data-close]').click();
 }
 await p.evaluate(()=>{emit([]);document.querySelector('.app-modal').hidden=false;emit([['other',Date.now()]]);});assert(!await visible(p));
 await p.evaluate(()=>document.querySelector('.app-modal').hidden=true);await p.waitForFunction(()=>!document.querySelector('.presence-toast').hidden);
 await p.locator('[data-find]').click();assert(!await visible(p));
 await p.evaluate(()=>{emit([]);emit([['other',Date.now()-91000]]);});assert(!await visible(p));
 }
 await p.evaluate(()=>{emit([]);emit([['other',Date.now()]]);});await p.waitForTimeout(6200);assert(!await visible(p));
 const other=await context.newPage();await other.goto('http://localhost:8797/');await other.evaluate(()=>{window.writes=0;window.controller=PlayerPresence.create({db:{},sdk:{setDoc:async()=>{window.writes++;},doc(){},serverTimestamp(){},query(){},collection(){},where(){},orderBy(){},limit(){},Timestamp:{fromMillis(){}},onSnapshot(){return()=>{};}},openBattle(){}});controller.setUser({uid:'self'});});await other.waitForTimeout(250);assert.equal(await other.evaluate(()=>writes),0);
 await p.evaluate(()=>controller.dispose());await other.waitForFunction(()=>writes===1);await other.evaluate(()=>controller.dispose());
 console.log(JSON.stringify({width,themes:2,selfExcluded:true,staleExcluded:true,noRepeat:true,deferred:true,cta:true,autoHide:true,oneTabLeader:true}));await context.close();
 }
 if(process.argv.includes('--firestore')){
 const {initializeTestEnvironment}=require('@firebase/rules-unit-testing'),sdk=require('firebase/firestore');
 const env=await initializeTestEnvironment({projectId:'demo-stcube-presence-browser',firestore:{host:'127.0.0.1',port:8780,rules:fs.readFileSync('firestore.rules','utf8')}});
 const ca=await browser.newContext(),cb=await browser.newContext(),a=await ca.newPage(),b=await cb.newPage();
 try{
 async function real(p,uid){await p.goto('http://localhost:8797/');await p.evaluate(async uid=>{
 const {initializeApp}=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
 const sdk=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
 const db=sdk.getFirestore(initializeApp({projectId:'demo-stcube-presence-browser',apiKey:'demo',appId:'demo'}));
 sdk.connectFirestoreEmulator(db,'127.0.0.1',8780,{mockUserToken:{sub:uid}});
 window.controller=PlayerPresence.create({db,sdk,openBattle:()=>window.opened=true});controller.setUser({uid});
 },uid);}
 await real(a,'alice');await a.waitForTimeout(1000);assert(!await visible(a));
 await real(b,'bob');await a.waitForFunction(()=>!document.querySelector('.presence-toast').hidden);assert(await visible(a));
 await a.locator('[data-close]').click();await a.waitForTimeout(500);assert(!await visible(a));
 await env.withSecurityRulesDisabled(async c=>sdk.setDoc(sdk.doc(c.firestore(),'playerPresence/bob'),{v:1,lastSeen:sdk.Timestamp.fromMillis(Date.now()-91000)}));
 await a.waitForTimeout(500);
 await env.withSecurityRulesDisabled(async c=>sdk.setDoc(sdk.doc(c.firestore(),'playerPresence/bob'),{v:1,lastSeen:sdk.Timestamp.now()}));
 await a.waitForFunction(()=>!document.querySelector('.presence-toast').hidden);
 await a.locator('[data-find]').click();assert(await a.evaluate(()=>opened));
 console.log(JSON.stringify({realFirestoreTwoClients:true,selfExcluded:true,otherArrivalNotified:true,expiredThenReturnNotifies:true,cta:true}));
 }finally{await ca.close();await cb.close();await env.cleanup();}
 }
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
