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
