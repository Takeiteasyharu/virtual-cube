/* Participant-authorized, immutable per-round results. No UI or Elo formula. */
(function(root){
 'use strict';
 const VERSION=3,ROUND_SECONDS=300,OFFLINE_SECONDS=90;
 const millis=t=>t?.toMillis?.()||0;
 const participants=r=>r.mode==='friend'&&r.maxPlayers>2?r.activePlayerUids||[]:[r.hostUid,r.guestUid].filter(Boolean);
 function empty(){return {flowVersion:VERSION,roundResults:{},resultCount:0,bestTime:null,bestScore:-1,winnerUids:[],roundStartedAt:null};}
 function aggregate(room,uid,result){
  const results={...(room.roundResults||{}),[uid]:result},entries=Object.entries(results),completed=entries.filter(([,r])=>r.status==='finished');
  let bestTime=null,bestScore=-1,winners=[];
  if(completed.length){bestTime=Math.min(...completed.map(([,r])=>r.time));winners=completed.filter(([,r])=>r.time===bestTime).map(([id])=>id);}
  else{const timed=entries.filter(([,r])=>r.status==='time_limit');if(timed.length){bestScore=Math.max(...timed.map(([,r])=>r.score));winners=timed.filter(([,r])=>r.score===bestScore).map(([id])=>id);}}
  const final=entries.length===participants(room).length;
  return {pendingParticipantUids:final?[]:participants(room),roundResults:results,resultCount:entries.length,bestTime,bestScore,winnerUids:winners,status:final?'finished':room.status,
   winnerUid:final&&winners.length===1?winners[0]:'',winnerName:final&&winners.length===1?(results[winners[0]].name||'Player'):'',
   isDraw:final&&(winners.length!==1),timeLimitReached:final&&!completed.length&&bestScore>=0};
 }
 function outcome(room,uid){
  const r=room.roundResults?.[uid];if(!r)return 'pending';if(room.status!=='finished')return r.status==='finished'?'pending':'dnf';
  if(r.status==='dnf')return 'dnf';
  if((room.winnerUids||[]).includes(uid))return room.winnerUids.length>1?'draw':'win';return 'loss';
 }
 function expires(room,player,now){
  const start=millis(room.roundStartedAt),last=millis(player?.updatedAt);
  const deadline=start?start+ROUND_SECONDS*1000:Infinity,offline=last?last+OFFLINE_SECONDS*1000:Infinity;
  return now>=Math.min(deadline,offline)?Math.min(deadline,offline):null;
 }
 function create(sdk,db){
  const {doc,runTransaction,serverTimestamp,Timestamp}=sdk;
  async function commit(work){
   // A competing presence/start write can be evaluated by Rules before the
   // SDK receives ABORTED. Re-read the immutable result key on a fresh attempt.
   for(let attempt=0;;attempt++)try{return await runTransaction(db,work);}catch(error){
    if(attempt>=4||!['permission-denied','aborted'].includes(error.code))throw error;
    await new Promise(resolve=>setTimeout(resolve,50+Math.random()*150));
   }
  }
  async function finish(roomId,uid,payload=null,targetUid=uid){
   const rr=doc(db,'battleRooms',roomId),pr=doc(db,'battleRooms',roomId,'players',targetUid);
   return commit(async tx=>{
    const [rs,ps]=await Promise.all([tx.get(rr),tx.get(pr)]),room=rs.data(),player=ps.data();
    if(!room||room.flowVersion!==VERSION||!participants(room).includes(uid)||!participants(room).includes(targetUid))throw Error('Not a round participant');
    if(room.roundResults?.[targetUid]||room.status==='finished')return room;
    let status,time=null,score=0,endedAt;
    if(payload){
     if(targetUid!==uid)throw Error('Cannot submit another player’s solve');
     status=payload.status;time=status==='finished'?payload.finalTime:null;score=status==='time_limit'?Math.max(0,Math.min(54,Math.floor(payload.maxCompletionScore||0))):0;
     if(!['finished','dnf','time_limit'].includes(status))throw Error('Invalid terminal status');
     endedAt=serverTimestamp();tx.update(pr,{...payload,status,active:false,ready:false,endTime:endedAt,finishedAt:endedAt,updatedAt:endedAt});
    }else{
     const expiry=expires(room,player,Date.now());if(expiry===null)return room;status='dnf';
     const choices=[];if(room.roundStartedAt)choices.push(new Timestamp(room.roundStartedAt.seconds+ROUND_SECONDS,room.roundStartedAt.nanoseconds));if(player?.updatedAt)choices.push(new Timestamp(player.updatedAt.seconds+OFFLINE_SECONDS,player.updatedAt.nanoseconds));endedAt=choices.sort((a,b)=>a.toMillis()-b.toMillis())[0];
    }
    const result={status,time,score,endedAt,name:String(player?.name||'Player').slice(0,24),round:room.round};
    const next=aggregate(room,targetUid,result),stamp=serverTimestamp();
    const latestEndedAt=payload?endedAt:(millis(room.latestEndedAt)>millis(endedAt)?room.latestEndedAt:endedAt);
    const update={...next,latestEndedAt,resultActorUid:targetUid,updatedAt:stamp};if(!room.roundStartedAt)update.roundStartedAt=stamp;
    if(next.status==='finished'){
     update.finishedAt=latestEndedAt;
     for(const participant of participants(room))tx.set(doc(db,'battleInboxes',participant,'rounds',roomId+'_'+room.round),{uid:participant,roomId,round:room.round,state:'pending',createdAt:stamp});
    }
    tx.update(rr,update);return {...room,...update};
   });
  }
  return {finish,expire:(roomId,uid,targetUid)=>finish(roomId,uid,null,targetUid)};
 }
 const api={VERSION,ROUND_SECONDS,OFFLINE_SECONDS,millis,participants,empty,aggregate,outcome,expires,create};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.BattleFlow=api;
})(typeof window==='object'?window:globalThis);
