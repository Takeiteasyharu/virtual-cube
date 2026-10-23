// Administrator-only command. Uses local Firebase CLI OAuth in memory; never
// writes credentials. This file and node_modules are excluded from the Pages artifact.
import {execFileSync} from 'node:child_process';
import {randomScrambleForEvent} from 'cubing/scramble';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2),arg=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const project=arg('--project','virtual-cube-timer'),days=Number(arg('--days','30')),start=arg('--start',new Date().toISOString().slice(0,10));
if(!Number.isInteger(days)||days<1||days>366||!/^\d{4}-\d{2}-\d{2}$/.test(start))throw Error('Invalid date/days');
const emulator=args.includes('--emulator');if(emulator&&(!project.startsWith('demo-')||!process.env.FIRESTORE_EMULATOR_HOST))throw Error('Emulator mode requires a demo-* project and FIRESTORE_EMULATOR_HOST');
let token=emulator?'owner':process.env.DAILY_ADMIN_ACCESS_TOKEN;
if(!token){const command=process.platform==='win32'?'powershell.exe':'firebase',run=words=>execFileSync(command,process.platform==='win32'?['-NoProfile','-Command','firebase '+words.join(' ')]:words,{encoding:'utf8',stdio:['ignore','pipe','pipe']});run(['projects:list','--json']);const accounts=JSON.parse(run(['login:list','--json']));token=accounts.result?.[0]?.tokens?.access_token;}
if(!token)throw Error('Run firebase login (and projects:list to refresh) as an authorized project administrator first.');
const endpoint=`${emulator?'http://'+process.env.FIRESTORE_EMULATOR_HOST:'https://firestore.googleapis.com'}/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`;
async function call(url,options={}){const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});if(!r.ok){const e=Error(`Firestore ${r.status}`);e.status=r.status;throw e;}return r.json();}
let created=0,skipped=0;
for(let i=0;i<days;i++){
 const opens=new Date(start+'T00:00:00.000Z');opens.setUTCDate(opens.getUTCDate()+i);const date=opens.toISOString().slice(0,10),closes=new Date(opens.getTime()+86400000),url=`${endpoint}/dailyChallenges/${date}`;
 try{await call(url);console.log(`${date}: existing, unchanged`);skipped++;continue;}catch(e){if(e.status!==404)throw e;}
 const scramble=(await randomScrambleForEvent('333')).toString();if(!/^[RLUDFB]2?'?( [RLUDFB]2?'?)*$/.test(scramble))throw Error('Invalid random-state scramble');
 // cubing KPuzzle independently verifies the generated algorithm and its inverse.
 const {puzzles}=await import('cubing/puzzles'),{Alg}=await import('cubing/alg'),kpuzzle=await puzzles['3x3x3'].kpuzzle();
 if(!kpuzzle.algToTransformation(new Alg(scramble).concat(new Alg(scramble).invert())).isIdentityTransformation())throw Error('Scramble inverse verification failed');
 const fields={date:{stringValue:date},scramble:{stringValue:scramble},opensAt:{timestampValue:opens.toISOString()},closesAt:{timestampValue:closes.toISOString()},version:{integerValue:'1'}};
 try{await call(`${endpoint}/dailyChallenges?documentId=${date}`,{method:'POST',body:JSON.stringify({fields})});created++;console.log(`${date}: created`);}catch(e){if(e.status===409){skipped++;console.log(`${date}: concurrently created, unchanged`);}else throw e;}
}
console.log(JSON.stringify({project,start,days,created,skipped}));process.exit(0);
