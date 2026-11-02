const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../player-presence');
test('self, stale, missing timestamps do not count; distinct UID is one player',()=>{
 const now=100000;assert.equal(P.hasOther([{id:'a',at:now}], 'a',now),false);
 assert.equal(P.hasOther([{id:'b',at:now-90000}], 'a',now),false);
 assert.equal(P.hasOther([{id:'b'}], 'a',now),false);
 assert.equal(P.hasOther([{id:'b',at:now-89999}], 'a',now),true);
 assert.equal(P.hasOther([{id:'b',at:now+6000}], 'a',now),false);
 assert.equal(P.config.heartbeatMs,30000);assert.equal(P.config.onlineMs,90000);
});
test('each new UID notifies, not each heartbeat, tab, eviction or brief reconnect',()=>{
 const t=P.arrivals(),row=(id,at)=>({id,at}),now=1000000;
 assert.deepEqual(t.observe([row('self',now)],'self',now),[]);
 assert.deepEqual(t.observe([row('b',now)],'self',now),['b']);
 assert.deepEqual(t.observe([row('b',now+30000),row('c',now+30000)],'self',now+30000),['c']);
 assert.deepEqual(t.observe([row('b',now+60000),row('c',now+60000),row('d',now+60000)],'self',now+60000),['d']);
 assert.deepEqual(t.observe([],'self',now+150000),[]);
 assert.deepEqual(t.observe([row('b',now+180000)],'self',now+180000),[]);
 assert.deepEqual(t.observe([row('b',now+500000)],'self',now+500000),['b']);
});
