const {test}=require('node:test'),assert=require('node:assert/strict'),{createFlow}=require('../battle-end.js');
test('one three-second transition per personal round; updates cannot restart replay',()=>{
 const tasks=new Map();let id=0,next=0;const flow=createFlow((fn,ms)=>{assert.equal(ms,3000);tasks.set(++id,fn);return id;},key=>tasks.delete(key));
 assert(flow.start('round-a',()=>next++));assert.equal(flow.phase,'result');assert.equal(flow.start('round-a',()=>next++),false);tasks.get(1)();assert.equal(next,1);assert.equal(flow.phase,'replay');flow.finish();assert.equal(flow.phase,'leave');assert.equal(flow.start('round-a',()=>next++),false);
});
test('leave invalidates even an already queued three-second callback',()=>{
 let callback,next=0;const flow=createFlow(fn=>(callback=fn,1),()=>{});flow.start('old',()=>next++);flow.reset();callback();assert.equal(next,0);assert.equal(flow.phase,'idle');
 flow.start('new',()=>next++);callback();assert.equal(next,1);
});
