/* Insert an original UTC activity day without reordering or losing streaks. */
(function(root){
 'use strict';
 function insert(old,day){
  const runs=(old?.runs||[]).map(r=>({...r}));let index=runs.findIndex(r=>r.end>=day-1);if(index<0)index=runs.length;
  const left=runs[index];if(left&&left.start<=day&&day<=left.end)return {...old,insertDay:day,insertIndex:index,changed:false};
  let start=day,end=day,remove=0;
  if(left&&left.start<=day+1){start=Math.min(start,left.start);end=Math.max(end,left.end);remove=1;const right=runs[index+1];if(right&&right.start===end+1){end=right.end;remove=2;}}
  runs.splice(index,remove,{start,end});const lastDay=runs.at(-1).end,current=lastDay-runs.at(-1).start+1;
  return {v:1,runs,days:(old?.days||0)+1,lastDay,current,longest:Math.max(old?.longest||0,end-start+1),insertDay:day,insertIndex:index,changed:true};
 }
 const empty=()=>({v:1,runs:[],days:0,lastDay:-1,current:0,longest:0,insertDay:-1,insertIndex:0});
 const api={insert,empty};if(typeof module==='object'&&module.exports)module.exports=api;else root.ActivityCalendar=api;
})(typeof window==='object'?window:globalThis);
