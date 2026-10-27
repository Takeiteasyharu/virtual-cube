const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('../battle-flow.js'),C=require('../activity-calendar.js');
const result=(status,time=null,score=0)=>({status,time,score,name:'Player',round:1});
test('first finisher remains pending and final settlement is independent of host',()=>{
 let r={...F.empty(),mode:'ranked',hostUid:'host',guestUid:'guest',status:'solving'};
 r={...r,...F.aggregate(r,'host',result('finished',30))};
 assert.equal(r.status,'solving');assert.equal(F.outcome(r,'host'),'pending');
 r={...r,...F.aggregate(r,'guest',result('finished',20))};
 assert.equal(r.status,'finished');assert.equal(F.outcome(r,'guest'),'win');assert.equal(F.outcome(r,'host'),'loss');
});
test('score tie, DNF and twenty participant completion remain distinct',()=>{
 let r={...F.empty(),mode:'ranked',hostUid:'a',guestUid:'b',status:'solving'};
 r={...r,...F.aggregate(r,'a',result('time_limit',null,40))};r={...r,...F.aggregate(r,'b',result('time_limit',null,40))};assert.equal(F.outcome(r,'a'),'draw');
 r={...F.empty(),mode:'friend',maxPlayers:20,activePlayerUids:Array.from({length:20},(_,i)=>'p'+i),status:'solving'};
 for(let i=0;i<20;i++){r={...r,...F.aggregate(r,'p'+i,result(i===0?'dnf':'finished',i===0?null:20+i))};assert.equal(r.status,i===19?'finished':'solving');}
 assert.equal(F.outcome(r,'p0'),'dnf');assert.equal(F.outcome(r,'p1'),'win');
});
test('activity calendar accepts original days in arbitrary arrival order without duplicate counting',()=>{
 for(let seed=1;seed<=100;seed++){
  let state=seed,rand=()=>((state=(state*1664525+1013904223)>>>0)/4294967296),days=Array.from({length:60},(_,i)=>20000+i).filter(()=>rand()>.3),order=[...days,...days].sort(()=>rand()-.5),cal=C.empty();
  for(const day of order)cal=C.insert(cal,day);
  const unique=[...new Set(days)].sort((a,b)=>a-b);let longest=0,current=0,last=-2;
  for(const day of unique){current=day===last+1?current+1:1;longest=Math.max(longest,current);last=day;}
  assert.equal(cal.days,unique.length);assert.equal(cal.current,current);assert.equal(cal.longest,longest);assert.equal(cal.lastDay,last);
 }
});
test('Friend Battle ties share a draw only at the winning time, without treating slower finishers as tied',()=>{
 let r={...F.empty(),mode:'friend',maxPlayers:20,activePlayerUids:['a','b','c'],status:'solving'};for(const [uid,time]of[['a',20],['b',20],['c',30]])r={...r,...F.aggregate(r,uid,result('finished',time))};assert.equal(F.outcome(r,'a'),'draw');assert.equal(F.outcome(r,'b'),'draw');assert.equal(F.outcome(r,'c'),'loss');
});
