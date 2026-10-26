(function(root){
  'use strict';
  const config=Object.freeze({useRatingRange:false,botFallbackDelayMs:5000,botEnabledByDefault:true,queueLeaseMs:45000,heartbeatMs:15000,retryMs:2500});
  const preferenceKey='stcube.randomBattle.botEnabled';
  function ratingRange(waitMs){if(!config.useRatingRange)return Infinity;return waitMs<10000?50:waitMs<20000?100:waitMs<30000?200:Infinity;}
  function fresh(entry,now=Date.now()){
    const stamp=entry?.createdAt;
    const at=typeof stamp?.toMillis==='function'?stamp.toMillis():Number(entry?.startedAtMs);
    return entry?.status==='waiting'&&Number.isFinite(at)&&at<=now+5000&&now-at<config.queueLeaseMs;
  }
  function load(storage){try{const value=storage.getItem(preferenceKey);return value===null?config.botEnabledByDefault:value!=='false';}catch{return config.botEnabledByDefault;}}
  function save(storage,value){try{storage.setItem(preferenceKey,String(Boolean(value)));}catch{/* Private browsing: keep the in-memory selection. */}}
  const api={config,preferenceKey,ratingRange,fresh,load,save};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.Matchmaking=api;
})(typeof window==='object'?window:globalThis);
