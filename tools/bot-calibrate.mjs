// Bounded, read-only administrator analysis. Never exports UIDs or credentials.
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),M=require('../bot-model.js');
const cmd=process.platform==='win32'?'powershell.exe':'firebase';
const cli=words=>execFileSync(cmd,process.platform==='win32'?['-NoProfile','-Command','firebase '+words.join(' ')]:words,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
cli(['projects:list','--json']);const token=JSON.parse(cli(['login:list','--json'])).result[0].tokens.access_token;
const base='https://firestore.googleapis.com/v1/projects/virtual-cube-timer/databases/(default)/documents';
async function call(url,body){const response=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!response.ok)throw Error(`Read-only analysis failed: ${response.status}`);return response.json();}
const decode=v=>v?.stringValue??(v?.integerValue!==undefined?Number(v.integerValue):v?.doubleValue??v?.booleanValue??v?.timestampValue??null);
const raw=await call(base+':runQuery',{structuredQuery:{from:[{collectionId:'solves'}],orderBy:[{field:{fieldPath:'createdAt'},direction:'DESCENDING'}],limit:500,select:{fields:['uid','time','tps','moveCount','rankingType','valid','mode','source','completed','practice','bot','dnf','createdAt'].map(fieldPath=>({fieldPath}))}}});
const solves=raw.filter(r=>r.document).map(r=>Object.fromEntries(Object.entries(r.document.fields).map(([k,v])=>[k,decode(v)]))).map(r=>({...r,createdMs:Date.parse(r.createdAt)||0}));
const usable=solves.filter(M.valid),uids=[...new Set(usable.map(s=>s.uid))].slice(0,40),ratings={};
for(const uid of uids){try{const u=await call(base+'/users/'+encodeURIComponent(uid));const rating=decode(u.fields?.rating);if(Number.isFinite(rating))ratings[uid]=rating;}catch{}}
const model=M.calibrate(usable.filter(s=>uids.includes(s.uid)),ratings);
const report={readOnly:true,maxSolveReads:500,maxProfileReads:40,observedSolves:solves.length,verifiedNormalSolves:usable.length,legacySourceUnknown:solves.filter(s=>!s.source).length,usedUsers:model.users,pairedUsers:model.pairedUsers,calibrated:model.calibrated,reason:model.calibrated?'Verified normal samples used':'Insufficient verified normal provenance; reference distribution retained'};
// Data files are written by the caller using apply_patch, never credentials.
console.log(JSON.stringify({model,report},null,2));
