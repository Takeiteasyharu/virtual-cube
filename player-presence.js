(function(root){
  'use strict';
  const config={heartbeatMs:30000,onlineMs:90000};
  function hasOther(rows,uid,now=Date.now()){
    return rows.some(row=>row.id!==uid && Number.isFinite(row.at) && row.at>now-config.onlineMs && row.at<=now+5000);
  }
  function create({sdk,db,openBattle,win=root}){
    const d=win.document;let uid=null,generation=0,release=null,abort=null,timer=null,unsubscribe=null,expiry=null;
    let rows=[],positive=false,pending=false,hideTimer=null;
    const toast=d.createElement('aside');toast.className='presence-toast';toast.hidden=true;
    toast.setAttribute('aria-live','polite');
    toast.innerHTML='<div>Other players are online! Try a Random Battle.</div><button type="button" data-find>Find Ranked Match</button><button type="button" data-close aria-label="Dismiss notification">×</button>';
    d.body.append(toast);
    function dismiss(){toast.hidden=true;win.clearTimeout(hideTimer);}
    function safe(){return !d.hidden && win.navigator.onLine!==false && !d.body.matches('.solving,.inspection-active,.normal-solve-focus,.battle-mode,.guided-mode') && !win.isTimerRunning?.() && !win.SolveReplay?.active && !win.BattleEnd?.active && !win.DailyChallenge?.active && !d.querySelector('.app-modal:not([hidden]),dialog[open]');}
    function display(){if(!safe()){dismiss();return;}if(pending&&positive){pending=false;toast.hidden=false;hideTimer=win.setTimeout(dismiss,6000);}}
    function observe(){const next=hasOther(rows,uid);if(next&&!positive)pending=true;if(!next){pending=false;dismiss();}positive=next;display();}
    toast.querySelector('[data-close]').onclick=dismiss;
    toast.querySelector('[data-find]').onclick=()=>{dismiss();openBattle();};
    const observer=new win.MutationObserver(display);
    observer.observe(d.body,{attributes:true,attributeFilter:['class']});
    d.querySelectorAll('.app-modal').forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['hidden']}));
    function stop(){generation++;abort?.abort();abort=null;release?.();release=null;win.clearTimeout(timer);win.clearInterval(expiry);unsubscribe?.();unsubscribe=null;dismiss();}
    async function lead(token){
      if(token!==generation)return;
      let done;const held=new Promise(resolve=>{done=resolve;});release=done;
      async function beat(){
        if(token!==generation)return;
        try{await sdk.setDoc(sdk.doc(db,'playerPresence',uid),{lastSeen:sdk.serverTimestamp(),v:1});}catch{/* Presence must never interrupt play. */}
        if(token!==generation)return;
        unsubscribe?.();
        const q=sdk.query(sdk.collection(db,'playerPresence'),sdk.where('lastSeen','>',sdk.Timestamp.fromMillis(Date.now()-config.onlineMs)),sdk.orderBy('lastSeen','desc'),sdk.limit(2));
        unsubscribe=sdk.onSnapshot(q,snap=>{if(token!==generation)return;rows=snap.docs.map(doc=>({id:doc.id,at:doc.data().lastSeen?.toMillis?.()}));observe();},()=>{rows=[];observe();});
        timer=win.setTimeout(beat,config.heartbeatMs);
      }
      expiry=win.setInterval(observe,1000);beat();await held;
    }
    function sync(){
      const next=uid;stop();uid=next;
      if(!uid||d.hidden||win.navigator.onLine===false)return;
      const token=generation;
      // Web Locks elect one visible tab per UID without Firestore lease traffic.
      if(win.navigator.locks){abort=new win.AbortController();win.navigator.locks.request('stcube-presence-'+uid,{signal:abort.signal},()=>lead(token)).catch(()=>{});}
      else { // Older browsers still deduplicate users by document ID; Rules throttle writes.
        lead(token);
      }
    }
    for(const name of ['visibilitychange'])d.addEventListener(name,sync);
    for(const name of ['online','offline','pageshow'])win.addEventListener(name,sync);
    win.addEventListener('pagehide',stop);
    return {setUser(user){if(uid!==user?.uid){rows=[];positive=false;pending=false;}uid=user?.uid||null;sync();},dispose(){stop();observer.disconnect();d.removeEventListener('visibilitychange',sync);for(const name of ['online','offline','pageshow'])win.removeEventListener(name,sync);win.removeEventListener('pagehide',stop);toast.remove();}};
  }
  const api={config,hasOther,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.PlayerPresence=api;
})(typeof window==='object'?window:globalThis);
