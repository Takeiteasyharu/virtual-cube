/* Personal end flow; deliberately independent of the room's finalization clock. */
(function(root){
 'use strict';
 function createFlow(schedule,cancel){
  let key=null,phase='idle',timer=null,generation=0;
  return {start(id,next){if(key===id)return false;this.reset();key=id;phase='result';const ticket=generation;timer=schedule(()=>{if(ticket!==generation)return;timer=null;phase='replay';next();},3000);return true;},finish(){if(phase==='idle')return;phase='leave';},reset(){generation++;if(timer!==null)cancel(timer);timer=null;key=null;phase='idle';},get phase(){return phase;},get key(){return key;}};
 }
 if(typeof module==='object'&&module.exports){module.exports={createFlow};return;}
 const $=id=>document.getElementById(id),S=root.GuidedSolver,flow=createFlow(setTimeout,clearTimeout);
 let prep=null,recording=null,data=null,view=null,leaving=false,exit=null;
 const parse=m=>root.getCubeMoveSpec(m);
 function begin(epoch,scramble){
  recording=null;data=null;if(!root.isBattleMode?.()||!prep||prep.scramble!==scramble)return;
  recording={epoch,scramble,pre:[...prep.pre],initial:root.SolveReplay.pack?root.SolveReplay.pack(root.getCubeSnapshot()):root.getCubeSnapshot().map(a=>[...a.p,...a.n,a.c]),turns:[],inflight:null};
 }
 function capture(time,stats){
  const r=recording;recording=null;if(!r||!root.isCubeSolved()||!Number.isFinite(time))return;
  const ms=Math.round(time*1000);data={v:1,scramble:r.scramble,pre:r.pre,initial:r.initial,turns:r.turns.map(([m,a,b])=>[m,Math.min(ms,a),Math.min(ms,b)]),ms,count:stats.moveCount,tps:stats.tps};
 }
 function finishReplay(){view?.dispose();view=null;flow.finish();$('battleEndCube').hidden=true;$('battleEndPlayback').hidden=true;$('battleEndLeave').hidden=false;$('battleEndStage').textContent='Your solve is complete. You can leave without stopping other players.';$('battleEndLeave').focus();}
 function replay(){
  $('battleEndStage').textContent='Your Battle Replay';$('battleEndCube').hidden=false;$('battleEndPlayback').hidden=false;
  try{if(!data)throw Error('No verified replay');view=root.SolveReplay.createView($('battleEndCube'),data,{draw:({ms,index,total})=>{$('battleEndProgress').textContent=`${(ms/1000).toFixed(2)} s · ${index} / ${total} turns`;},end:finishReplay});view.speed=2;$('battleEndSpeed').value='2';view.play();}
  catch(error){console.warn('Battle replay unavailable',error);finishReplay();$('battleEndStage').textContent='Replay unavailable for this solve. You can leave without stopping other players.';}
 }
 function update({key,title,detail,leave}){
  if(!key)return;exit=leave;
  if(flow.start(key,replay)){root.finishPersonalBattleInput?.();$('battleEndModal').hidden=false;$('battleEndStage').textContent='Your replay starts in 3 seconds.';$('battleEndLeave').hidden=true;$('battleEndCube').hidden=true;$('battleEndPlayback').hidden=true;$('battleEndTitle').focus();}
  $('battleEndTitle').textContent=title;$('battleEndDetail').textContent=detail;
 }
 function reset(){flow.reset();view?.dispose();view=null;recording=null;data=null;exit=null;leaving=false;if($('battleEndModal'))$('battleEndModal').hidden=true;}
 addEventListener('stcube:scramble-applied',e=>{recording=null;data=null;prep={scramble:e.detail.moves.map(S.normalize).join(' '),pre:[]};});
 addEventListener('stcube:move-start',e=>{if(recording)recording.inflight={move:S.normalize(e.detail.move),t:Math.max(0,Date.now()-recording.epoch)};});
 addEventListener('stcube:move-complete',e=>{const m=S.normalize(e.detail.move);if(recording){const i=recording.inflight;if(!i||i.move!==m)recording=null;else{recording.turns.push([m,i.t,Math.max(i.t,Date.now()-recording.epoch)]);recording.inflight=null;}}if(prep)prep.pre.push(m);});
 addEventListener('pagehide',reset);
 document.addEventListener('DOMContentLoaded',()=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='battle-end.css';document.head.append(css);
  document.body.insertAdjacentHTML('beforeend',`<div id="battleEndModal" class="app-modal" hidden role="dialog" aria-modal="true" aria-labelledby="battleEndTitle"><section class="modal-content battle-end-content"><h2 id="battleEndTitle" tabindex="-1"></h2><p id="battleEndDetail" role="status"></p><p id="battleEndStage"></p><div id="battleEndCube" hidden></div><div id="battleEndPlayback" hidden><p id="battleEndProgress"></p><label>Speed <select id="battleEndSpeed"><option value="1">1×</option><option value="2" selected>2×</option><option value="4">4×</option></select></label><button id="battleEndSkip">Skip Replay</button></div><button id="battleEndLeave" hidden>Leave Battle</button></section></div>`);
  $('battleEndSpeed').onchange=e=>{if(view)view.speed=Number(e.target.value);};$('battleEndSkip').onclick=finishReplay;
  $('battleEndLeave').onclick=async()=>{if(leaving)return;leaving=true;$('battleEndLeave').disabled=true;try{await exit?.();}finally{leaving=false;$('battleEndLeave').disabled=false;}};
  for(const type of ['keydown','keyup'])document.addEventListener(type,e=>{if(flow.phase==='idle')return;if(e.key==='Escape'){e.preventDefault();if(flow.phase==='replay')finishReplay();}if(e.key==='Tab'){const items=[...$('battleEndModal').querySelectorAll('button,select')].filter(el=>!el.closest('[hidden]'));if(!items.length)e.preventDefault();else if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}}e.stopImmediatePropagation();},true);
 });
 root.BattleEnd={begin,capture,update,reset,get active(){return flow.phase!=='idle';},get phase(){return flow.phase;}};
})(typeof window==='object'?window:globalThis);
