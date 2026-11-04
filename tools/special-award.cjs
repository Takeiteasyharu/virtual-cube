// Administrator-only CLI. Nothing in this file is published to Pages.
// Snapshot -> Emulator verification -> apply exact snapshot -> verify/rerun.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),M=require('./special-award-model.cjs');
const args=process.argv.slice(2),mode=args[0],file=args[1];
function val(v){if('stringValue'in v)return v.stringValue;if('integerValue'in v)return +v.integerValue;if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;if('timestampValue'in v)return v.timestampValue;if('arrayValue'in v)return(v.arrayValue.values||[]).map(val);if('mapValue'in v)return dec(v.mapValue.fields||{});return null;}
const dec=f=>Object.fromEntries(Object.entries(f||{}).map(([k,v])=>[k,val(v)]));
function enc(v){if(v&&v.__serverTimestamp)throw Error('Timestamp must use a transform');if(v===null)return{nullValue:null};if(Array.isArray(v))return{arrayValue:{values:v.map(enc)}};if(typeof v==='object')return{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,enc(x)]))}};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(typeof v==='boolean')return{booleanValue:v};return{stringValue:v};}
(async()=>{
 if(!['snapshot','apply','verify'].includes(mode))throw Error('Usage: special-award.cjs snapshot | apply <snapshot> | verify <snapshot>');
 const cli='C:/Users/harut/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js';
 cp.execFileSync(process.execPath,[cli,'projects:list','--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const token=JSON.parse(cp.execFileSync(process.execPath,[cli,'login:list','--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']})).result?.[0]?.tokens?.access_token;if(!token)throw Error('Administrator CLI login required');
 const base='https://firestore.googleapis.com/v1/projects/virtual-cube-timer/databases/(default)/documents',headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
async function call(s,body){const r=await fetch(base+s,{signal:AbortSignal.timeout(30000),method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})});if(r.status===404){await r.text();return null;}if(!r.ok)throw Error('Firestore '+r.status+' '+(await r.text()).slice(0,500));return r.json();}
 const name=p=>'projects/virtual-cube-timer/databases/(default)/documents/'+p;
 if(mode==='snapshot'){
 const raw={},awards=[];let readTime;
 for(const metric of M.metrics){const field=metric==='tps'?'tps':metric==='moves'?'moveCount':'time';
 const filter=(fieldPath,value)=>({fieldFilter:{field:{fieldPath},op:'EQUAL',value}});
 const rows=await call(':runQuery',{...(readTime?{readTime}:{}),structuredQuery:{from:[{collectionId:'solves'}],where:{compositeFilter:{op:'AND',filters:[filter('valid',{booleanValue:true}),filter('rankingType',{stringValue:metric==='ao5'?'ao5':'single'})]}},orderBy:[{field:{fieldPath:field},direction:metric==='tps'?'DESCENDING':'ASCENDING'}],limit:1000}});
 readTime ||= rows[0]?.readTime;if(!readTime)throw Error('No snapshot timestamp');raw[metric]=rows;
 const seen=new Set();for(const row of rows){if(!row.document)continue;const s=dec(row.document.fields),time=Number(s.time),value=Number(s[field]);
 if(typeof s.uid!=='string'||!s.uid||seen.has(s.uid)||s.mode==='real'||!Number.isFinite(time)||time<=2||time>=3600||typeof s.scramble!=='string'||!s.scramble.trim()||!Number.isFinite(value)||value<=0)continue;
 seen.add(s.uid);const rank=seen.size;awards.push({eventId:`${M.id}_${metric}_${rank}`,metric,rank,uid:s.uid,name:s.name||'Player',solveId:row.document.name.split('/').at(-1),value,color:M.colors[rank-1]});if(rank===3)break;}
 }
 const plan={v:1,id:M.id,readTime,awards};M.validate(plan);
 const backup={project:'virtual-cube-timer',plan,queries:raw,totals:{},existingAward:await call('/rankingSpecialAwards/'+M.id)};
 if(backup.existingAward)throw Error('Special award already exists; use its original snapshot');
 for(const uid of new Set(awards.map(a=>a.uid)))backup.totals[uid]=await call('/rankingMedals/'+uid);
 const dir=path.join(process.cwd(),'.private-medal-backups','special-'+readTime.replace(/[:.]/g,'-'));fs.mkdirSync(dir,{recursive:true});const output=path.join(dir,'snapshot.json');
 fs.writeFileSync(output,JSON.stringify(backup,null,2),{flag:'wx'});console.log(JSON.stringify({snapshot:output,fingerprint:M.fingerprint(plan),awards,recipients:Object.keys(backup.totals).length},null,2));return;
 }
 if(!file)throw Error('Original snapshot path required');const backup=JSON.parse(fs.readFileSync(file));if(backup.project!=='virtual-cube-timer')throw Error('Wrong project');const plan=M.validate(backup.plan);
 if(mode==='apply'){
 const preflight={at:new Date().toISOString(),totals:{},allTotals:await call('/rankingMedals?pageSize=100'),award:await call('/rankingSpecialAwards/'+M.id)};
 if(preflight.allTotals.nextPageToken)throw Error('Backup budget exceeded; stop without writes');
 for(const uid of new Set(plan.awards.map(a=>a.uid)))preflight.totals[uid]=await call('/rankingMedals/'+uid);
 fs.writeFileSync(path.join(path.dirname(file),'preflight-'+Date.now()+'.json'),JSON.stringify(preflight,null,2),{flag:'wx'});
 const sdk=require('./special-award-rest.cjs')(call,name);
 console.log(JSON.stringify(await M.apply(sdk,null,plan)));return;
 }
 const root=await call('/rankingSpecialAwards/'+M.id);if(!root||dec(root.fields).fingerprint!==M.fingerprint(plan))throw Error('Missing/mismatching special snapshot');
 const results=[];for(const uid of new Set(plan.awards.map(a=>a.uid))){const current=dec((await call('/rankingMedals/'+uid)).fields),before=backup.totals[uid]?dec(backup.totals[uid].fields):{gold:0,silver:0,bronze:0};for(const color of M.colors){const added=plan.awards.filter(a=>a.uid===uid&&a.color===color).length;if(current[color]<before[color]+added)throw Error('Missing increment '+uid);}results.push({uid,current:{gold:current.gold,silver:current.silver,bronze:current.bronze},special:plan.awards.filter(a=>a.uid===uid).length});}
 for(const a of plan.awards){const e=await call('/rankingSpecialAwards/'+M.id+'/events/'+a.eventId);if(!e||['uid','color','metric','rank','solveId'].some(k=>dec(e.fields)[k]!==a[k]))throw Error('Missing/mismatching event');}
 const before=fs.readdirSync(path.dirname(file)).filter(f=>/^preflight-.*\.json$/.test(f)).sort().map(f=>JSON.parse(fs.readFileSync(path.join(path.dirname(file),f)))).find(b=>!b.award);if(!before)throw Error('Pre-application backup missing');
 let preserved=0;for(const d of before.allTotals.documents||[]){const old=dec(d.fields),current=dec((await call('/rankingMedals/'+d.name.split('/').at(-1))).fields);for(const c of M.colors){const delta=plan.awards.filter(a=>a.uid===old.uid&&a.color===c).length;if(current[c]!==old[c]+delta)throw Error('Existing medals changed unexpectedly');}preserved++;}
 console.log(JSON.stringify({verified:true,events:12,recipients:results.length,existingRecipientsPreserved:preserved,results},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
