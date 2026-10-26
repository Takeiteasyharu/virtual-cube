const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),A=require('../solve-analytics.js');
const r=(time,extra={})=>({mode:'virtual',source:'normal',solveId:'solve-'+time,time,tps:2,moveCount:60,scramble:'R U',date:'Saved local date',...extra});
test('normal virtual provenance excludes battles, aids, daily, real, abort and malformed rows',()=>{
 const rows=[r(20),...['ranked','friend','bot','battle','daily','guided','replay','practice'].map(source=>r(21,{source})),r(22,{mode:'real'}),r(23,{practice:true}),r(23,{isBot:true}),r(23,{rankingType:'ao5'}),r(23,{status:'aborted'}),r(-1),r(null),r(20,{aborted:true}),r(20,{completed:false})];
 assert.equal(A.normalize(rows).length,1);assert.equal(A.normalize([r(22,{source:undefined})])[0].legacy,true);
});
test('Last 10/50/100/All Available never creates missing history, mutates data or exceeds retention',()=>{
 const rows=Array.from({length:150},(_,i)=>r(i+1)),original=JSON.stringify(rows);
 for(const [limit,n]of [[10,10],[50,50],[100,100],['all',100]]){const a=A.analyze(rows,{limit});assert.equal(a.rows.length,n);assert.equal(a.rows.at(-1).time,1);}
 assert.equal(JSON.stringify(rows),original);assert.equal(A.analyze([]).summary.average,null);
});
test('rolling Ao5/Ao12 match actual existing trimmed-average functions across 100 random windows',()=>{
 const source=fs.readFileSync('timer.js','utf8'),start=source.indexOf('function calculateAverageValue('),end=source.indexOf('\nfunction getCurrentAo5',start);
 let current=[];const existing=new Function('getSolves',source.slice(start,end)+';return calculateAverageValue;')(()=>current);
 let seed=11;for(let k=0;k<100;k++){current=Array.from({length:12},()=>{seed=(1664525*seed+1013904223)>>>0;return r(5+seed%10000/100);});for(const n of [5,12])assert(Math.abs(A.average([...A.normalize(current)],n).value-existing(n))<1e-10);}
});
test('DNF is excluded from overview/PB; one DNF is trimmed, two produce DNF',()=>{
 const five=[r(10),r(20),r(30),r(40),r('DNF')],a=A.analyze(five);
 assert.equal(a.summary.total,5);assert.equal(a.summary.dnf,1);assert.equal(a.summary.average,25);assert.equal(a.summary.pb,10);assert.equal(A.average(A.normalize(five),5).value,30);
 assert.equal(A.average(A.normalize([r('DNF'),...five.slice(1)]),5).state,'dnf');assert.equal(A.average([],12).state,'insufficient');
});
test('PB improvements use retained chronological order and preserve unknown earlier PB and dates',()=>{
 const a=A.analyze([r(18),r(25),r(20),r(30)]);assert.deepEqual(a.history.map(x=>[x.previous,x.time]),[[null,30],[30,20],[20,18]]);assert.equal(a.history[0].date,'Saved local date');
 assert.deepEqual(A.analyze([r(18),r(25),r(20),r(30)],{limit:2}).history.map(x=>x.previous),[20]);
});
test('missing metrics stay missing; arithmetic means use stored TPS and normalized moves',()=>{
 const a=A.analyze([r(20,{tps:null,moveCount:null,date:null}),r(40,{tps:1.234,moveCount:50})]);assert.equal(a.summary.tps,1.234);assert.equal(a.summary.moves,50);assert.equal(a.rows[1].tps,null);assert.equal(a.rows[1].date,null);
});
test('account filtering never assigns shared legacy, other accounts or signed-out solves to the current account',()=>{
 const rows=[r(10,{ownerUid:'a'}),r(20,{ownerUid:'b'}),r(30),r(40,{ownerUid:'a'})];
 assert.equal(A.analyze(rows,{accountOnly:true,ownerUid:'a'}).summary.total,2);assert.equal(A.analyze(rows,{accountOnly:true,ownerUid:'b'}).summary.total,1);assert.equal(A.analyze(rows,{accountOnly:true}).summary.total,0);assert.equal(A.analyze(rows).summary.total,4);
});
test('replay matching requires exact solve ID, scramble, final time, moves and owner; no fuzzy historical replay',()=>{
 const row=A.normalize([r(20,{ownerUid:'a'})])[0],replay={solveId:row.id,ownerUid:'a',scramble:'R U',ms:20000,count:60};assert(A.replayAvailable(row,replay));
 for(const change of [{solveId:'another'},{ownerUid:'b'},{scramble:'U R'},{ms:20001},{count:61},{solveId:null}])assert.equal(A.replayAvailable(row,{...replay,...change}),false);
});
test('existing local save path retains 100, records ownership/ISO in place, and rejects every excluded play mode',()=>{
 const source=fs.readFileSync('timer.js','utf8'),start=source.indexOf('function saveSolve('),end=source.indexOf('\nfunction clearTimes',start),store=new Map(),win={SolveAnalytics:A,getAnalyticsIdentity:()=>({uid:'starter'})};
 const storage={setItem:(k,v)=>store.set(k,v)},save=new Function('window','localStorage','readModeSolves','syncLegacySolveHistory','VIRTUAL_SOLVES_KEY','REAL_SOLVES_KEY',source.slice(start,end)+';return saveSolve;')(win,storage,()=>Array.from({length:100},()=>({mode:'virtual',time:30})),()=>{},'virtual','real');
 save(20,'R',{solveId:'fixed-id',source:'normal',ownerUid:'starter',tps:3,moveCount:60});const rows=JSON.parse(store.get('virtual'));assert.equal(rows.length,100);assert.equal(rows[0].ownerUid,'starter');assert.equal(rows[0].source,'normal');assert.match(rows[0].completedAt,/^\d{4}-\d{2}-\d{2}T/);
 for(const source of ['battle','bot','guided','daily','replay']){store.clear();save(20,'R',{source});assert.equal(store.size,0);}
 for(const flag of ['BotBattle','DailyChallenge','GuidedSolve','SolveReplay']){store.clear();win[flag]={active:true,isPractice:true};save(20,'R',{source:'normal'});assert.equal(store.size,0);delete win[flag];}
 win.isBattleMode=()=>true;store.clear();save(20,'R',{source:'normal'});assert.equal(store.size,0);
});
test('identity changes during a solve do not assign its local history to either account',()=>{
 assert.equal(A.ownerUidFor({ownerUid:'a'},{uid:'a'}),'a');assert.equal(A.ownerUidFor({ownerUid:'a'},{uid:'b'}),null);assert.equal(A.ownerUidFor({ownerUid:null},{uid:'b'}),null);assert.equal(A.ownerUidFor({ownerUid:'a'},null),null);
});
test('an isolated 67,792-second saved result does not flatten the auto-focused time chart; raw data and averages stay intact',()=>{
 const values=Array.from({length:73},(_,i)=>i===43?67792:20+i%15),original=JSON.stringify(values),focused=A.chartScale(values),full=A.chartScale(values,false);
 assert(focused.focused);assert.equal(focused.clipped,1);assert(focused.top<100);assert(full.top>67792);assert.equal(full.clipped,0);assert.equal(JSON.stringify(values),original);
 const data=A.analyze(values.map(t=>r(t)));assert.equal(data.summary.total,73);assert.equal(data.rows.filter(x=>x.time===67792).length,1);assert(data.summary.average>900);
 assert.equal(A.tickLabel(75927.2),'75.9k');
});
test('ordinary variation, small samples and a majority of slow solves are never silently cropped',()=>{
 for(const values of [[20,22,25,60],Array.from({length:30},(_,i)=>20+i),[1,1,1,1,1,1,1,1000],Array(12).fill(60000)]){
  const result=A.chartScale(values);if(values.length===8)assert(result.focused);else{assert.equal(result.focused,false);assert.equal(result.clipped,0);}
 }
 assert(Number.isFinite(A.chartScale([Number.MAX_VALUE],false).top));
});
