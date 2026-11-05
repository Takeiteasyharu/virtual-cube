const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../history-sync.js');
const row={mode:'virtual',source:'normal',time:24,moveCount:48,tps:2,scramble:'R U F2',completedAt:'2026-01-01T12:00:00.000Z'};
test('stable import IDs and actual solve dates survive retries',async()=>{
 const a=await H.prepare([row],'A'),b=await H.prepare([row],'A');
 assert.equal(a[0].key,b[0].key);assert.equal(a[0].solvedAt,Date.parse(row.completedAt));
 assert.equal((await H.prepare([{...row,solveId:'fixed-record-12345'}],'A'))[0].key,'fixed-record-12345');
});
test('foreign ownership cannot be overridden by preparing shared history',async()=>{
 assert.equal((await H.prepare([{...row,ownerUid:'B'},{...row,syncOwnerUid:'B'}],'A')).length,0);
 assert.equal((await H.prepare([{...row,ownerUid:'A'}],'A')).length,1);
});
test('non-normal modes, DNF and missing/unparseable dates are not guessed',async()=>{
 const rows=['battle','bot','guided','daily','replay'].map(source=>({...row,source}));
 rows.push({...row,dnf:true},{...row,mode:'real'},{...row,completedAt:null},{...row,completedAt:'yesterday'});
 assert.deepEqual(await H.prepare(rows,'A'),[]);
});
test('Ao5 uses chronological retained valid results and trims best/worst',async()=>{
 const rows=[20,21,22,23,24].map((time,i)=>({...row,time,completedAt:new Date(Date.UTC(2026,0,1,0,i)).toISOString()}));
 const out=await H.prepare(rows.reverse(),'A');
 assert.equal(out.at(-1).ao5,22);assert.equal(out[0].ao5,null);
});
test('one DNF is trimmed for Ao5; two DNFs never produce a published average',async()=>{
 const rows=[20,21,22,23,24].map((time,i)=>({...row,time,completedAt:new Date(Date.UTC(2026,0,1,0,i)).toISOString()}));
 rows[1].dnf=true;
 assert.equal((await H.prepare(rows,'A')).at(-1).ao5,(22+23+24)/3);
 rows[2].dnf=true;
 assert.equal((await H.prepare(rows,'A')).at(-1).ao5,null);
});
