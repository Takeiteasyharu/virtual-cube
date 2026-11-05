/* Deterministic, account-aware local import preparation. No network or rendering. */
(function(root){
 'use strict';
 function timeOf(r){const value=r.completedAt||r.solvedAt||r.date;return typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)?Date.parse(value):NaN;}
 function base(r,uid){return r&&(!r.ownerUid||r.ownerUid===uid)&&(!r.syncOwnerUid||r.syncOwnerUid===uid)&&r.mode==='virtual'&&(!r.source||r.source==='normal')&&typeof r.scramble==='string'&&r.scramble.trim()&&Number.isFinite(timeOf(r))&&timeOf(r)<=Date.now();}
 function allowed(r,uid){return base(r,uid)&&!r.dnf&&Number.isFinite(r.time)&&r.time>2&&r.time<3600;}
 async function digest(value){const bytes=new TextEncoder().encode(value),hash=await root.crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');}
 async function prepare(rows,uid){
 const sorted=rows.map((r,index)=>({r,index})).sort((a,b)=>timeOf(a.r)-timeOf(b.r)||b.index-a.index),out=[];
 for(let i=0;i<sorted.length;i++){const {r,index}=sorted[i];if(!allowed(r,uid))continue;
 const key=typeof r.solveId==='string'&&/^[A-Za-z0-9_-]{10,100}$/.test(r.solveId)?r.solveId:await digest(JSON.stringify([timeOf(r),r.time,r.scramble,r.moveCount??null,r.tps??null]));
 let ao5=null;const window=sorted.slice(Math.max(0,i-4),i+1).map(v=>v.r);if(window.length===5&&window.every(v=>base(v,uid)&&(v.dnf||allowed(v,uid)))&&window.filter(v=>v.dnf).length<=1){const times=window.map(v=>v.dnf?Infinity:v.time).sort((a,b)=>a-b);ao5=times.slice(1,-1).reduce((n,v)=>n+v,0)/3;}
 const count=Number.isInteger(r.moveCount)&&r.moveCount>=0&&r.moveCount<=1000?r.moveCount:0;
 out.push({key,index,time:r.time,scramble:r.scramble,solvedAt:timeOf(r),moveCount:count,tps:Number.isFinite(r.tps)&&r.tps>=0&&r.tps<=100?r.tps:count?Number((count/r.time).toFixed(2)):0,ao5,existingSolveId:r.solveId||null});
 }return out;
 }
 const api={allowed,timeOf,prepare,digest};if(typeof module==='object'&&module.exports)module.exports=api;else root.HistorySync=api;
})(typeof window==='object'?window:globalThis);
