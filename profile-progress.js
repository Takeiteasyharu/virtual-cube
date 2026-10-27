/* Bounded stage-two reducers shared by rendering, record writers and tests. */
(function(root){
 'use strict';
 const dayIndex=ms=>Math.floor(ms/86400000),dayLabel=n=>Number.isInteger(n)&&n>=0?new Date(n*86400000).toISOString().slice(0,10):'Not tracked yet';
 const definitions=[
  ['firstSolve','First Solve','◇','Complete 1 normal virtual solve','solves',1],['solves100','100 Solves','◆','Complete 100 normal virtual solves','solves',100],['solves1000','1,000 Solves','✦','Complete 1,000 normal virtual solves','solves',1000],
  ['sub30','Sub-30','⚡','Complete a normal virtual solve in under 30 seconds','pb',30000],['sub20','Sub-20','⚡','Complete a normal virtual solve in under 20 seconds','pb',20000],['sub10','Sub-10','⚡','Complete a normal virtual solve in under 10 seconds','pb',10000],
  ['firstWin','First Win','★','Win 1 human Ranked Battle','wins',1],['wins10','10 Wins','★','Win 10 human Ranked Battles','wins',10],['wins100','100 Wins','🏆','Win 100 human Ranked Battles','wins',100],
  ['streak7','7-Day Streak','☀','Be active on 7 consecutive UTC days','streak',7],['streak30','30-Day Streak','☀','Be active on 30 consecutive UTC days','streak',30]
 ].map(([id,name,icon,condition,kind,target])=>({id,name,icon,condition,kind,target}));
 const value=(b,s,d)=>b.kind==='solves'?Number(s?.normalSolves||0):b.kind==='wins'?Number(s?.rankedWins||0):b.kind==='pb'?Number(s?.pbMs||0):Number(d?.longestStreak||0);
 const achieved=(b,s,d)=>b.kind==='pb'?value(b,s,d)>0&&value(b,s,d)<b.target:value(b,s,d)>=b.target;
 function average(times,n){if(times.length<n)return 0;const a=times.slice(0,n);return (a.reduce((s,x)=>s+x,0)-Math.min(...a)-Math.max(...a))/(n-2);}
 function advance(old,before,after,e,stamp,day,dayExists,calendar=null){
  const continuous=!old||old.lastEventId===before?.lastEventId;
  const previous=old?.lastDayIndex??-1,newDay=!dayExists;
  const streak=day===previous?(old?.currentStreak||0):day===previous+1?(old?.currentStreak||0)+1:1;
  const times=e.kind==='normal'?[e.timeMs,...(continuous?old?.recentTimes||[]:[])].slice(0,12):continuous?old?.recentTimes||[]:[];
  const next={v:2,lastEventId:e.id,trackingStartedAt:old?.trackingStartedAt||stamp,updatedAt:stamp,coverageComplete:old?.coverageComplete!==false&&continuous,
   activeDays:Number(old?.activeDays||0)+(newDay?1:0),lastDayIndex:day,currentStreak:streak,longestStreak:Math.max(old?.longestStreak||0,streak),
   bestTpsMilli:Math.max(old?.bestTpsMilli||0,e.kind==='normal'?e.tpsMilli:0),lastSolveAt:e.kind==='normal'?stamp:old?.lastSolveAt||null,
   normalTrackingStartedAt:old?.normalTrackingStartedAt||(e.kind==='normal'?stamp:null),recentTimes:times,badgeTimes:{}};
  for(const b of definitions)next.badgeTimes[b.id]=old?.badgeTimes?.[b.id]||(achieved(b,after,next)&&!achieved(b,before,old)?stamp:null);
  if(calendar){
   next.activeDays=calendar.days;next.lastDayIndex=calendar.lastDay;next.currentStreak=calendar.current;next.longestStreak=Math.max(old?.longestStreak||0,calendar.longest);
   for(const b of definitions.filter(b=>b.kind==='streak'))next.badgeTimes[b.id]=old?.badgeTimes?.[b.id]||(achieved(b,after,next)?stamp:null);
  }
  return next;
 }
 function badges(stats,detail){return definitions.map(b=>{
  const unlocked=!!detail?.badgeTimes?.[b.id]||achieved(b,stats,detail),known=b.kind==='streak'?!!detail?.coverageComplete:!!stats;
  const n=value(b,stats,detail),progress=b.kind==='pb'?(n?`Best: ${(n/1000).toFixed(2)} s`:'No tracked PB'):`${Math.min(n,b.target).toLocaleString('en-US')} / ${b.target.toLocaleString('en-US')}`;
  return {...b,unlocked,state:unlocked?'Unlocked':known?'Not unlocked in tracked records':'Insufficient data',progress,unlockedAt:detail?.badgeTimes?.[b.id]||null};
 });}
 function currentStreak(detail,today=dayIndex(Date.now())){return !detail?null:today-detail.lastDayIndex<=1?detail.currentStreak:0;}
 const api={dayIndex,dayLabel,definitions,achieved,average,advance,badges,currentStreak};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ProfileProgress=api;
})(typeof window==='object'?window:globalThis);
