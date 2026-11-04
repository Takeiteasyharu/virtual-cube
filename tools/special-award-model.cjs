// One explicitly authorized inaugural award; never used by browser automation.
const crypto=require('node:crypto');
const id='all-inaugural-v1',metrics=['single','ao5','moves','tps'],colors=['gold','silver','bronze'];
function validate(plan){
 if(plan.id!==id||plan.v!==1||!Array.isArray(plan.awards)||plan.awards.length!==12||!Number.isFinite(Date.parse(plan.readTime)))throw Error('Invalid fixed award snapshot');
 const ids=new Set();for(const metric of metrics){const rows=plan.awards.filter(a=>a.metric===metric);if(rows.length!==3||new Set(rows.map(a=>a.uid)).size!==3)throw Error('Expected three distinct players per metric');
 for(const a of rows){if(![1,2,3].includes(a.rank)||a.eventId!==`${id}_${metric}_${a.rank}`||a.color!==colors[a.rank-1]||typeof a.uid!=='string'||!a.uid||typeof a.name!=='string'||typeof a.solveId!=='string'||!Number.isFinite(a.value)||a.value<=0||ids.has(a.eventId))throw Error('Invalid award');ids.add(a.eventId);}}
 return plan;
}
function fingerprint(plan){validate(plan);return crypto.createHash('sha256').update(JSON.stringify({id:plan.id,readTime:plan.readTime,awards:plan.awards})).digest('hex');}
async function apply(sdk,db,plan){validate(plan);const hash=fingerprint(plan),uids=[...new Set(plan.awards.map(a=>a.uid))];
 return sdk.runTransaction(db,async tx=>{
 const root=sdk.doc(db,'rankingSpecialAwards',id),eventRefs=plan.awards.map(a=>sdk.doc(db,'rankingSpecialAwards',id,'events',a.eventId)),totalRefs=uids.map(uid=>sdk.doc(db,'rankingMedals',uid));
 const refs=[root,...eventRefs,...totalRefs];
 const [existing,...rest]=tx.getAll?await tx.getAll(...refs):await Promise.all(refs.map(ref=>tx.get(ref)));
 if(existing.exists()){if(existing.data().fingerprint!==hash||existing.data().status!=='complete')throw Error('Existing special award differs; refusing a replacement');return{added:0,recipients:0};}
 if(rest.slice(0,12).some(s=>s.exists()))throw Error('Partial or conflicting special events; stop without writes');
 const now=sdk.serverTimestamp();
 uids.forEach((uid,i)=>{const s=rest[12+i],before=s.exists()?s.data():{v:1,uid,gold:0,silver:0,bronze:0};
 if(before.v!==1||before.uid!==uid||colors.some(c=>!Number.isSafeInteger(before[c])||before[c]<0))throw Error('Invalid existing medal totals');
 const after={...before,updatedAt:now};for(const a of plan.awards.filter(a=>a.uid===uid))after[a.color]++;
 tx.set(totalRefs[i],after);
 });
 plan.awards.forEach((a,i)=>tx.set(eventRefs[i],{...a,v:1,type:'all-inaugural',awardId:id,awardedAt:now}));
 tx.set(root,{...plan,fingerprint:hash,type:'all-inaugural',status:'complete',completedAt:now});
 return{added:12,recipients:uids.length};
 });
}
module.exports={id,metrics,colors,validate,fingerprint,apply};
