// Read-only production audit. Firebase CLI credentials stay in memory and are
// never printed or written; no Firestore document is changed by this command.
const cp=require('node:child_process');
const cli='C:/Users/harut/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js';
const run=args=>cp.execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'true',NO_UPDATE_NOTIFIER:'1'}});
function value(v){if('stringValue'in v)return v.stringValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;if('timestampValue'in v)return v.timestampValue;if('arrayValue'in v)return(v.arrayValue.values||[]).map(value);if('mapValue'in v)return decode(v.mapValue.fields||{});return null;}
const decode=fields=>Object.fromEntries(Object.entries(fields||{}).map(([k,v])=>[k,value(v)]));
(async()=>{run(['projects:list','--json']);const accounts=JSON.parse(run(['login:list','--json'])),token=accounts.result?.[0]?.tokens?.access_token;if(!token)throw Error('No Firebase CLI session');
 const base='https://firestore.googleapis.com/v1/projects/virtual-cube-timer/databases/(default)/documents/';
 const read=async path=>{const r=await fetch(base+path,{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Read failed '+r.status);return r.json();};
 async function list(collection){const r=await read(collection+'?pageSize=100');if(r.nextPageToken)throw Error('Audit exceeds bounded 100-document collection scan; no correction is authorized');return(r.documents||[]).map(d=>({id:d.name.split('/').at(-1),data:decode(d.fields)}));}
 const certs=await list('rankingMedalPeriods'),totals=await list('rankingMedals'),users=new Map();
 for(const c of certs)for(let rank=0;rank<(c.data.winners||[]).length;rank++){const w=c.data.winners[rank];if(!users.has(w.uid)){const s=await read('solves/'+encodeURIComponent(w.solveId));users.set(w.uid,{name:decode(s.fields).name,expected:{gold:0,silver:0,bronze:0},events:[]});}const u=users.get(w.uid),color=['gold','silver','bronze'][rank];u.expected[color]++;u.events.push({id:c.id,kind:c.data.kind,period:c.data.key,metric:c.data.metric,rank:rank+1,color});}
 console.log(JSON.stringify({readOnly:true,certificateCount:certs.length,statuses:certs.map(c=>({id:c.id,status:c.data.status})),users:totals.map(c=>{const u=users.get(c.id)||{name:'Unknown',expected:{gold:0,silver:0,bronze:0},events:[]},actual=Object.fromEntries(['gold','silver','bronze'].map(k=>[k,c.data[k]]));return{...u,actual,matchesLedger:JSON.stringify(actual)===JSON.stringify(u.expected)};})},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
