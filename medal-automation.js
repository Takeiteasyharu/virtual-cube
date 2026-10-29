/* Client-assisted certificates. Rules bound writes but cannot prove a global rank.
   Storage adapter is injected so a future trusted worker can reuse the model. */
(function(root){
 'use strict';
 const M=root.RankingMedals||(typeof require==='function'?require('./ranking-medals.js'):null);
 function create(sdk,db,uid,options={}){
  const {doc,getDoc,getDocs,collection,query,where,orderBy,startAfter,limit,runTransaction,Timestamp,serverTimestamp}=sdk;
  const now=options.now||Date.now,tracking=options.trackingStart||M.TRACKING_START,canWork=options.canWork||(()=>true),pageSize=10,maxReads=options.maxReads||1000;
  let reads=0;const ref=(...parts)=>doc(db,...parts),zero=()=>Timestamp.fromMillis(0),at=n=>Timestamp.fromMillis(n);
  const stamp=()=>serverTimestamp(),periodFor=(kind,start)=>M.period(kind,M.keys(start)[kind]);
  async function claim(kind){
   if(!canWork())return null;
   const jobRef=ref('rankingMedalJobs',kind);
   return runTransaction(db,async tx=>{const snapshot=await tx.get(jobRef),old=snapshot.data(),start=old?old.nextStart.toMillis():M.first(kind,tracking),p=periodFor(kind,start);
    if(p.end>now()||(old?.leaseUid&&old.leaseUntil.toMillis()>now()))return null;
    tx.set(jobRef,{v:1,kind,nextStart:at(start),leaseUid:uid,leaseUntil:at(now()+60000),updatedAt:stamp()});return p;
   });
  }
  async function release(p){const jobRef=ref('rankingMedalJobs',p.kind);await runTransaction(db,async tx=>{const s=await tx.get(jobRef),j=s.data();if(j?.leaseUid===uid&&j.nextStart.toMillis()===p.start)tx.update(jobRef,{leaseUid:'',leaseUntil:zero(),updatedAt:stamp()});});}
  async function candidates(p,metric){
   const result=[],seen=new Set(),field=metric==='tps'?'tps':metric==='moves'?'moveCount':'time',type=metric==='ao5'?'ao5':'single';let cursor=null;
   for(;;){
    if(!canWork()||reads>=maxReads)return {deferred:true};
    const requested=Math.min(pageSize,maxReads-reads);
    const snapshot=await getDocs(query(collection(db,'solves'),where('rankingType','==',type),where('valid','==',true),where(p.field,'==',p.key),orderBy(field,metric==='tps'?'desc':'asc'),...(cursor?[startAfter(cursor)]:[]),limit(requested)));reads+=Math.max(1,snapshot.size);
    for(const d of snapshot.docs){const raw=d.data(),row={id:d.id,data:{...raw,createdAt:raw.createdAt?.toMillis?.()??raw.createdAt}};
     try{const one=M.podium([row],metric,p,M.first('today',tracking),now());if(one.winners.length&&!seen.has(raw.uid)){seen.add(raw.uid);result.push(one.winners[0]);if(result.length===3)return {status:'finalized',winners:result.map(({uid,solveId,value})=>({uid,solveId,value})),problemSolveId:''};}}
     catch(error){return {status:'unverifiable',winners:[],problemSolveId:d.id};}
    }
    if(snapshot.size<requested)return {status:result.length?'finalized':'empty',winners:result.map(({uid,solveId,value})=>({uid,solveId,value})),problemSolveId:''};
    cursor=snapshot.docs.at(-1);if(!cursor)return {status:'empty',winners:[],problemSolveId:''};
   }
  }
  async function finalize(p,metric){
   const id=p.id+'_'+metric,certRef=ref('rankingMedalPeriods',id);if((await getDoc(certRef)).exists())return 'already-finalized';
   const data=await candidates(p,metric);if(data.deferred)return 'deferred';if(!canWork())return 'deferred';
   for(let attempt=0;;attempt++)try{return await runTransaction(db,async tx=>{
    const [cert,job]=await Promise.all([tx.get(certRef),tx.get(ref('rankingMedalJobs',p.kind))]);if(cert.exists())return 'already-finalized';const j=job.data();if(j?.leaseUid!==uid||j.nextStart.toMillis()!==p.start||j.leaseUntil.toMillis()<=now())return 'lease-lost';
    const totals=await Promise.all(data.winners.map(w=>tx.get(ref('rankingMedals',w.uid))));
    for(let i=0;i<data.winners.length;i++){const w=data.winners[i],count=M.counts(totals[i].data());count[['gold','silver','bronze'][i]]++;tx.set(ref('rankingMedals',w.uid),{v:1,uid:w.uid,...count,lastPeriodId:id,updatedAt:stamp()});}
    tx.set(certRef,{v:1,kind:p.kind,key:p.key,metric,startAt:at(p.start),endAt:at(p.end),...data,finalizedBy:uid,finalizedAt:stamp()});return data.status;
   });}catch(error){
    // Cross-period counter contention can be surfaced as permission-denied by
    // optimistic Rules evaluation before the SDK reports a write conflict.
    // Re-read the certificate, lease and totals; never retry stale increments.
    if(attempt>=3||!canWork()||!['permission-denied','aborted'].includes(error.code))throw error;
    await new Promise(resolve=>setTimeout(resolve,40*(attempt+1)));
   }
  }
  async function advance(p){return runTransaction(db,async tx=>{const jobRef=ref('rankingMedalJobs',p.kind),[job,...certs]=await Promise.all([tx.get(jobRef),...M.metrics.map(m=>tx.get(ref('rankingMedalPeriods',p.id+'_'+m)))]);const j=job.data();if(j?.leaseUid!==uid||j.nextStart.toMillis()!==p.start||!certs.every(s=>s.exists()))return false;tx.update(jobRef,{nextStart:at(p.end),leaseUid:'',leaseUntil:zero(),updatedAt:stamp()});return true;});}
  async function step(kind){const p=await claim(kind);if(!p)return {kind,status:'waiting'};try{for(const metric of M.metrics){const result=await finalize(p,metric);if(['deferred','lease-lost'].includes(result))return {kind,key:p.key,status:result};}return {kind,key:p.key,status:await advance(p)?'advanced':'deferred'};}finally{await release(p).catch(()=>{});}}
  async function sweep(){const results=[];for(let round=0;round<2;round++)for(const kind of ['today','week','month']){if(!canWork()||reads>=maxReads)return {results,reads,deferred:true};results.push(await step(kind));}return {results,reads};}
  return {claim,finalize,advance,release,step,sweep,candidates,get reads(){return reads;}};
 }
 // No listener or polling loop: one bounded idle pass per page visit. Persistent
 // cursors recover older unfinished periods on later visits, oldest first.
 async function start({ensureConnection,sdk}){
  if(Date.now()<M.first('today')+86400000)return;
  const canWork=()=>!document.hidden&&!document.body.classList.contains('solving')&&!root.isTimerRunning?.()&&!root.isCubeBusy?.()&&!root.isBattleMode?.()&&!root.DailyChallenge?.active&&!root.GuidedSolve?.active&&!root.SolveReplay?.active;
  const work=async()=>{if(!canWork())return;let connection;
   try{let cache=0;try{cache=Number(localStorage.getItem('stcubeMedalNextSweepV1')||0);}catch(_){}if(cache>Date.now())return;
    connection=await ensureConnection();const runner=create(sdk,connection.db,connection.uid,{canWork});const result=await runner.sweep();api.lastRun=result;
    const pending=result.deferred||result.results.some(r=>['deferred','lease-lost'].includes(r.status));try{localStorage.setItem('stcubeMedalNextSweepV1',String(Date.now()+(pending?60000:300000)));}catch(_){}
    if(result.results.some(r=>r.status==='advanced'))root.dispatchEvent(new Event('stcube:medals-updated'));
   }catch(error){api.lastError=error.code||error.message;console.warn('Medal catch-up deferred',api.lastError);}finally{await connection?.release?.();}
  };
  const dispatch=()=>{if(root.requestIdleCallback)root.requestIdleCallback(work,{timeout:10000});else setTimeout(work,0);};
  if(navigator.locks)await navigator.locks.request('stcube-medal-catchup',{ifAvailable:true},async lock=>{if(lock)await new Promise(resolve=>{setTimeout(async()=>{await work();resolve();},3000);});});else setTimeout(dispatch,3000);
 }
 const api={create,start,lastRun:null,lastError:null};if(typeof module==='object'&&module.exports)module.exports=api;else root.MedalAutomation=api;
})(typeof window==='object'?window:globalThis);
