/* Versioned, idempotent record writer. No renderer, auth or UI dependencies. */
(function(root){
  'use strict';
  const Progress=root.ProfileProgress||(typeof require==='function'?require('./profile-progress.js'):null);
  const Calendar=root.ActivityCalendar||(typeof require==='function'?require('./activity-calendar.js'):null);
  const scope='normal-virtual-and-human-battles-v1';
  const fields=['normalSolves','totalMoves','totalTimeMs','tpsMilliSum','pbMs','ao5Ms','ao12Ms','rankedBattles','rankedWins','rankedLosses','rankedDraws','rankedDnfs','friendBattles','friendWins','friendLosses','friendDraws','friendDnfs'];
  const eligible=s=>s?.source==='normal'&&s.mode==='virtual'&&s.rankingEligible===true&&/^[A-Za-z0-9_-]{10,100}$/.test(s.solveId||'');
  function advance(old,event,stamp){
    const next={v:1,scope,trackingStartedAt:old?.trackingStartedAt||stamp,updatedAt:stamp,lastEventId:event.id};
    for(const f of fields)next[f]=Number(old?.[f]||0);
    if(event.kind==='normal'){
      next.normalSolves++;next.totalMoves+=event.moveCount;next.totalTimeMs+=event.timeMs;next.tpsMilliSum+=event.tpsMilli;
      next.pbMs=next.pbMs?Math.min(next.pbMs,event.timeMs):event.timeMs;next.ao5Ms=event.ao5Ms;next.ao12Ms=event.ao12Ms;
    }else{
      next[event.kind+'Battles']++;
      next[event.kind+({win:'Wins',loss:'Losses',draw:'Draws',dnf:'Dnfs'}[event.result])]++;
    }
    return next;
  }
  function outcome(room,player,uid){
    if(room.isBot||!['ranked','friend'].includes(room.mode))throw Error('Not a human battle');
    if(room.flowVersion===3){const r=room.roundResults?.[uid];if(!r)throw Error('Missing round certificate');if(r.status==='dnf')return 'dnf';return (room.winnerUids||[]).includes(uid)?(room.winnerUids.length>1?'draw':'win'):'loss';}
    if(room.isDraw)return 'draw';
    if(room.timeLimitReached||player?.status==='finished')return room.winnerUid===uid?'win':'loss';
    return 'dnf';
  }
  function create(sdk,db){
    const {doc,runTransaction,serverTimestamp,getDoc,getDocs,collection,query,where,limit}=sdk;
    const cleanCalendar=(value,stamp)=>{const {changed,...data}=value;return {...data,updatedAt:stamp};};
    async function prepareCalendar(uid){
      const ref=doc(db,'users',uid,'activityCalendar','current'),detailRef=doc(db,'users',uid,'profileStats','details');
      let [snapshot,detail]=await Promise.all([getDoc(ref),getDoc(detailRef)]);
      if(!snapshot.exists())await runTransaction(db,async tx=>{if(!(await tx.get(ref)).exists())tx.set(ref,cleanCalendar(Calendar.empty(),serverTimestamp()));});
      snapshot=await getDoc(ref);if(snapshot.data().days===Number(detail.data()?.activeDays||0))return;
      const days=await getDocs(query(collection(db,'users',uid,'activityDays'),where('dayIndex','>',snapshot.data().lastDay),limit(1000)));
      for(const d of days.docs)await runTransaction(db,async tx=>{
        const snap=await tx.get(ref),next=Calendar.insert(snap.data(),Number(d.data().dayIndex));
        if(next.changed)tx.set(ref,cleanCalendar(next,serverTimestamp()));
      });
      const caughtUp=await runTransaction(db,async tx=>{const [cal,current]=await Promise.all([tx.get(ref),tx.get(detailRef)]);return cal.data().days===Number(current.data()?.activeDays||0);});
      if(!caughtUp)throw Error('Activity calendar bootstrap incomplete; result remains pending for the next bounded sync');
    }
    async function progressRead(tx,uid){
      const day=Progress.dayIndex(Date.now()),detailRef=doc(db,'users',uid,'profileStats','details'),dayRef=doc(db,'users',uid,'activityDays',String(day));
      const [detail,activity]=await Promise.all([tx.get(detailRef),tx.get(dayRef)]);return {day,detailRef,dayRef,detail:detail.data(),exists:activity.exists()};
    }
    function progressWrite(tx,uid,p,before,after,e,stamp){
      e.featureVersion=2;e.utcDay=p.day;
      tx.set(p.detailRef,Progress.advance(p.detail,before,after,e,stamp,p.day,p.exists));
      if(!p.exists)tx.set(p.dayRef,{v:1,uid,dayIndex:p.day,firstEventId:e.id,createdAt:stamp});
    }
    async function commit(work){
      // Rules can observe a competing commit before the SDK reports ABORTED.
      // Start a fresh transaction (and re-read the fixed event ID) on either code.
      for(let attempt=0;;attempt++)try{return await runTransaction(db,work);}catch(error){
        if(attempt>=4||!['permission-denied','aborted'].includes(error.code))throw error;
        await new Promise(resolve=>setTimeout(resolve,30+Math.random()*70));
      }
    }
    async function normal(uid,name,input,keys){
      if(!eligible(input)||!Number.isFinite(input.time)||input.time<=2||input.time>=3600)throw Error('Not an eligible normal solve');
      const id='normal_'+input.solveId,singleId=id+'_single',ao5Id=id+'_ao5';
      const er=doc(db,'users',uid,'profileEvents',id),sr=doc(db,'users',uid,'profileStats','current'),ur=doc(db,'users',uid),single=doc(db,'solves',singleId);
      return commit(async tx=>{
        const [e,s,u,existing]=await Promise.all([tx.get(er),tx.get(sr),tx.get(ur),tx.get(single)]);
        if(e.exists())return false;
        if(existing.exists())throw Error('Solve ID already belongs to a recorded solve');
        const progress=await progressRead(tx,uid);
        const stamp=serverTimestamp(),hasAo5=Number.isFinite(input.ao5)&&input.ao5>2&&input.ao5<3600;
        const event={v:1,id,uid,kind:'normal',createdAt:stamp,timeMs:Math.round(input.time*1000),moveCount:input.moveCount,tpsMilli:Math.round(input.tps*1000),ao5Ms:hasAo5?Math.round(input.ao5*1000):0,ao12Ms:Number.isFinite(input.ao12)?Math.round(input.ao12*1000):0,singleId,ao5Id:hasAo5?ao5Id:''};
        const entry={schemaVersion:2,solveId:input.solveId,eventId:id,uid,name,source:'normal',completed:true,valid:true,mode:'virtual',scramble:input.scramble,time:input.time,tps:input.tps,moveCount:input.moveCount,moves:input.moves,dayKey:keys.today,weekKey:keys.week,monthKey:keys.month,createdAt:stamp};
        tx.set(single,{...entry,rankingType:'single'});
        if(hasAo5)tx.set(doc(db,'solves',ao5Id),{...entry,rankingType:'ao5',time:input.ao5});
        const summary=advance(s.data(),event,stamp);progressWrite(tx,uid,progress,s.data(),summary,event,stamp);
        tx.set(er,event);tx.set(sr,summary);
        const old=u.data()||{},n=Number(old.validSolves||0),avg=Number(old.averageTps||0);
        tx.set(ur,{normalSinglePbMs:summary.pbMs,pb:Math.min(Number(old.pb)||Infinity,input.time),ao5:hasAo5?input.ao5:null,ao12:Number.isFinite(input.ao12)?input.ao12:null,totalSolves:Number(old.totalSolves||0)+1,validSolves:n+1,bestTps:Math.max(Number(old.bestTps||0),input.tps),averageTps:(avg*n+input.tps)/(n+1),lastSolveAt:stamp,updatedAt:stamp},{merge:true});
        return true;
      });
    }
    async function battle(uid,resultId,roomId,round,details){
      const er=doc(db,'users',uid,'profileEvents','battle_'+resultId),sr=doc(db,'users',uid,'profileStats','current'),rr=doc(db,'battleResults',resultId),roomRef=doc(db,'battleRooms',roomId),pr=doc(db,'battleRooms',roomId,'players',uid),ur=doc(db,'users',uid);
      const preliminary=await getDoc(roomRef);if(preliminary.data()?.flowVersion===3)await prepareCalendar(uid);
      return commit(async tx=>{
        const [e,s,r,roomSnap,playerSnap,u]=await Promise.all([tx.get(er),tx.get(sr),tx.get(rr),tx.get(roomRef),tx.get(pr),tx.get(ur)]);
        // Existing pre-v1 results are not migrated or counted retroactively.
        if(e.exists()||r.exists())return false;
        const room=roomSnap.data(),player=playerSnap.data();
        if(!room||room.status!=='finished'||room.round!==round||!player||player.round!==round||room.isBot||!['friend','ranked'].includes(room.mode))throw Error('Round is not final');
        if(room.mode==='ranked'&&![room.hostUid,room.guestUid].includes(uid))throw Error('Not a participant');
        if(room.mode==='friend'&&room.maxPlayers>2&&!(room.activePlayerUids||[]).includes(uid))throw Error('Not a participant');
        let progress,calendar=null,calRef=null;
        if(room.flowVersion===3){
          const cert=room.roundResults?.[uid];if(!cert?.endedAt?.toMillis)throw Error('Missing original completion date');
          const day=Progress.dayIndex(room.finishedAt.toMillis());calRef=doc(db,'users',uid,'activityCalendar','current');
          const [cal,detail,activity]=await Promise.all([tx.get(calRef),tx.get(doc(db,'users',uid,'profileStats','details')),tx.get(doc(db,'users',uid,'activityDays',String(day)))]);
          if(cal.data()?.days!==Number(detail.data()?.activeDays||0))throw Error('Activity calendar changed; retry pending result');
          calendar=activity.exists()?cal.data():Calendar.insert(cal.data(),day);
          progress={day,detailRef:doc(db,'users',uid,'profileStats','details'),dayRef:doc(db,'users',uid,'activityDays',String(day)),detail:detail.data(),exists:activity.exists()};
        }else progress=await progressRead(tx,uid);
        const result=outcome(room,player,uid),stamp=serverTimestamp(),id='battle_'+resultId;
        const event={v:1,id,uid,kind:room.mode,resultId,roomId,round,result,createdAt:stamp};
        tx.set(rr,{...details,uid,result,mode:room.mode,roomId,round,schemaVersion:2,eventId:id,createdAt:stamp});
        const summary=advance(s.data(),event,stamp);
        if(calendar){
          event.featureVersion=3;event.utcDay=progress.day;
          tx.set(progress.detailRef,Progress.advance(progress.detail,s.data(),summary,event,stamp,progress.day,progress.exists,calendar));
          if(!progress.exists){tx.set(progress.dayRef,{v:1,uid,dayIndex:progress.day,firstEventId:event.id,createdAt:stamp});tx.set(calRef,cleanCalendar(calendar,stamp));}
        }else progressWrite(tx,uid,progress,s.data(),summary,event,stamp);
        tx.set(er,event);tx.set(sr,summary);
        // Ranked legacy counters are still owned by the existing Elo transaction.
        if(room.mode==='friend'){
          const old=u.data()||{},won=result==='win',lost=result==='loss';
          tx.set(ur,{wins:Number(old.wins||0)+(won?1:0),losses:Number(old.losses||0)+(lost?1:0),friendBattles:Number(old.friendBattles||0)+1,friendWins:Number(old.friendWins||0)+(won?1:0),friendLosses:Number(old.friendLosses||0)+(lost?1:0),friendDraws:Number(old.friendDraws||0)+(result==='draw'?1:0),friendDnfs:Number(old.friendDnfs||0)+(result==='dnf'?1:0),updatedAt:stamp},{merge:true});
        }
        return true;
      });
    }
    return {normal,battle};
  }
  const api={eligible,advance,outcome,create,fields,scope};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ProfileRecords=api;
})(typeof window==='object'?window:globalThis);
