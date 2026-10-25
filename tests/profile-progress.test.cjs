const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../profile-progress.js'),R=require('../profile-records.js');
function step(old,before,e,day,known=false){const after=R.advance(before,e,'stamp-'+day);return {stats:after,detail:P.advance(old,before,after,e,'stamp-'+day,day,known)};}
const event=(id,kind='normal',result)=>({id,kind,result,timeMs:20000,moveCount:60,tpsMilli:3000,ao5Ms:0,ao12Ms:0});
test('same UTC day counts once; UTC midnight, skipped day and read-time expiration are exact',()=>{
 let a=step(null,null,event('a'),20000);assert.equal(a.detail.activeDays,1);a=step(a.detail,a.stats,event('b'),20000,true);assert.equal(a.detail.activeDays,1);assert.equal(a.detail.currentStreak,1);
 a=step(a.detail,a.stats,event('c'),20001);assert.equal(a.detail.currentStreak,2);assert.equal(a.detail.longestStreak,2);assert.equal(P.currentStreak(a.detail,20002),2);assert.equal(P.currentStreak(a.detail,20003),0);
 a=step(a.detail,a.stats,event('d'),20003);assert.equal(a.detail.currentStreak,1);assert.equal(a.detail.longestStreak,2);assert.equal(a.detail.activeDays,3);
 assert.equal(P.dayIndex(Date.parse('2026-10-26T23:59:59.999Z'))+1,P.dayIndex(Date.parse('2026-10-27T00:00:00Z')));
});
test('bounded cross-device rolling means trim min/max; no old history is synthesized',()=>{
 let a={stats:null,detail:null};for(let i=1;i<=15;i++)a=step(a.detail,a.stats,{...event('s'+i),timeMs:i*1000},20000,true);
 assert.equal(a.detail.recentTimes.length,12);assert.equal(P.average(a.detail.recentTimes,5),13000);assert.equal(P.average(a.detail.recentTimes,12),9500);
 const legacy={...a.stats,lastEventId:'legacy'};a=step(a.detail,legacy,event('new','friend','win'),20000,true);assert.equal(a.detail.coverageComplete,false);assert.deepEqual(a.detail.recentTimes,[]);assert.equal(P.average(a.detail.recentTimes,5),0);
});
test('all eleven badges unlock at exact thresholds; strict sub limits; unlock dates persist',()=>{
 let a={stats:null,detail:null};for(let i=1;i<=1000;i++)a=step(a.detail,a.stats,{...event('s'+i),timeMs:i===1?30000:i===2?20000:i===3?10000:9990},20000,true);
 for(let i=1;i<=100;i++)a=step(a.detail,a.stats,event('w'+i,'ranked','win'),20000,true);
 for(let day=20001;day<=20029;day++)a=step(a.detail,a.stats,event('day'+day,'friend','draw'),day);
 const badges=P.badges(a.stats,a.detail);assert.equal(badges.length,11);assert(badges.every(b=>b.unlocked));assert.equal(a.detail.badgeTimes.streak30,'stamp-20029');
 const before=JSON.stringify(a.detail.badgeTimes);a=step(a.detail,a.stats,event('loss','ranked','loss'),20031);assert.equal(JSON.stringify(a.detail.badgeTimes),before);
 for(const [ms,id]of [[30000,'sub30'],[20000,'sub20'],[10000,'sub10']])assert.equal(P.badges({pbMs:ms},null).find(b=>b.id===id).unlocked,false);
 assert.equal(P.badges(null,null)[0].state,'Insufficient data');assert.equal(P.badges({normalSolves:2},null).find(b=>b.id==='solves100').state,'Not unlocked in tracked records');
});
test('stage-one thresholds unlock without invented dates; human Friend wins never unlock ranked win badges',()=>{
 let before={normalSolves:100,rankedWins:0,pbMs:19000,lastEventId:'old'},e=event('new','friend','win'),a=step(null,before,e,20000);
 assert.equal(P.badges(a.stats,a.detail).find(b=>b.id==='solves100').unlocked,true);assert.equal(a.detail.badgeTimes.solves100,null);assert.equal(P.badges(a.stats,a.detail).find(b=>b.id==='firstWin').unlocked,false);
});
