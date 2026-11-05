// Local Auth + Firestore Emulators only. Never uses production identities/data.
const {chromium}=require('C:/Users/harut/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),project='demo-stcube-auth-browser';
const server=http.createServer((req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const name=pathname==='/'?'index.html':pathname.slice(1),file=path.resolve(root,name);
 if(!file.startsWith(root+path.sep))throw Error('outside fixture');
 let data=fs.readFileSync(file);
 if(name==='online.js')data=String(data)
  .replace('const config = window.CUBE_FIREBASE_CONFIG || {};',`const config={projectId:'${project}',apiKey:'demo-key',authDomain:'localhost',appId:'demo-app'};`)
  .replace('auth = getAuth(app);',`auth = getAuth(app); connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});`)
  .replace('db = getFirestore(app);',`db = getFirestore(app); connectFirestoreEmulator(db,'127.0.0.1',8780);`)
  + `\nimport {connectAuthEmulator} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';\nimport {connectFirestoreEmulator} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';\nwindow.__authFixture={auth,loginAsGuest,linkGoogleAccount};`;
 res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'})[path.extname(name)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
 }catch{res.writeHead(404).end();}});
(async()=>{
 await new Promise(resolve=>server.listen(8779,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
 let checks=0;
 try{
 fs.mkdirSync(path.join(root,'.auth-verification'),{recursive:true});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',isMobile:width<600,hasTouch:width<600});
  await context.addInitScript(()=>{localStorage.setItem('stcubeMedalNextSweepV1',String(Number.MAX_SAFE_INTEGER));navigator.serviceWorker.register=async()=>({update:async()=>{},addEventListener(){}});});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8779/');
  await page.waitForFunction(()=>window.__authFixture&&document.getElementById('signedOutAuth').hidden===false);
  if(await page.locator('#dismissBeginnerTipBtn').isVisible())await page.locator('#dismissBeginnerTipBtn').click();
  assert.equal(await page.evaluate(()=>__authFixture.auth.currentUser),null);checks++;
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks++;
  let confirmations=0,allowImport=true;page.on('dialog',async dialog=>{if(dialog.type()==='confirm')confirmations++;if(allowImport)await dialog.accept();else await dialog.dismiss();});
  await page.evaluate(width=>localStorage.setItem('virtualCubeSolveHistory',JSON.stringify([{solveId:'auth-browser-history-'+width,mode:'virtual',source:'normal',time:24,moveCount:48,tps:2,scramble:'R U F2',completedAt:'2026-01-01T12:00:00.000Z'}])),width);
  await page.locator('#playerNameInput').fill('Guest Fixture');await page.locator('#guestLoginBtn').click();
  await page.waitForFunction(()=>__authFixture.auth.currentUser?.isAnonymous&&document.getElementById('signedOutAuth').hidden);
  const uid=await page.evaluate(()=>__authFixture.auth.currentUser.uid);
  let stored;
  for(let attempt=0;attempt<100;attempt++){
   stored=await page.evaluate(async width=>{const s=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');const row=(await s.getDoc(s.doc(STcubeDailyConnection.db,'solves','import_auth-browser-history-'+width+'_single'))).data();return row?{uid:row.uid,date:row.solvedAt.toMillis()}:null;},width);
   if(stored)break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert(stored,'import must be committed, not merely queued');
  assert.equal(confirmations,1,'shared-history confirmation at width '+width);checks++;
  assert.deepEqual(stored,{uid,date:Date.parse('2026-01-01T12:00:00.000Z')});checks++;
  assert(await page.locator('#linkGoogleBtn').isVisible());checks++;
  for(const dark of [false,true]){
   await page.evaluate(value=>document.body.classList.toggle('dark',value),dark);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.join(root,'.auth-verification',`guest-${width}-${dark?'dark':'light'}.png`),fullPage:true});
  }
  await page.reload();await page.waitForFunction(()=>window.__authFixture?.auth.currentUser);
  assert.equal(await page.evaluate(()=>__authFixture.auth.currentUser.uid),uid);checks++;
  await page.evaluate(async()=>{
   const s=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
   const token=JSON.stringify({sub:'google-fixture-'+__authFixture.auth.currentUser.uid,email:'fixture-'+__authFixture.auth.currentUser.uid+'@example.test',email_verified:true,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600});
   sessionStorage.setItem('fixture-google-token',token);
   await s.linkWithCredential(__authFixture.auth.currentUser,s.GoogleAuthProvider.credential(token));
   location.reload();
  });
  await page.waitForFunction(()=>window.__authFixture?.auth.currentUser&&!__authFixture.auth.currentUser.isAnonymous);
  assert.equal(await page.evaluate(()=>__authFixture.auth.currentUser.uid),uid);checks++;
  assert.equal(await page.locator('#signedOutAuth').isVisible(),false);assert.equal(await page.locator('#linkGoogleBtn').isVisible(),false);checks++;
  await page.evaluate(async()=>{const s=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');await s.signOut(__authFixture.auth);});
  await page.waitForFunction(()=>!document.getElementById('signedOutAuth').hidden);checks++;
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('virtualCubeSolveHistory')).length),1);checks++;
  allowImport=false;
  await page.evaluate(width=>{const rows=JSON.parse(localStorage.getItem('virtualCubeSolveHistory'));rows.push({solveId:'declined-browser-history-'+width,mode:'virtual',source:'normal',time:25,moveCount:50,tps:2,scramble:'R U',completedAt:'2026-01-02T12:00:00.000Z'});localStorage.setItem('virtualCubeSolveHistory',JSON.stringify(rows));},width);
  await page.locator('#playerNameInput').fill('Second Guest');await page.locator('#guestLoginBtn').click();
  await page.waitForFunction(()=>{const user=__authFixture.auth.currentUser;return !!user&&localStorage.getItem('stcube-history-consent-'+user.uid)==='no';});
  const declined=await page.evaluate(async width=>{const s=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');return (await s.getDoc(s.doc(STcubeDailyConnection.db,'solves','import_declined-browser-history-'+width+'_single'))).exists();},width);
  assert.equal(declined,false);checks++;
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('virtualCubeSolveHistory')).length),2);checks++;
  const collision=await page.evaluate(async()=>{
   const s=await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),before=__authFixture.auth.currentUser.uid;
   try{await s.linkWithCredential(__authFixture.auth.currentUser,s.GoogleAuthProvider.credential(sessionStorage.getItem('fixture-google-token')));throw Error('Collision unexpectedly linked');}
   catch(error){return {code:error.code,uid:__authFixture.auth.currentUser.uid,before,guest:__authFixture.auth.currentUser.isAnonymous};}
  });
  assert.equal(collision.code,'auth/credential-already-in-use');assert.equal(collision.uid,collision.before);assert(collision.guest);checks++;
  assert.deepEqual(errors,[]);checks++;
  await context.close();
 }
 console.log(JSON.stringify({checks,passed:checks,productionWrites:0}));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
