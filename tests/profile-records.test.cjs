const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),P=require('../profile-records.js');
test('only positively identified normal virtual solves are eligible',()=>{
 const s={solveId:'12345678-1234-1234-1234-123456789012',source:'normal',mode:'virtual',rankingEligible:true};
 assert(P.eligible(s));for(const source of ['battle','bot','daily','guided','replay','unknown',undefined])assert(!P.eligible({...s,source}));
 assert(!P.eligible({...s,mode:'real'}));assert(!P.eligible({...s,rankingEligible:false}));assert(!P.eligible({...s,solveId:undefined}));
 const online=fs.readFileSync('online.js','utf8');assert(!online.includes('async function addRankingEntry'));assert(!online.includes('async function updateUserSolveAggregates'));assert(!online.includes('async function recordOwnBattleStats'));
 assert(online.includes('navigator.locks.request'));assert(online.includes('PENDING_V2_PREFIX'));assert(!online.includes('localStorage.removeItem("pendingOnlineSolves")'));
});
test('zero-based tracked aggregates do not inherit legacy totals; all human outcomes stay separate',()=>{
 let s=P.advance(null,{id:'a',kind:'normal',timeMs:20000,moveCount:60,tpsMilli:3000,ao5Ms:0,ao12Ms:0},'start');
 for(const kind of ['ranked','friend'])for(const result of ['win','loss','draw','dnf'])s=P.advance(s,{id:kind+result,kind,result},'later');
 assert.equal(s.normalSolves,1);assert.equal(s.totalMoves,60);assert.equal(s.trackingStartedAt,'start');
 for(const kind of ['ranked','friend']){assert.equal(s[kind+'Battles'],4);for(const suffix of ['Wins','Losses','Draws','Dnfs'])assert.equal(s[kind+suffix],1);}
});
test('human result classification preserves score outcomes and distinguishes DNF',()=>{
 const r={mode:'ranked',winnerUid:'a'};
 assert.equal(P.outcome(r,{status:'finished'},'a'),'win');assert.equal(P.outcome(r,{status:'finished'},'b'),'loss');assert.equal(P.outcome(r,{status:'solving'},'b'),'dnf');
 assert.equal(P.outcome({...r,isDraw:true},{status:'solving'},'b'),'draw');assert.equal(P.outcome({...r,timeLimitReached:true},{status:'time_limit'},'b'),'loss');
 assert.throws(()=>P.outcome({...r,isBot:true},{},'a'));
});
