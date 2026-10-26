/* Pure local-history analysis. No Firebase access, renderer or storage writes. */
(function(root){
 'use strict';
 const finite=v=>typeof v==='number'&&Number.isFinite(v),mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
 function normalize(input){
  if(!Array.isArray(input))return [];
  return input.slice(0,100).map((r,index)=>{
   if(!r||r.mode!=='virtual'||(r.source&&r.source!=='normal')||(r.rankingType&&r.rankingType!=='single')||r.bot||r.isBot||r.practice||r.isPractice||r.guided||r.battle||r.daily||r.replay||r.aborted||['aborted','cancelled','incomplete'].includes(r.status)||r.completed===false)return null;
   const dnf=r.dnf===true||r.status==='dnf'||r.time==='DNF';
   if(!dnf&&(!finite(r.time)||r.time<=0))return null;
   return {id:typeof r.solveId==='string'?r.solveId:null,ownerUid:typeof r.ownerUid==='string'?r.ownerUid:null,legacy:!r.source,
    time:dnf?null:r.time,dnf,tps:!dnf&&finite(r.tps)&&r.tps>=0?r.tps:null,moves:!dnf&&Number.isInteger(r.moveCount)&&r.moveCount>=0?r.moveCount:null,
    date:typeof r.completedAt==='string'?r.completedAt:typeof r.date==='string'?r.date:null,scramble:typeof r.scramble==='string'?r.scramble:null,storageIndex:index};
  }).filter(Boolean).reverse();
 }
 function average(rows,n){
  if(rows.length<n)return {value:null,state:'insufficient'};
  const a=rows.slice(-n).map(r=>r.dnf?Infinity:r.time).sort((a,b)=>a-b).slice(1,-1);
  return a.some(x=>!Number.isFinite(x))?{value:null,state:'dnf'}:{value:mean(a),state:'valid'};
 }
 function analyze(input,{limit=100,ownerUid=null,accountOnly=false}={}){
  const all=normalize(input),owned=accountOnly?all.filter(r=>ownerUid&&r.ownerUid===ownerUid):all;
  let pb=null;const history=[],series=owned.map((row,i)=>{
   const r={...row,order:i+1,ao5:average(owned.slice(0,i+1),5),ao12:average(owned.slice(0,i+1),12)};
   if(!r.dnf&&(pb===null||r.time<pb)){history.push({...r,previous:pb,firstRetained:pb===null});pb=r.time;}
   return r;
  });
  const size=limit==='all'?series.length:Number(limit),rows=series.slice(-Math.max(0,size)),included=new Set(rows.map(r=>r.storageIndex));
  const good=rows.filter(r=>!r.dnf),times=good.map(r=>r.time),tps=good.filter(r=>r.tps!==null).map(r=>r.tps),moves=good.filter(r=>r.moves!==null).map(r=>r.moves);
  return {rows,history:history.filter(r=>included.has(r.storageIndex)),available:all.length,scoped:owned.length,excluded:Math.min(Array.isArray(input)?input.length:0,100)-all.length,
   summary:{total:rows.length,completed:good.length,dnf:rows.length-good.length,average:mean(times),pb:times.length?Math.min(...times):null,tps:mean(tps),bestTps:tps.length?Math.max(...tps):null,moves:mean(moves),minMoves:moves.length?Math.min(...moves):null}};
 }
 function replayAvailable(row,replay){return !!(row?.id&&replay?.solveId===row.id&&!row.dnf&&row.scramble===replay.scramble&&Math.round(row.time*1000)===replay.ms&&row.moves===replay.count&&row.ownerUid=== (replay.ownerUid||null));}
 function ownerUidFor(stats,identity){const current=identity?.uid||null,start=Object.hasOwn(stats,'ownerUid')?stats.ownerUid:current;return start===current?current:null;}
 function chartScale(values,focus=true){
  const sorted=values.filter(v=>finite(v)&&v>=0).sort((a,b)=>a-b),maximum=sorted.at(-1)||1;
  let shown=maximum,focused=false;
  if(focus&&sorted.length>=8){
   const quantile=p=>{const i=(sorted.length-1)*p,j=Math.floor(i);return sorted[j]+(sorted[Math.ceil(i)]-sorted[j])*(i-j);};
   const median=quantile(.5),q1=quantile(.25),q3=quantile(.75),iqr=q3-q1;
   if(maximum>Math.max(median*10,q3+6*iqr)){
    const typical=sorted.filter(v=>v<=Math.max(median*3,q3+3*iqr));
    if(typical.length>=Math.max(5,sorted.length*.75)){shown=typical.at(-1)||1;focused=true;}
   }
  }
  const top=Math.min(Number.MAX_VALUE,Math.max(1,shown)*1.12);
  return {top,focused,clipped:sorted.filter(v=>v>top).length,maximum};
 }
 function tickLabel(value){return value>=1e6?(value/1e6).toFixed(1)+'M':value>=1000?(value/1000).toFixed(1)+'k':value.toFixed(1);}
 const api={normalize,average,analyze,replayAvailable,ownerUidFor,chartScale,tickLabel};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.SolveAnalytics=api;
})(typeof window==='object'?window:globalThis);
