// Add-only index management; no document reads/writes, deletes or billing changes.
import {execFileSync} from 'node:child_process';
const cli='C:/Users/harut/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js';
const run=args=>execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'true',NO_UPDATE_NOTIFIER:'1'}});
run(['projects:list','--json']);const accounts=JSON.parse(run(['login:list','--json'])),token=accounts.result?.[0]?.tokens?.access_token;if(!token)throw Error('Administrator login required');
const endpoint='https://firestore.googleapis.com/v1/projects/virtual-cube-timer/databases/(default)/collectionGroups/users/indexes';
const fields=['loginType','rankedBattles','rating'].map(fieldPath=>({fieldPath,order:'ASCENDING'}));
async function call(url,options={}){const response=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}});if(!response.ok){const error=await response.json();throw Error('Index request failed: '+response.status+' '+error.error?.message);}return response.json();}
let all=[],page;do{const data=await call(endpoint+(page?'?pageToken='+encodeURIComponent(page):''));all.push(...data.indexes||[]);page=data.nextPageToken;}while(page);
const match=all.find(index=>index.queryScope==='COLLECTION'&&JSON.stringify(index.fields.filter(f=>f.fieldPath!=='__name__').map(({fieldPath,order})=>({fieldPath,order})))===JSON.stringify(fields));
if(match)console.log(JSON.stringify({project:'virtual-cube-timer',existing:true,name:match.name,state:match.state}));
else if(process.argv.includes('--ensure')){const operation=await call(endpoint,{method:'POST',body:JSON.stringify({queryScope:'COLLECTION',fields})});console.log(JSON.stringify({project:'virtual-cube-timer',created:true,operation:operation.name}));}
else console.log(JSON.stringify({project:'virtual-cube-timer',existing:false,action:'Run with --ensure after tests pass',fields}));
if(process.argv.includes('--verify')){
 const field=(fieldPath,op,value)=>({fieldFilter:{field:{fieldPath},op,value}});
 const result=await call('https://firestore.googleapis.com/v1/projects/virtual-cube-timer/databases/(default)/documents:runAggregationQuery',{method:'POST',body:JSON.stringify({structuredAggregationQuery:{structuredQuery:{from:[{collectionId:'users'}],where:{compositeFilter:{op:'AND',filters:[field('loginType','EQUAL',{stringValue:'google'}),field('rankedBattles','GREATER_THAN',{integerValue:'0'}),field('rating','GREATER_THAN',{integerValue:'1200'})]}}},aggregations:[{alias:'ahead',count:{}}]}})});
 if(!Array.isArray(result)||!result.some(r=>r.result?.aggregateFields?.ahead))throw Error('Aggregate result unavailable');
 console.log(JSON.stringify({project:'virtual-cube-timer',battleRankAggregateVerified:true,individualRecordsRead:false}));
}
