/* Two-account ownership proofs, immutable source records, restartable receipts. */
(function(root){
 'use strict';
 function create(sdk,db){
 const {doc,getDoc,getDocs,collection,query,where,limit,runTransaction,serverTimestamp,Timestamp}=sdk;
 async function importSolve(uid,name,r,origin=null){
 const key=r.key,type=r.rankingType||'single',claim=doc(db,'solveImportClaims',key),single=doc(db,'solves','import_'+key+'_'+type),ao5=doc(db,'solves','import_'+key+'_ao5');
 try{return await runTransaction(db,async tx=>{
 const refs=[claim,single,...(r.existingSolveId?[doc(db,'solves','normal_'+r.existingSolveId+'_single')]:[])],snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
 if(snaps[0].exists()){if(snaps[0].data().uid!==uid)throw Error('This solve belongs to another account.');return false;}
 if(snaps[1].exists())throw Error('Import record exists without its receipt.');
 if(snaps[2]?.exists()){if(snaps[2].data().uid!==uid)throw Error('This solve is owned by another account.');return false;}
 const stamp=serverTimestamp(),keys=root.RankingMedals.keys(r.solvedAt),entry={schemaVersion:3,source:'normal',mode:'virtual',completed:true,valid:true,uid,name,time:r.time,tps:r.tps,moveCount:r.moveCount,moves:[],scramble:r.scramble,solveId:key,eventId:'import_'+key,rankingType:type,createdAt:stamp,solvedAt:Timestamp.fromMillis(r.solvedAt),dayKey:keys.today,weekKey:keys.week,monthKey:keys.month,importKind:origin?(origin.id.startsWith('local:')?'linked-local':'linked'):'local'};
 tx.set(claim,{v:1,uid,key,singleId:type==='single'?'import_'+key+'_single':'',ao5Id:type==='ao5'||Number.isFinite(r.ao5)?'import_'+key+'_ao5':'',createdAt:stamp,kind:entry.importKind,originUid:origin?.uid||'',originId:origin?.id||''});tx.set(single,entry);
 if(type==='single'&&Number.isFinite(r.ao5)&&r.ao5>2&&r.ao5<3600)tx.set(ao5,{...entry,rankingType:'ao5',time:r.ao5});return true;
 });}catch(error){
 // A concurrent create-only receipt may make Rules reject a stale transaction
 // before the SDK retries it. Only a committed receipt owned by this account
 // makes that failure an idempotent success; all other errors stay retryable.
 if(error.code==='permission-denied'){
  const saved=await getDoc(claim);
  if(saved.exists()&&saved.data().uid===uid&&saved.data().key===key)return false;
 }
 throw error;
 }
 }
 async function offer(source,target){const ref=doc(db,'accountLinks',source);await runTransaction(db,async tx=>{const old=await tx.get(ref);if(old.exists()){if(old.data().targetUid!==target)throw Error('Guest account is already linked to another account.');return;}tx.set(ref,{v:1,sourceUid:source,targetUid:target,status:'offered',createdAt:serverTimestamp()});});}
 async function accept(source,target,name){const ref=doc(db,'accountLinks',source);await runTransaction(db,async tx=>{const s=await tx.get(ref),a=s.data();if(a?.targetUid!==target)throw Error('No matching account ownership proof.');if(a.status!=='offered')return;tx.update(ref,{status:'accepted',targetName:name,acceptedAt:serverTimestamp()});});}
 async function sources(target){const s=await getDocs(query(collection(db,'accountLinks'),where('targetUid','==',target),limit(30)));return s.docs.map(d=>d.data()).filter(a=>['accepted','complete'].includes(a.status));}
 async function offers(target){const s=await getDocs(query(collection(db,'accountLinks'),where('targetUid','==',target),limit(30)));return s.docs.map(d=>d.data()).filter(a=>a.status==='offered');}
 async function retire(sourceUid){await runTransaction(db,async tx=>{const ref=doc(db,'rankingRetirements',sourceUid),userRef=doc(db,'users',sourceUid),[retired,source]=await Promise.all([tx.get(ref),tx.get(userRef)]);if(!retired.exists())tx.set(ref,{v:1,retired:true,retiredAt:serverTimestamp()});if(source.exists()&&!source.data().rankArchived)tx.update(userRef,{rankArchived:true,updatedAt:serverTimestamp()});});}
 async function resume(target,name){const links=await sources(target);let added=0;
 for(const link of links){if(link.status==='complete'){await retire(link.sourceUid);continue;}
 // Stable document-ID pagination: never reread every source on every page visit.
 let cursor=link.cursor||'';const rows=await getDocs(query(collection(db,'solves'),where('uid','==',link.sourceUid),sdk.orderBy(sdk.documentId()),...(cursor?[sdk.startAfter(cursor)]:[]),limit(30)));
 for(const d of rows.docs){const s=d.data();if(!['single','ao5'].includes(s.rankingType)||s.mode==='real'||s.source&&s.source!=='normal'||s.valid!==true)continue;
 const solved=s.solvedAt?.toMillis?.()||s.createdAt?.toMillis?.();if(!Number.isFinite(solved))continue;
 const key=await root.HistorySync.digest('linked:'+d.id),input={key,rankingType:s.rankingType,time:Number(s.time),tps:Number(s.tps)||0,moveCount:Number(s.moveCount)||0,scramble:s.scramble,solvedAt:solved,ao5:null};
 added+=await importSolve(target,name,input,{uid:link.sourceUid,id:d.id})?1:0;
 }
 cursor=rows.docs.at(-1)?.id||cursor;
 await sdk.updateDoc(doc(db,'accountLinks',link.sourceUid),{cursor,status:rows.size<30?'complete':'accepted',updatedAt:serverTimestamp()});
 if(rows.size<30)await retire(link.sourceUid);
 }return {added,pending:links.some(l=>l.status!=='complete')};
 }
 async function transferMedal(uid,source,awardId,kind,rank,color,specialRoot=''){
 const eventId=kind==='period'?'period_'+awardId+'_'+source:'special_'+awardId,ref=doc(db,'users',uid,'medalImports',eventId),counter=doc(db,'rankingMedals',uid);
 try{return await runTransaction(db,async tx=>{const [receipt,total]=await Promise.all([tx.get(ref),tx.get(counter)]);if(receipt.exists())return false;
 const c=root.RankingMedals.counts(total.data()),stamp=serverTimestamp();c[color]++;
 tx.set(ref,{v:1,id:eventId,uid,sourceUid:source,awardId,kind,rank,color,specialRoot,createdAt:stamp});
 tx.set(counter,{v:1,uid,...c,lastPeriodId:total.data()?.lastPeriodId||'',transferEventId:eventId,updatedAt:stamp});return true;});}
 catch(error){if(error.code==='permission-denied'&&(await getDoc(ref)).exists())return false;throw error;}
 }
 async function medals(uid){const links=await sources(uid);let added=0,pending=false;
 for(const link of links){const source=link.sourceUid,progressRef=doc(db,'users',uid,'mergeProgress',source),[before,total]=await Promise.all([getDoc(progressRef),getDoc(doc(db,'rankingMedals',source))]);const c=root.RankingMedals.counts(total.data()),score=JSON.stringify(c),old=before.data();if(old?.complete&&old.score===score)continue;
 if(c.gold+c.silver+c.bronze===0){await sdk.setDoc(progressRef,{v:1,sourceUid:source,score,cursor:'',complete:true,updatedAt:serverTimestamp()});continue;}
 let cursor=old?.score===score?old.cursor||'':'';let complete=false;
 for(let page=0;page<10;page++){const snap=await getDocs(query(collection(db,'rankingMedalPeriods'),sdk.orderBy(sdk.documentId()),...(cursor?[sdk.startAfter(cursor)]:[]),limit(30)));
 for(const d of snap.docs){const a=d.data();if(a.status!=='finalized')continue;const rank=(a.winners||[]).findIndex(w=>w.uid===source);if(rank<0||a.v===2&&!a.awardedUids.includes(source))continue;
 added+=await transferMedal(uid,source,d.id,'period',rank,['gold','silver','bronze'][rank])?1:0;
 }cursor=snap.docs.at(-1)?.id||cursor;complete=snap.size<30;if(complete)break;
 }
 const special=await getDoc(doc(db,'rankingSpecialAwards','all-inaugural-v1'));for(const a of special.data()?.awards||[])if(a.uid===source)added+=await transferMedal(uid,source,a.eventId,'special',a.rank-1,a.color,'all-inaugural-v1')?1:0;
 await sdk.setDoc(progressRef,{v:1,sourceUid:source,score,cursor,complete,updatedAt:serverTimestamp()});pending ||= !complete;
 }return {added,pending};
 }
 return {importSolve,offer,accept,sources,offers,resume,medals};
 }
 root.AccountMigration={create};
})(typeof window==='object'?window:globalThis);
