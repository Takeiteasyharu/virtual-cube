/* Pure, replaceable calibration/timing/solution policy. No network or UI. */
(function(root){
 'use strict';
 const levels=['Beginner','Intermediate','Advanced','Expert'];
 const defaults={Beginner:65,Intermediate:32,Advanced:14,Expert:7};
 function quantile(values,q){const a=[...values].sort((a,b)=>a-b);if(!a.length)return null;const p=(a.length-1)*q,i=Math.floor(p);return a[i]+(a[Math.ceil(p)]-a[i])*(p-i);}
 function valid(s){return s?.source==='normal'&&s.completed===true&&s.mode==='virtual'&&s.valid===true&&s.rankingType==='single'&&typeof s.uid==='string'&&Number.isFinite(s.time)&&s.time>=3&&s.time<=300&&Number.isInteger(s.moveCount)&&s.moveCount>=10&&s.moveCount<=300&&Number.isFinite(s.tps)&&s.tps>=.1&&s.tps<=15&&Math.abs(s.moveCount/s.time-s.tps)<.03&&!s.practice&&!s.bot&&!s.dnf;}
 function calibrate(solves,ratings){
  const grouped=new Map();for(const s of solves.filter(valid).sort((a,b)=>Number(b.createdMs)-Number(a.createdMs))){if(!grouped.has(s.uid))grouped.set(s.uid,[]);if(grouped.get(s.uid).length<5)grouped.get(s.uid).push(s.time);}
  const users=[...grouped].map(([uid,times])=>({time:quantile(times,.5),rating:Number.isFinite(ratings[uid])?ratings[uid]:null}));
  const times=users.map(u=>u.time),enough=users.length>=8;
  const medians=enough?Object.fromEntries(levels.map((name,i)=>[name,quantile(times,[.9,.65,.35,.1][i])])):{...defaults};
  const paired=users.filter(u=>u.rating!==null),ratingPoints=[];
  if(paired.length>=8){const sorted=[...paired].sort((a,b)=>a.rating-b.rating);for(let i=0;i<4;i++){const bin=sorted.slice(Math.floor(i*sorted.length/4),Math.floor((i+1)*sorted.length/4));const rating=quantile(bin.map(u=>u.rating),.5),time=quantile(bin.map(u=>u.time),.5);ratingPoints.push({rating,time:i?Math.min(time,ratingPoints[i-1].time):time});}}
  const log=times.map(Math.log),sigma=enough?Math.max(.1,Math.min(.35,(quantile(log,.75)-quantile(log,.25))/1.349)):.18;
  return {version:1,users:users.length,pairedUsers:paired.length,calibrated:enough,medians,sigma,ratingPoints};
 }
 function choose(model,rating,localTimes=[]){
  const m=model||calibrate([],{});let center,source;
  if(Number.isFinite(rating)){
   const p=m.ratingPoints||[];if(p.length>=2){let i=0;while(i<p.length-2&&rating>p[i+1].rating)i++;const a=p[i],b=p[i+1],f=Math.max(0,Math.min(1,(rating-a.rating)/Math.max(1,b.rating-a.rating)));center=Math.exp(Math.log(a.time)*(1-f)+Math.log(b.time)*f);source='rating-calibrated';}
   else{center=32*Math.exp(-(rating-1200)/450);source='rating-reference';}
  }else if(localTimes.filter(t=>t>=3&&t<=300).length){center=quantile(localTimes.filter(t=>t>=3&&t<=300).slice(0,10),.5);source='local-normal-history';}
  else{center=m.medians.Intermediate;source=m.calibrated?'population-median':'reference-default';}
  center=Math.max(4,Math.min(100,center));const level=levels.reduce((best,l)=>Math.abs(Math.log(center/m.medians[l]))<Math.abs(Math.log(center/m.medians[best]))?l:best,'Intermediate');
  return {level,center,sigma:m.sigma||.18,source};
 }
 function sample(config,random=Math.random){for(let attempt=0;attempt<16;attempt++){let z=0;for(let i=0;i<6;i++)z+=random();z=(z-3)*Math.SQRT2;const t=config.center*Math.exp(z*config.sigma);if(Math.abs(z)<=2.2&&t>=3&&t<=110)return t;}return Math.max(3,Math.min(110,config.center));}
 function plan(scramble,S,parse,origin){
  const moves=scramble.trim().split(/\s+/).filter(Boolean);if(!moves.length||moves.some(m=>!parse(m)))throw Error('Invalid bot scramble');
  // Correctness-first scripted solution. The provider can later be replaced by
  // a staged human-method solver without changing the scheduler or renderer.
  const detour=Array.from({length:6},()=>['R','U',"R'","U'"]).flat();
  const solution=[...detour,...S.invert(moves)];const initial=S.applyAll(origin,moves,parse);
  if(!S.solved(S.applyAll(initial,solution,parse)))throw Error('Bot solution verification failed');return solution;
 }
 const api={levels,quantile,valid,calibrate,choose,sample,plan};if(typeof module==='object'&&module.exports)module.exports=api;else root.BotModel=api;
})(typeof window!=='undefined'?window:globalThis);
