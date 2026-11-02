/* Verified historical manifests; no historical solve scans in the browser.
   Planning, storage transactions and presentation remain independent. */
(function(root){
 'use strict';
 const M=root.RankingMedals||(typeof require==='function'?require('./ranking-medals.js'):null);
 const awarded=certificate=>(certificate.winners||[]).filter(w=>certificate.v!==2||(certificate.awardedUids||[]).includes(w.uid));
 function allTargets(rows){
  const byMetric={},union=new Set(),lex=(a,b)=>a<b?-1:a>b?1:0;
  for(const metric of M.metrics){const field=metric==='tps'?'tps':metric==='moves'?'moveCount':'time',direction=metric==='tps'?-1:1;
   const sorted=rows.filter(r=>r.data.valid===true&&r.data.rankingType===(metric==='ao5'?'ao5':'single')&&Object.hasOwn(r.data,field));
   if(sorted.some(r=>r.data[field]!==null&&typeof r.data[field]!=='number'))throw Error('Unsupported Firestore metric type; All membership must not be guessed');
   sorted.sort((a,b)=>direction*((a.data[field]??-Infinity)-(b.data[field]??-Infinity)||lex(a.id,b.id)));
   const seen=new Set();for(const {data:s} of sorted.slice(0,1000)){if(typeof s.uid!=='string'||!s.uid||seen.has(s.uid)||s.mode==='real'||!Number.isFinite(Number(s.time))||Number(s.time)<=2||Number(s.time)>=3600||typeof s.scramble!=='string'||!s.scramble.trim()||(metric==='tps'&&!(Number(s.tps)>0))||(metric==='moves'&&!(Number(s.moveCount)>0)))continue;seen.add(s.uid);if(seen.size===50)break;}
   byMetric[metric]=[...seen];for(const uid of seen)union.add(uid);
  }
  return {byMetric,targets:[...union]};
 }
 function buildPlan(rows,certificates,targets,now,sourceSha256){
  const targetUids=[...new Set(targets)].sort(),wanted=new Set(targetUids),existing=new Map(certificates.map(c=>[c.id,c.data])),events={},skipped=[],conflicts=[],matched=[];
  for(const kind of ['today','week','month'])for(const key of [...new Set(rows.map(r=>r.data[M.fields[kind]]).filter(k=>typeof k==='string'))].sort()){
   let p;try{p=M.period(kind,key);}catch(_){continue;}if(p.end>now)continue;
   for(const metric of M.metrics){const id=M.awardId(kind,key,metric),records=rows.filter(r=>r.data.valid===true&&r.data.rankingType===(metric==='ao5'?'ao5':'single')&&r.data[p.field]===key);let result;
    try{result=M.podium(records,metric,p,0,now);}catch(e){skipped.push({id,reason:e.message});continue;}
    const winners=result.winners.map(({uid,solveId,value})=>({uid,solveId,value})),old=existing.get(id);
    if(old){if(old.status==='finalized'&&JSON.stringify(old.winners)===JSON.stringify(winners))matched.push(id);else conflicts.push(id);continue;}
    const awardedUids=winners.filter(w=>wanted.has(w.uid)).map(w=>w.uid);
    if(!awardedUids.length)continue;
    events[id]={kind,key,metric,startAt:p.start,endAt:p.end,winners,awardedUids};
   }
  }
  const order=Object.keys(events).sort(),counts={gold:0,silver:0,bronze:0},recipients=new Set();
  for(const e of Object.values(events))e.winners.forEach((w,i)=>{if(e.awardedUids.includes(w.uid)){counts[['gold','silver','bronze'][i]]++;recipients.add(w.uid);}});
  return {plan:{v:1,asOf:now,sourceSha256,targetUids,order,events},counts,recipientCount:recipients.size,skipped,conflicts,matched};
 }
 async function run(sdk,db,uid,{canWork=()=>true,maxSteps=2}={}){
  const {doc,getDoc,runTransaction,serverTimestamp,Timestamp}=sdk,ref=(...p)=>doc(db,...p);
  if(!canWork())return {status:'deferred',awarded:0};
  const config=(await getDoc(ref('rankingMedalConfig','history'))).data();if(!config?.planId)return {status:'not-configured',awarded:0};
  const id=config.planId,progressRef=ref('rankingMedalBackfillProgress',id);
  if((await getDoc(progressRef)).data()?.complete)return {status:'complete',awarded:0};
  const plan=(await getDoc(ref('rankingMedalBackfillPlans',id))).data();
  if(plan?.v!==1||!Array.isArray(plan.order)||plan.order.length>100)throw Error('Invalid historical medal manifest');
  let awardedCount=0,processed=0,complete=false;
  for(let step=0;step<maxSteps&&canWork();step++){
   let outcome,attemptedIndex;
   for(let attempt=0;;attempt++)try{outcome=await runTransaction(db,async tx=>{
    const progress=await tx.get(progressRef),index=progress.data()?.nextIndex||0;attemptedIndex=index;if(index>=plan.order.length)return {complete:true,awarded:0};
    const eventId=plan.order[index],proof=plan.events[eventId],certificateRef=ref('rankingMedalPeriods',eventId),certificate=await tx.get(certificateRef);
    if(!proof||!Array.isArray(proof.winners)||!Array.isArray(proof.awardedUids))throw Error('Invalid historical event');
    if(certificate.exists()){
     const old=certificate.data();if(old.status!=='finalized'||JSON.stringify(old.winners)!==JSON.stringify(proof.winners)||(old.v===2&&JSON.stringify(old.awardedUids)!==JSON.stringify(proof.awardedUids)))throw Error('Historical medal certificate conflict');
    }else{
     const winners=proof.winners.filter(w=>proof.awardedUids.includes(w.uid)),totals=await Promise.all(winners.map(w=>tx.get(ref('rankingMedals',w.uid))));
     winners.forEach((w,i)=>{const count=M.counts(totals[i].data()),rank=proof.winners.findIndex(x=>x.uid===w.uid);count[['gold','silver','bronze'][rank]]++;tx.set(ref('rankingMedals',w.uid),{v:1,uid:w.uid,...count,lastPeriodId:eventId,updatedAt:serverTimestamp()});});
     tx.set(certificateRef,{v:2,backfillId:id,...proof,startAt:Timestamp.fromMillis(proof.startAt.toMillis?.()??proof.startAt),endAt:Timestamp.fromMillis(proof.endAt.toMillis?.()??proof.endAt),status:'finalized',problemSolveId:'',finalizedBy:uid,finalizedAt:serverTimestamp()});
    }
    const complete=index+1===plan.order.length;
    tx.set(progressRef,{v:1,planId:id,nextIndex:index+1,complete,updatedAt:serverTimestamp()});
    return {complete,awarded:certificate.exists()?0:proof.awardedUids.length};
   });break;}catch(error){
    if(!['aborted','permission-denied'].includes(error.code))throw error;
    if(attempt>=3||!canWork()){
     // A competing browser may have committed the same canonical certificate.
     // Rules then reject our stale increment before the SDK reports a conflict.
     const latest=(await getDoc(progressRef)).data();
     if(latest?.nextIndex>attemptedIndex)return {status:latest.complete?'complete':'deferred',awarded:awardedCount,processed,contended:true};
     throw error;
    }
    await new Promise(r=>setTimeout(r,40*(attempt+1)));
   }
   processed++;awardedCount+=outcome.awarded;complete=outcome.complete;if(complete)break;
  }
  return {status:complete?'complete':'deferred',awarded:awardedCount,processed};
 }
 const api={allTargets,buildPlan,run,awarded};if(typeof module==='object'&&module.exports)module.exports=api;else root.MedalHistory=api;
})(typeof window==='object'?window:globalThis);
