/* Local-only replay. Shares the verified sticker transforms with Guided Solve,
   but never borrows the live cube, timer, journal or renderer. */
(function(root){
  'use strict';
  const S=root.GuidedSolver||(typeof require==='function'?require('./guided-solver.js'):null);
  const pack=s=>s.map(a=>[...a.p,...a.n,a.c]);
  const unpack=s=>s.map(a=>({p:a.slice(0,3),n:a.slice(3,6),c:a[6]}));
  function validate(d,parse,count){
    if(!d||d.v!==1||typeof d.scramble!=='string'||d.scramble.length>4000||!Array.isArray(d.pre)||d.pre.length>10000||!Array.isArray(d.initial)||d.initial.length!==54||!Array.isArray(d.turns)||!d.turns.length||d.turns.length>10000)throw Error('Invalid replay');
    if(!Number.isFinite(d.ms)||d.ms<=0||d.ms>86400000||!Number.isInteger(d.count)||d.count<0||!Number.isFinite(d.tps))throw Error('Invalid statistics');
    for(const a of d.initial)if(!Array.isArray(a)||a.length!==7||!a.every(Number.isInteger)||a.slice(0,6).some(x=>Math.abs(x)>1)||a.slice(3,6).reduce((n,x)=>n+Math.abs(x),0)!==1||a.slice(3,6).some((n,i)=>n&&a[i]!==n)||a[6]<0||a[6]>0xffffff)throw Error('Invalid stickers');
    const initial=unpack(d.initial),positions=new Set(initial.map(a=>[...a.p,...a.n].join()));
    if(positions.size!==54||new Set(initial.map(a=>a.c)).size!==6)throw Error('Invalid stickers');
    const prep=[...d.scramble.trim().split(/\s+/).filter(Boolean),...d.pre];
    if(prep.some(m=>typeof m!=='string'||m.length>16||!parse(m)))throw Error('Invalid preparation');
    const origin=S.applyAll(initial,S.invert(prep),parse);
    if(!S.solved(origin))throw Error('Scramble cannot reproduce initial state');
    let state=initial,last=0;
    for(const turn of d.turns){if(!Array.isArray(turn)||turn.length!==3||typeof turn[0]!=='string'||turn[0].length>16||!parse(turn[0])||!Number.isInteger(turn[1])||!Number.isInteger(turn[2])||turn[1]<last||turn[2]<turn[1]||turn[2]>d.ms+20)throw Error('Invalid timing');state=S.apply(state,turn[0],parse);last=turn[2];}
    if(!S.solved(state))throw Error('Incomplete replay');
    if(count&&count(d.turns.map(t=>t[0]))!==d.count)throw Error('Move count mismatch');
    if(Math.abs(d.tps-(d.count/(d.ms/1000)))>.011)throw Error('TPS mismatch');
    return d;
  }
  function stateAtIndex(d,index,parse,checkpoints){const start=checkpoints?Math.floor(index/32)*32:0;let state=checkpoints?.get(start)||unpack(d.initial);for(let i=start;i<index;i++)state=S.apply(state,d.turns[i][0],parse);return {state,index};}
  function stateAt(d,ms,parse,checkpoints){let lo=0,hi=d.turns.length;while(lo<hi){const mid=(lo+hi)>>>1;if(d.turns[mid][2]<=ms)lo=mid+1;else hi=mid;}return stateAtIndex(d,lo,parse,checkpoints);}
  const api={pack,unpack,validate,stateAt,stateAtIndex};
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  const KEY='stcubeSolveReplayV1',MAX_BYTES=512000;
  let preparation=null,recording=null,latest=null,saveSequence=0,view=null;
  const eligible=()=>!document.body.classList.contains('battle-mode')&&!root.GuidedSolve?.isPractice&&!root.DailyChallenge?.active&&!root.DailyChallenge?.isPractice;
  const parse=m=>root.getCubeMoveSpec(m);
  const count=m=>calculateNormalizedMoveCount(m);
  function refresh(){const b=document.getElementById('replayOpenBtn');if(b){b.hidden=!latest||!eligible();b.disabled=isTimerRunning()||normalScramblePreparing||normalInspectionActive;}}
  function cancel(){recording=null;}
  function begin(epoch,scramble){
    cancel();if(!eligible()||!preparation||preparation.scramble!==scramble||root.isCubeBusy())return;
    const initial=root.getCubeSnapshot();
    if(S.signature(S.applyAll(preparation.origin,[...scramble.split(/\s+/).filter(Boolean),...preparation.pre],parse))!==S.signature(initial))return;
    recording={epoch,scramble,pre:[...preparation.pre],initial:pack(initial),turns:[],inflight:null};
  }
  function finish(time,stats){
    const r=recording;cancel();if(!r||!eligible()||stats.mode!=='virtual'||!stats.rankingEligible||!root.isCubeSolved())return;
    const finalState=S.signature(root.getCubeSnapshot()),seq=++saveSequence;
    // Storage and validation run after the normal timing/recording stack returns.
    setTimeout(()=>{try{
      // The existing display clock samples every 10ms and stores hundredths.
      // Clamp the trailing animation endpoint to that same official final time.
      const ms=Math.round(time*1000),turns=r.turns.map(([m,a,b])=>[m,Math.min(a,ms),Math.min(b,ms)]);
      const d={v:1,solveId:stats.solveId||null,ownerUid:root.SolveAnalytics?root.SolveAnalytics.ownerUidFor(stats,root.getAnalyticsIdentity?.()):null,scramble:r.scramble,pre:r.pre,initial:r.initial,turns,ms,count:stats.moveCount,tps:stats.tps};
      validate(d,parse,count);
      if(S.signature(S.applyAll(unpack(d.initial),d.turns.map(t=>t[0]),parse))!==finalState)throw Error('Final state mismatch');
      const json=JSON.stringify(d);if(json.length*2>MAX_BYTES)throw Error('Replay too large');
      if(seq!==saveSequence)return;localStorage.setItem(KEY,json);latest=d;refresh();
    }catch(error){console.warn('Replay not saved; previous replay retained.',error);}},0);
  }
  root.SolveReplay={begin,finish,cancel,open,get active(){return !!view;},get data(){return latest;}};
  addEventListener('stcube:cube-reset',()=>{cancel();preparation=null;refresh();});
  addEventListener('stcube:scramble-applied',e=>{cancel();const moves=e.detail.moves.map(S.normalize),initial=root.getCubeSnapshot();preparation={scramble:moves.join(' '),origin:S.applyAll(initial,S.invert(moves),parse),pre:[]};});
  addEventListener('stcube:move-start',e=>{if(recording)recording.inflight={move:S.normalize(e.detail.move),t:Math.max(0,Date.now()-recording.epoch)};});
  addEventListener('stcube:move-complete',e=>{
    const m=S.normalize(e.detail.move);if(!parse(m)){cancel();preparation=null;return;}
    if(recording){const r=recording,i=r.inflight;if(!i||i.move!==m){cancel();return;}r.turns.push([m,i.t,Math.max(i.t,Date.now()-r.epoch)]);r.inflight=null;if(r.turns.length>10000)cancel();}
    if(preparation){preparation.pre.push(m);if(preparation.pre.length>10000)preparation=null;}
  });
  class ReplayView{
    constructor(container){
      this.container=container;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(38,1,.1,100);this.camera.position.set(0,5,5);this.camera.lookAt(0,0,0);
      this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));container.append(this.renderer.domElement);
      this.geometry=new THREE.PlaneGeometry(.49,.49);this.materials=new Map();this.stickers=[];this.ms=0;this.speed=1;this.playing=false;this.frame=0;this.stepIndex=null;this.index=0;
      this.checkpoints=new Map([[0,unpack(latest.initial)]]);let state=unpack(latest.initial);latest.turns.forEach((t,i)=>{state=S.apply(state,t[0],parse);if((i+1)%32===0)this.checkpoints.set(i+1,state);});
      this.materials.set(0,new THREE.MeshBasicMaterial({color:0,side:THREE.DoubleSide}));
      this.edges=new THREE.EdgesGeometry(this.geometry);this.edgeMaterial=new THREE.LineBasicMaterial({color:0x172333});
      for(let i=0;i<54;i++){const mesh=new THREE.Mesh(this.geometry,this.materials.get(0));mesh.add(new THREE.LineSegments(this.edges,this.edgeMaterial));this.scene.add(mesh);this.stickers.push(mesh);}
      this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(container);this.draw();
    }
    draw(){
      const d=latest,{state,index}=this.stepIndex===null?stateAt(d,this.ms,parse,this.checkpoints):stateAtIndex(d,this.stepIndex,parse,this.checkpoints),t=d.turns[index],spec=this.stepIndex===null&&t&&this.ms>=t[1]?parse(t[0]):null;
      this.index=index;
      const fraction=spec?(t[2]===t[1]?1:Math.min(1,(this.ms-t[1])/(t[2]-t[1]))):0;
      const q=new THREE.Quaternion();if(spec)q.setFromAxisAngle(new THREE.Vector3(...['x','y','z'].map(a=>a===spec.axis?1:0)),spec.angle*fraction);
      state.forEach((s,i)=>{const mesh=this.stickers[i],p=new THREE.Vector3(...s.p).multiplyScalar(.6),n=new THREE.Vector3(...s.n);p.addScaledVector(n,.31);if(spec&&spec.layers.includes(s.p['xyz'.indexOf(spec.axis)])){p.applyQuaternion(q);n.applyQuaternion(q);}mesh.position.copy(p);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n);if(!this.materials.has(s.c))this.materials.set(s.c,new THREE.MeshBasicMaterial({color:s.c,side:THREE.DoubleSide}));mesh.material=this.materials.get(s.c);});
      const w=this.container.clientWidth,h=this.container.clientHeight;if(w&&h){this.camera.aspect=w/h;const half=Math.atan(Math.tan(this.camera.fov*Math.PI/360)*Math.min(1,w/h));const distance=1.9/Math.sin(half);this.camera.position.set(0,distance/Math.SQRT2,distance/Math.SQRT2);this.camera.lookAt(0,0,0);this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);this.renderer.render(this.scene,this.camera);}
      document.getElementById('replaySeek').value=this.ms;
      document.getElementById('replayInfo').textContent=`${(this.ms/1000).toFixed(2)} / ${(d.ms/1000).toFixed(2)} s · Turn ${index} / ${d.turns.length} · Moves ${d.count} · TPS ${d.tps.toFixed(2)} · ${t&&this.ms>=t[1]?t[0]:d.turns[index-1]?.[0]||'—'}`;
      document.getElementById('replayPlay').textContent=this.playing?'Pause':'Play';
    }
    pause(){this.playing=false;cancelAnimationFrame(this.frame);this.frame=0;this.draw();}
    play(){if(this.playing)return;if(this.ms>=latest.ms)this.ms=0;this.stepIndex=null;this.playing=true;let previous=performance.now();const tick=now=>{if(!this.playing)return;this.ms=Math.min(latest.ms,this.ms+(now-previous)*this.speed);previous=now;if(this.ms>=latest.ms)this.playing=false;this.draw();if(this.playing)this.frame=requestAnimationFrame(tick);};this.frame=requestAnimationFrame(tick);this.draw();}
    seek(ms){this.pause();this.stepIndex=null;this.ms=Math.max(0,Math.min(latest.ms,ms));this.draw();}
    step(direction){this.pause();this.stepIndex=Math.max(0,Math.min(latest.turns.length,this.index+direction));this.ms=this.stepIndex?latest.turns[this.stepIndex-1][2]:0;this.draw();}
    dispose(){cancelAnimationFrame(this.frame);this.playing=false;this.resize.disconnect();this.geometry.dispose();this.edges.dispose();this.edgeMaterial.dispose();this.materials.forEach(m=>m.dispose());this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();this.scene.clear();this.stickers=[];this.materials.clear();this.checkpoints.clear();}
  }
  let previousFocus;
  function close(){if(!view)return;view.dispose();view=null;document.getElementById('replayModal').hidden=true;previousFocus?.focus();}
  function open(expectedId){if(view||!latest||(typeof expectedId==='string'&&latest.solveId!==expectedId)||!eligible()||isTimerRunning()||normalScramblePreparing||normalInspectionActive||root.isCubeBusy())return false;try{validate(latest,parse,count);previousFocus=document.activeElement;document.getElementById('replayModal').hidden=false;document.getElementById('replaySeek').max=latest.ms;view=new ReplayView(document.getElementById('replayCube'));document.getElementById('replaySpeed').value='1';document.getElementById('replayClose').focus();return true;}catch(e){close();document.getElementById('replayModal').hidden=true;console.warn('Replay unavailable',e);return false;}}
  document.addEventListener('DOMContentLoaded',()=>{
    document.body.insertAdjacentHTML('beforeend',`<div id="replayModal" class="app-modal" hidden role="dialog" aria-modal="true" aria-labelledby="replayTitle"><section class="modal-content replay-content"><div class="modal-heading"><h2 id="replayTitle">Solve Replay</h2><button id="replayClose" type="button">Close</button></div><div id="replayCube" aria-label="Replay 3D cube"></div><p id="replayInfo" role="status"></p><label for="replaySeek">Playback position</label><input id="replaySeek" type="range" min="0" step="1" value="0"><div class="replay-actions"><button id="replayRestart">Restart</button><button id="replayPrevious">Previous turn</button><button id="replayPlay">Play</button><button id="replayNext">Next turn</button><label>Speed <select id="replaySpeed"><option>0.25</option><option>0.5</option><option selected>1</option><option>2</option><option>4</option></select> ×</label></div></section></div>`);
    try{const raw=localStorage.getItem(KEY);if(raw&&raw.length*2<=MAX_BYTES)latest=validate(JSON.parse(raw),parse,count);}catch(e){latest=null;}
    document.getElementById('replayOpenBtn').addEventListener('click',open);document.getElementById('replayClose').addEventListener('click',close);
    document.getElementById('replayModal').addEventListener('click',e=>{if(e.target.id==='replayModal')close();});
    document.getElementById('replayPlay').addEventListener('click',()=>view.playing?view.pause():view.play());
    document.getElementById('replayRestart').addEventListener('click',()=>view.seek(0));
    document.getElementById('replayPrevious').addEventListener('click',()=>view.step(-1));document.getElementById('replayNext').addEventListener('click',()=>view.step(1));
    document.getElementById('replaySeek').addEventListener('input',e=>view.seek(Number(e.target.value)));document.getElementById('replaySpeed').addEventListener('change',e=>{view.speed=Number(e.target.value);});
    for(const type of ['keydown','keyup'])document.addEventListener(type,e=>{if(!view)return;if(e.key==='Escape'){e.preventDefault();close();e.stopImmediatePropagation();return;}if(e.key==='Tab'){const items=[...document.querySelectorAll('#replayModal button,#replayModal input,#replayModal select')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}e.stopImmediatePropagation();},true);
    new MutationObserver(()=>{refresh();if(!eligible())close();}).observe(document.body,{attributes:true,attributeFilter:['class']});refresh();
  });
})(typeof window!=='undefined'?window:globalThis);
