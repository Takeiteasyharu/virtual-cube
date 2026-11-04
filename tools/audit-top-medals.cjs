// Production read-only investigation. Credentials remain in memory.
const cp=require('node:child_process');
const cli='C:/Users/harut/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js';
function val(v){if('stringValue'in v)return v.stringValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;if('timestampValue'in v)return v.timestampValue;if('arrayValue'in v)return(v.arrayValue.values||[]).map(val);if('mapValue'in v)return dec(v.mapValue.fields||{});return null;}
const dec=f=>Object.fromEntries(Object.entries(f||{}).map(([k,v])=>[k,val(v)]));
(async()=>{const token=JSON.parse(cp.execFileSync(process.execPath,[cli,'login:list','--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']})).result[0].tokens.access_token;
const base='https://firestore.googleapis.com/v1/projects/virtual-cube-timer/databases/(default)/documents',headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
async function get(s){const r=await fetch(base+'/'+s,{headers});if(r.status===404)return null;if(!r.ok)throw Error('Read '+r.status);return r.json();}
const r=await fetch(base+':runQuery',{method:'POST',headers,body:JSON.stringify({structuredQuery:{from:[{collectionId:'solves'}],where:{compositeFilter:{op:'AND',filters:[{fieldFilter:{field:{fieldPath:'rankingType'},op:'EQUAL',value:{stringValue:'single'}}},{fieldFilter:{field:{fieldPath:'valid'},op:'EQUAL',value:{booleanValue:true}}}]}},orderBy:[{field:{fieldPath:'time'},direction:'ASCENDING'}],limit:500}})});if(!r.ok)throw Error('Query '+r.status);
const top=[],seen=new Set();for(const x of await r.json()){if(!x.document)continue;const s=dec(x.document.fields);if(seen.has(s.uid)||s.mode==='real'||!(s.time>2&&s.time<3600))continue;seen.add(s.uid);top.push({uid:s.uid,name:s.name,time:s.time,solveId:x.document.name.split('/').at(-1),createdAt:s.createdAt,schemaVersion:s.schemaVersion});if(top.length===3)break;}
const raw=await get('rankingMedalPeriods?pageSize=100');if(raw.nextPageToken)throw Error('Certificate budget exceeded');const certs=(raw.documents||[]).map(d=>({id:d.name.split('/').at(-1),...dec(d.fields)}));
for(const p of top){const saved=await get('rankingMedals/'+p.uid);p.saved=saved?dec(saved.fields):null;p.events=certs.flatMap(c=>(c.winners||[]).flatMap((w,i)=>w.uid===p.uid?[{id:c.id,rank:i+1,awarded:c.v!==2||c.awardedUids.includes(p.uid)}]:[]));}
const totalRaw=await get('rankingMedals?pageSize=100');if(totalRaw.nextPageToken)throw Error('Totals budget exceeded');
const totals=(totalRaw.documents||[]).map(d=>({uid:d.name.split('/').at(-1),...dec(d.fields)}));
const specialRaw=await get('rankingSpecialAwards?pageSize=100');if(specialRaw.nextPageToken)throw Error('Special award budget exceeded');
const special=(specialRaw.documents||[]).map(d=>dec(d.fields));
for(const p of top)p.specialEvents=special.filter(s=>s.status==='complete').flatMap(s=>(s.awards||[]).filter(a=>a.uid===p.uid));
console.log(JSON.stringify({readOnly:true,top,certificateCount:certs.length,totals},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
