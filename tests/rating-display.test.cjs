const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../online.js'),'utf8');
function element(){return {children:[],textContent:'',hidden:false,set innerHTML(v){this.children=[]},appendChild(el){this.children.push(el)},replaceChildren(){this.children=[]}};}
test('experienced and new Google players render in separate rating lists',async()=>{
 const experienced=element(),fresh=element(),more=element();
 const entries=Array.from({length:81},(_,i)=>({id:String(i),data:{name:'Player '+i,rating:1200,loginType:'google',rankedBattles:i<20?1:0}}));
 const context={battleRatingList:experienced,isConfigured:()=>true,currentUser:{uid:'0'},INITIAL_RATING:1200,battleRatingHasMore:true,console,
 document:{getElementById:id=>id==='newPlayerRatingList'?fresh:more,createElement:element},getBattleRatingEntries:async()=>entries};
 const fn=source.slice(source.indexOf('async function refreshBattleRatingRanking('),source.indexOf('async function getBattleRatingEntries('));
 await vm.runInNewContext('('+fn+')(true)',context);
 assert.equal(experienced.children.length,20);assert.equal(fresh.children.length,61);assert.equal(more.hidden,false);
 assert.match(experienced.children[0].textContent,/Player 0 - 1200/);assert.match(fresh.children[0].textContent,/Player 20 - 1200/);
});
test('bounded rating pages retain zero-match Google users, exclude guests and continue by cursor',async()=>{
 const entry=(id,loginType,rankedBattles)=>({id,data:()=>({loginType,rankedBattles,rating:1200})});
 const pages=[[entry('guest','guest',0),entry('old','google',3),entry('new','google',0)],[entry('next','google',0)]],queries=[];
 const context={battleRatingCache:{timestamp:0,entries:[]},RANKING_CACHE_TTL_MS:300000,battleRatingFetchPromise:null,battleRatingCursor:null,battleRatingHasMore:false,db:{},USERS_COLLECTION:'users',RANKING_LIMIT:3,
 collection:()=>({}),orderBy:(...v)=>({order:v}),limit:v=>({limit:v}),startAfter:v=>({cursor:v.id}),query:(...v)=>{queries.push(v);return v},getDocs:async()=>{const docs=pages.shift();return {docs,size:docs.length}}};
 const fn=source.slice(source.indexOf('async function getBattleRatingEntries('),source.indexOf('function formatRankingEntry('));
 vm.createContext(context);vm.runInContext(fn,context);
 assert.equal((await vm.runInContext('getBattleRatingEntries(true)',context)).length,2);
 const all=await vm.runInContext('getBattleRatingEntries(false,true)',context);assert.deepEqual(Array.from(all,x=>x.id),['old','new','next']);
 assert(queries[1].some(v=>v?.cursor==='new'));assert.equal(context.battleRatingHasMore,false);
});
