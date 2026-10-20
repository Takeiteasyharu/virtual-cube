/* Browser adapter: the cube owns all rotations; the pure solver owns targets
   and the undo journal. Nothing here submits or persists a solve. */
(() => {
  "use strict";
  const S=window.GuidedSolver;
  let origin=null,candidate=null,session=null,pending=null,active=false,finished=false,tainted=false,error="";
  const $=id=>document.getElementById(id);
  const battle=()=>document.body.classList.contains("battle-mode");
  const snapshot=()=>window.getCubeSnapshot();
  function clear() {
    candidate=null;session=null;pending=null;active=false;finished=false;tainted=false;error="";
    render();
  }
  function fail(message) {
    active=false;finished=false;session=null;pending=null;candidate=null;error=message;
    window.endGuidedPractice?.();render();
  }
  function keyLabel(move) {
    const normalized=S.normalize(move),half=normalized.endsWith("2");
    const base=half?normalized.slice(0,-1):normalized;
    const keys=window.getGuidedKeys?.(base) || [];
    return keys.length ? `${keys.join(" / ")}${half?" ×2":""}` : "Tap arrow";
  }
  function start() {
    if(battle() || !candidate || window.isCubeBusy() || normalScramblePreparing) return;
    try {
      const actual=snapshot();
      const moves=S.buildSolution({...candidate,actual,parse:window.getCubeMoveSpec});
      session=new S.Session(actual,moves,window.getCubeMoveSpec);
      tainted=true;active=true;finished=false;error="";
      window.beginGuidedPractice();
      if(session.complete){active=false;finished=true;window.endGuidedPractice();}
      render();
      if(window.matchMedia('(max-width:1100px)').matches)$('guidedSteps').scrollIntoView({block:'start',behavior:'instant'});
    } catch(e) {error=e.message;render();}
  }
  function requestMove(move,action="move") {
    if(!active && !finished)return false;
    if(battle()) {clear();return false;}
    if(pending || window.isCubeBusy())return true;
    const normalized=S.normalize(move);
    if(!window.getCubeMoveSpec(normalized))return true;
    if(finished){active=true;finished=false;window.beginGuidedPractice();}
    pending={move:normalized,action};render();
    // Only the actual post-animation event commits a journal entry.
    executeMove(normalized);
    return true;
  }
  function exit() {
    if(pending || window.isCubeBusy())return;
    active=false;finished=false;session=null;error="";
    window.endGuidedPractice();render();
  }
  function render() {
    if(!$('guidedStartBtn'))return;
    if(battle()) {
      candidate=null;session=null;active=false;finished=false;pending=null;tainted=false;
    }
    const showing=!battle() && (active||finished);
    if(document.body.classList.contains("guided-mode")!==showing)document.body.classList.toggle("guided-mode",showing);
    $('guidedSteps').hidden=!showing;$('guidedControls').hidden=!showing;
    $('guidedArrows').hidden=!active;
    $('guidedStartBtn').hidden=battle() || showing || !candidate || normalScramblePreparing || S.solved(snapshotSafe());
    $('guidedStartBtn').disabled=Boolean(window.isCubeBusy());
    $('guidedNotice').textContent=error;$('guidedNotice').hidden=!error || battle();
    if(!showing)return;
    $('soloSpaceHint').hidden=true;$('resetBtn').hidden=true;
    const repairing=session.correction;
    $('guidedSteps').classList.toggle("guided-correction",repairing);
    $('guidedStatus').textContent=finished ? "Solved! Practice only — no record saved." : repairing ? "Correction: undo these turns" : session.partial ? "180°: one more quarter-turn" : session.next?.endsWith('2') ? "Guided Solve · 180° turn (or two 90° turns)" : "Guided Solve · follow the blue arrows";
    const count=finished?session.plan.length:session.index;
    $('guidedProgressText').textContent=`${count} / ${session.plan.length}`;
    $('guidedProgress').max=session.plan.length||1;$('guidedProgress').value=count;
    const moves=repairing?session.repairs:session.plan,index=repairing?0:session.index;
    const strip=$('guidedMoves');strip.replaceChildren();
    for(let offset=-2;offset<=2;offset++) {
      const cell=document.createElement('span');cell.className='guided-step';
      const move=offset===0&&session.partial?session.next:moves[index+offset];
      if(!move || finished){cell.classList.add('guided-step-empty');cell.setAttribute('aria-hidden','true');}
      else {
        if(offset<0)cell.classList.add('guided-step-done');
        if(offset===0)cell.classList.add('guided-step-current');
        const symbol=document.createElement('b');symbol.textContent=move;
        const key=document.createElement('small');key.textContent=keyLabel(move);
        cell.append(symbol,key);
      }
      strip.append(cell);
    }
    const busy=Boolean(pending||window.isCubeBusy());
    $('guidedUndoBtn').disabled=busy||!session.undoMove;$('guidedRedoBtn').disabled=busy||!session.redoMove;
    $('guidedExitBtn').disabled=busy;
    const arrows=$('guidedArrows');arrows.replaceChildren();
    if(!active || !session.next)return;
    const spec=window.getCubeMoveSpec(session.next);
    if(!spec)return;
    const bounds=window.getCubeHintBounds();
    for(const layer of spec.layers) {
      const button=document.createElement('button');button.type='button';button.className='guided-arrow';
      button.dataset.axis=spec.axis;button.dataset.layer=layer;
      const glyph=spec.axis==='x'?(spec.angle<0?'↑':'↓'):spec.axis==='y'?(spec.angle<0?'←':'→'):(spec.angle<0?'↻':'↺');
      const face=spec.axis==='x'?['L','M','R'][layer+1]:spec.axis==='y'?['D','E','U'][layer+1]:['B','S','F'][layer+1];
      const symbol=document.createElement('b');symbol.textContent=glyph;
      const label=document.createElement('small');label.textContent=`${face} · ${session.next} · ${keyLabel(session.next)}`;
      if(spec.layers.length===3){button.classList.add('guided-whole');label.textContent=layer===0?`${session.next} · ${keyLabel(session.next)}`:face;}
      button.append(symbol,label);button.title=`${session.next}${session.next.endsWith('2')?' · 180°':''} (${keyLabel(session.next)})`;
      button.setAttribute('aria-label',button.title);button.disabled=busy;
      const container=$('cubeContainer');
      const column=spec.layers.length===3
        ? (bounds.left+bounds.right)/2+layer*Math.max((bounds.right-bounds.left)/3,4800/container.clientWidth)
        : bounds.left+(bounds.right-bounds.left)*(1/6+(layer+1)/3);
      if(spec.axis==='x'){button.style.left=`${column}%`;button.style.top=`${Math.max(0,bounds.top-7200/$('cubeContainer').clientHeight)}%`;}
      else if(spec.axis==='y'){button.style.left=`${Math.max(5,bounds.left-8)}%`;button.style.top=`${spec.layers.length===3?(bounds.top+bounds.bottom)/2-layer*Math.max((bounds.bottom-bounds.top)/3,6400/container.clientHeight):bounds.top+(bounds.bottom-bounds.top)*(1/6+(1-layer)/3)}%`;}
      else {button.style.left=`${column}%`;button.style.top=`${Math.min(86,bounds.bottom+1)}%`;}
      const next=session.next;button.addEventListener('click',()=>requestMove(next));arrows.append(button);
    }
  }
  function snapshotSafe(){try{return snapshot();}catch{return [];}}
  window.GuidedSolve={start,exit,handleMove:requestMove,refresh:render,
    get active(){return active||finished;},get isPractice(){return tainted&&!battle();},
    get state(){return session?{index:session.index,total:session.plan.length,next:session.next,correction:session.correction,partial:session.partial,finished,head:session.head}:null;}};
  window.addEventListener('stcube:cube-reset',()=>{clear();origin=snapshot();});
  window.addEventListener('stcube:scramble-applied',event=>{
    if(battle() || !origin)return;
    try {
      const moves=event.detail.moves.map(S.normalize),actual=snapshot();
      candidate={origin,scramble:moves,freeMoves:[]};
      S.buildSolution({...candidate,actual,parse:window.getCubeMoveSpec});error="";
    }catch(e){candidate=null;error=e.message;}
    render();
  });
  window.addEventListener('stcube:move-complete',event=>{
    if(battle())return;
    const move=event.detail.move;
    if(!move || !window.getCubeMoveSpec(move)){if(candidate||active)fail('This rotation cannot be verified. Please scramble again.');return;}
    if(candidate)candidate.freeMoves.push(S.normalize(move));
    if(active && pending) {
      try {
        const action=pending.action;pending=null;
        session.commit(move,snapshot(),action);
        if(session.complete){active=false;finished=true;window.endGuidedPractice();}
      }catch(e){fail(e.message);return;}
    } else if(active){fail('The cube changed outside Guided Solve. Please scramble again.');return;}
    render();
  });
  window.addEventListener('stcube:keymap-changed',render);
  window.addEventListener('stcube:cube-view',()=>{if(active)render();});
  document.addEventListener('DOMContentLoaded',()=>{
    $('guidedStartBtn').addEventListener('click',start);
    $('guidedExitBtn').addEventListener('click',exit);
    $('guidedUndoBtn').addEventListener('click',()=>{if(session?.undoMove)requestMove(session.undoMove,'undo');});
    $('guidedRedoBtn').addEventListener('click',()=>{if(session?.redoMove)requestMove(session.redoMove,'redo');});
    new MutationObserver(()=>{if(battle())render();}).observe(document.body,{attributes:true,attributeFilter:['class']});
    render();
  });
})();
