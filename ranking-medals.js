/* Shared period/podium model, independent of storage and presentation. */
(function(root){
 'use strict';
 const metrics=['single','ao5','tps','moves'],fields={today:'dayKey',week:'weekKey',month:'monthKey'};
 function keys(value){const d=new Date(value),day=d.toISOString().slice(0,10),w=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));w.setUTCDate(w.getUTCDate()+4-(w.getUTCDay()||7));const y=w.getUTCFullYear(),week=Math.ceil((((w-Date.UTC(y,0,1))/86400000)+1)/7);return {today:day,month:day.slice(0,7),week:y+'-W'+String(week).padStart(2,'0')};}
 function period(kind,key){let start,end;
  if(kind==='today'&&/^\d{4}-\d{2}-\d{2}$/.test(key)){start=Date.parse(key+'T00:00:00Z');end=start+86400000;}
  else if(kind==='month'&&/^\d{4}-\d{2}$/.test(key)){start=Date.parse(key+'-01T00:00:00Z');const d=new Date(start);end=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);}
  else if(kind==='week'&&/^\d{4}-W\d{2}$/.test(key)){const y=Number(key.slice(0,4)),w=Number(key.slice(6)),jan4=new Date(Date.UTC(y,0,4));start=+jan4-((jan4.getUTCDay()+6)%7)*86400000+(w-1)*604800000;end=start+604800000;}
  if(!Number.isFinite(start)||!Number.isFinite(end)||!fields[kind]||keys(start)[kind]!==key)throw Error('Invalid UTC period (All is not eligible)');
  return {kind,key,start,end,field:fields[kind],id:kind+'_'+key};
 }
 function podium(records,metric,p,trackingStart,now=Date.now()){
  if(!metrics.includes(metric))throw Error('Unsupported ranking metric');
  if(p.start<trackingStart)throw Error('Period predates protected medal tracking; historical results will not be guessed');
  if(now<p.end)throw Error('The UTC period is still open');
  const accepted=[];let late=0;
  for(const row of records){const s=row.data,at=typeof s.createdAt==='number'?s.createdAt:Date.parse(s.createdAt);
   if(!Number.isFinite(at))throw Error('Unverifiable record timestamp: '+row.id);
   if(at>=p.end){late++;continue;} // Late/offline submissions cannot change the closed snapshot.
   if(at<p.start||s[p.field]!==p.key)throw Error('Record period/timestamp mismatch: '+row.id);
   const type=metric==='ao5'?'ao5':'single';
   if(s.schemaVersion!==2||s.source!=='normal'||s.completed!==true||s.valid!==true||s.mode!=='virtual'||s.rankingType!==type||typeof s.uid!=='string'||!s.uid||typeof s.solveId!=='string'||row.id!=='normal_'+s.solveId+'_'+type||s.eventId!=='normal_'+s.solveId||typeof s.name!=='string'||typeof s.scramble!=='string'||!s.scramble.trim()||!Number.isFinite(s.time)||s.time<=2||s.time>=3600)throw Error('Unverifiable normal-solve provenance: '+row.id);
   const field=metric==='tps'?'tps':metric==='moves'?'moveCount':'time',value=s[field];
   if(!Number.isFinite(value)||(metric==='moves'&&!Number.isInteger(value)))throw Error('Missing or malformed metric: '+row.id);
   if(value<=0)continue;
   accepted.push({uid:s.uid,name:s.name,solveId:row.id,value,createdAt:at});
  }
  // Match the current Firestore query's implicit document-ID tie order.
  const lex=(a,b)=>a===b?0:a<b?-1:1;
  accepted.sort((a,b)=>(metric==='tps'?b.value-a.value:a.value-b.value)||(metric==='tps'?-1:1)*lex(a.solveId,b.solveId));
  const seen=new Set(),winners=[];for(const r of accepted){if(seen.has(r.uid))continue;seen.add(r.uid);if(winners.length<3)winners.push({...r,rank:winners.length+1});}
  return {metric,winners,late,eligibleRecords:accepted.length};
 }
 function counts(data){if(!data)return {gold:0,silver:0,bronze:0};if(data.v!==1)throw Error('Unknown medal format');for(const k of ['gold','silver','bronze'])if(!Number.isSafeInteger(data[k])||data[k]<0)throw Error('Invalid medal totals');return {gold:data.gold,silver:data.silver,bronze:data.bronze};}
 function symbols(data){const c=counts(data);return '🥇'.repeat(c.gold)+'🥈'.repeat(c.silver)+'🥉'.repeat(c.bronze);}
 const TRACKING_START='2026-10-30';
 function first(kind,start=TRACKING_START){const base=period('today',start).start;if(kind==='today')return base;if(kind==='week'){const d=new Date(base);return base+((8-(d.getUTCDay()||7))%7)*86400000;}if(kind==='month'){const d=new Date(base);return d.getUTCDate()===1?base:Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);}throw Error('Invalid period kind');}
 const api={TRACKING_START,first,metrics,fields,keys,period,podium,counts,symbols};if(typeof module==='object'&&module.exports)module.exports=api;else root.RankingMedals=api;
})(typeof window==='object'?window:globalThis);
