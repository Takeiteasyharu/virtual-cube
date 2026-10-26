const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const M=require('../matchmaking-config.js'),source=fs.readFileSync('online.js','utf8');
test('unrestricted matching default preserves the former rating ranges behind one configuration flag',()=>{
 assert.equal(M.config.botFallbackDelayMs,5000);assert.equal(M.config.useRatingRange,false);
 for(const t of [0,9999,10000,20000,30000])assert.equal(M.ratingRange(t),Infinity);
 const enabled=new Function('module',fs.readFileSync('matchmaking-config.js','utf8').replace('useRatingRange:false','useRatingRange:true')+';return module.exports;')({exports:{}});
 assert.deepEqual([0,10000,20000,30000].map(enabled.ratingRange),[50,100,200,Infinity]);
});
test('BOT preference defaults on, persists off, and gracefully tolerates blocked storage',()=>{
 const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 assert.equal(M.load(storage),true);M.save(storage,false);assert.equal(M.load(storage),false);M.save(storage,true);assert.equal(M.load(storage),true);
 const broken={getItem(){throw Error('blocked')},setItem(){throw Error('full')}};assert.equal(M.load(broken),true);assert.doesNotThrow(()=>M.save(broken,false));
});
test('only fresh waiting queue entries are eligible; server timestamp takes priority over client start time',()=>{
 const now=100000,entry={status:'waiting',startedAtMs:1,createdAt:{toMillis:()=>now-1000}};
 assert.equal(M.fresh(entry,now),true);assert.equal(M.fresh({...entry,status:'matched'},now),false);
 assert.equal(M.fresh({...entry,createdAt:{toMillis:()=>now-M.config.queueLeaseMs}},now),false);
 assert.equal(M.fresh({...entry,createdAt:{toMillis:()=>now+6000}},now),false);
 assert.equal(M.fresh({},now),false);
});
test('candidate selection ignores rating and experience, skips stale queues and prioritizes waiting order',()=>{
 const start=source.indexOf('function selectRankedCandidate('),end=source.indexOf('\nasync function getRankedCandidateDocs',start);
 const select=new Function('window','currentUser','getRating','getRankedMatchRange','MATCHMAKING_CONFIG',source.slice(start,end)+';return selectRankedCandidate;')({Matchmaking:M},{uid:'self'},x=>x.rating,M.ratingRange,M.config);
 const now=Date.now(),q=(id,rating,startedAtMs,stamp=now)=>({id,data:()=>({mode:'ranked',status:'waiting',roomId:id,rating,startedAtMs,createdAt:{toMillis:()=>stamp}})});
 const old=q('old',3000,now-2000),near=q('near',1200,now-1000),stale=q('stale',1200,now-5000,now-45001);
 assert.equal(select([near,old,stale,q('self',1200,now-10000)],1200).id,'old');assert.equal(select([stale],1200),null);
 assert(source.includes('Math.max(0,BOT_FALLBACK_WAIT_MS-(Date.now()-rankedSearchStartedAt))'));
 assert(!source.includes('Search timed out. Please try again.'));
});
