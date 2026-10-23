/* Persist only the play-style preference. Session/journal state stays local to
   this page. Battles bypass all guided input and timing behavior. */
(() => {
  "use strict";
  const S=window.GuidedSolver,MODE_KEY="stcubeSolveMode";
  const $=id=>document.getElementById(id);
  const battle=()=>document.body.classList.contains("battle-mode")||Boolean(window.DailyChallenge?.active);
  let mode=localStorage.getItem(MODE_KEY)==="guided"?"guided":"normal";
  let origin=null,candidate=null,session=null,pending=null,active=false,finished=false,tainted=false,error="",switchPending=false;
  let lastBattle=battle();
  const enabled=()=>mode==="guided"&&!battle();
  const buttons=new Map(),definitions=[];
  for(const face of ["L","M","R","D","E","U","B","S","F","x","y","z"]){
    for(const suffix of ["","'"]){const move=face+suffix,spec=window.getCubeMoveSpec(move);definitions.push({move,spec,whole:spec.layers.length===3});}
  }
  const snapshot=()=>window.getCubeSnapshot();
  function clear(){candidate=null;session=null;pending=null;active=false;finished=false;tainted=enabled();error="";switchPending=false;render();}
  function fail(message){active=false;finished=false;session=null;pending=null;candidate=null;error=message;window.endGuidedPractice?.();render();}
  function keyLabel(move){const m=S.normalize(move),half=m.endsWith("2"),keys=window.getGuidedKeys?.(half?m.slice(0,-1):m)||[];return keys.length?`${keys.join(" / ")}${half?" ×2":""}`:"Tap arrow";}
  function start(){
    if(!enabled()||!candidate||window.isCubeBusy()||normalScramblePreparing||error)return;
    try{
      const actual=snapshot(),moves=S.buildSolution({...candidate,actual,parse:window.getCubeMoveSpec});
      session=new S.Session(actual,moves,window.getCubeMoveSpec);tainted=true;active=true;finished=false;
      window.beginGuidedPractice();
      if(session.complete){active=false;finished=true;window.endGuidedPractice();}
      render();
      if(window.matchMedia("(max-width:1100px)").matches)$("guidedSteps").scrollIntoView({block:"start",behavior:"instant"});
    }catch(e){error=e.message;render();}
  }
  function applySelection(){
    if(battle())return;
    if(window.isCubeBusy()||normalScramblePreparing){switchPending=true;render();return;}
    switchPending=false;
    if(enabled()){
      tainted=true;window.beginGuidedPractice();
      if(candidate&&!active&&!finished&&!error)start();else render();
    }else{
      active=false;finished=false;session=null;pending=null;error="";
      window.endGuidedPractice();render();
    }
    window.applyCubeSizeScale?.();
  }
  function setMode(value){
    if(battle())return;
    const next=value==="guided"?"guided":"normal";
    if(next===mode)return;
    mode=next;localStorage.setItem(MODE_KEY,mode);
    // Freeze the old solve immediately, even while an existing turn drains.
    if(enabled()){tainted=true;window.beginGuidedPractice();}
    applySelection();
  }
  function refresh(){
    if(!$("guidedSteps"))return;
    if(switchPending&&!window.isCubeBusy()&&!normalScramblePreparing){applySelection();return;}
    if(enabled()&&candidate&&!active&&!finished&&!error&&!window.isCubeBusy()&&!normalScramblePreparing){start();return;}
    render();
  }
  function requestMove(move,action="move"){
    if(battle())return false;
    if(!enabled()&&!active&&!finished)return false;
    if(switchPending||pending||window.isCubeBusy())return true;
    const normalized=S.normalize(move);if(!window.getCubeMoveSpec(normalized))return true;
    if(finished){active=true;finished=false;window.beginGuidedPractice();}
    tainted=true;pending={move:normalized,action};render();executeMove(normalized);return true;
  }
  function ensureButtons(){
    if(buttons.size)return;
    for(const def of definitions){
      const button=document.createElement("button");button.type="button";button.className="guided-arrow";
      button.dataset.move=def.move;button.dataset.axis=def.spec.axis;button.dataset.layer=def.spec.layers[0];
      const glyph=document.createElement("b"),label=document.createElement("small"),keys=document.createElement("span");
      keys.className="guided-arrow-key";button.append(glyph,label,keys);
      const destination=def.whole?$("guidedWholeArrows"):def.spec.axis==="z"?$("guidedDepthArrows"):$("guidedArrows");
      destination.append(button);buttons.set(def.move,button);
      button.addEventListener("click",()=>requestMove(button.classList.contains("is-next")&&session?.next?session.next:def.move));
    }
  }
  function renderArrows(){
    ensureButtons();
    const container=$("cubeContainer"),bounds=window.getCubeHintBounds(),width=container.clientWidth,height=container.clientHeight;
    const cx=(bounds.left+bounds.right)*width/200,cy=(bounds.top+bounds.bottom)*height/200;
    // Reserve a minimum rail rectangle even at the smallest cube zoom, so
    // perpendicular corner controls retain separate 44px touch targets.
    const railWidth=Math.max(144,(bounds.right-bounds.left)*width/100),railHeight=Math.max(144,(bounds.bottom-bounds.top)*height/100);
    const left=cx-railWidth/2,right=cx+railWidth/2,top=cy-railHeight/2,bottom=cy+railHeight/2;
    const next=active?session?.next:null,spec=next?window.getCubeMoveSpec(next):null;
    const busy=Boolean(pending||window.isCubeBusy()||normalScramblePreparing||switchPending);
    for(const def of definitions){
      const button=buttons.get(def.move),axis=def.spec.axis,layer=def.spec.layers[0],negative=def.spec.angle<0;
      const lit=Boolean(spec&&!def.whole&&axis===spec.axis&&spec.layers.includes(layer)&&Math.sign(def.spec.angle)===Math.sign(spec.angle));
      button.classList.toggle("is-next",lit);button.disabled=busy;
      const glyph=axis==="x"?(negative?"↑":"↓"):axis==="y"?(negative?"←":"→"):(negative?"↻":"↺");
      button.querySelector("b").textContent=def.whole?`${def.move} ${glyph}`:glyph;
      button.querySelector("small").textContent=lit?next:def.move;
      const keys=button.querySelector(".guided-arrow-key");keys.textContent=lit?keyLabel(next).replace("Tap arrow","Tap"):"";keys.hidden=!lit;
      const action=lit?next:def.move;
      button.title=`${action}${action.endsWith("2")?" · 180°":""} · ${keyLabel(action)}`;
      button.setAttribute("aria-label",button.title);
      if(def.whole||axis==="z"){
        button.classList.add("guided-extra-arrow");
        const column=def.whole?"xyz".indexOf(axis):layer+1;
        button.style.gridColumn=String(column+1);button.style.gridRow=String(negative?1:2);
      }else if(axis==="x"){
        button.style.left=`${(left+right)/2+layer*Math.max((right-left)/3,48)-22}px`;
        button.style.top=`${negative?top-52:bottom+8}px`;
      }else{
        button.style.left=`${negative?left-52:right+8}px`;
        button.style.top=`${(top+bottom)/2-layer*Math.max((bottom-top)/3,48)-22}px`;
      }
    }
    $("guidedUnderSlot").style.setProperty("--guided-clearance",`${Math.max(0,bottom+60-height)}px`);
  }
  function render(){
    if(!$("guidedSteps"))return;
    const showing=enabled();
    if(document.body.classList.contains("guided-mode")!==showing)document.body.classList.toggle("guided-mode",showing);
    $("solveModeSelect").value=mode;$("solveModeSelect").disabled=battle();
    for(const id of ["guidedSteps","guidedControls","guidedArrows","guidedExtraControls"])$(id).hidden=!showing;
    $("guidedNotice").textContent=error;$("guidedNotice").hidden=!error||!showing;
    if(!showing)return;
    const slot=window.matchMedia("(max-width:1100px)").matches?$("guidedUnderSlot"):$("guidedSideSlot");
    for(const id of ["guidedControls","guidedExtraControls"])if($(id).parentNode!==slot)slot.append($(id));
    $("soloSpaceHint").hidden=true;$("resetBtn").hidden=true;
    const repairing=Boolean(session?.correction);
    $("guidedSteps").classList.toggle("guided-correction",repairing);
    $("guidedStatus").textContent=finished?"Solved! Practice only — no record saved.":error?"Guide unavailable — please scramble again.":!session?"Guided Solve · Press Space or Scramble":repairing?"Correction: undo these turns":session.partial?"180°: one more quarter-turn":session.next?.endsWith("2")?"Guided Solve · 180° turn":"Guided Solve · follow the blue arrows";
    const total=session?.plan.length||0,count=finished?total:session?.index||0;
    $("guidedProgressText").textContent=`${count} / ${total}`;$("guidedProgress").max=total||1;$("guidedProgress").value=count;
    const moves=repairing?session.repairs:session?.plan||[],index=repairing?0:session?.index||0,strip=$("guidedMoves");strip.replaceChildren();
    for(let offset=-2;offset<=2;offset++){
      const cell=document.createElement("span");cell.className="guided-step";
      const move=offset===0&&session?.partial?session.next:moves[index+offset];
      if(!move||finished){cell.classList.add("guided-step-empty");cell.setAttribute("aria-hidden","true");}
      else{if(offset<0)cell.classList.add("guided-step-done");if(offset===0)cell.classList.add("guided-step-current");const symbol=document.createElement("b"),key=document.createElement("small");symbol.textContent=move;key.textContent=keyLabel(move);cell.append(symbol,key);}
      strip.append(cell);
    }
    const busy=Boolean(pending||window.isCubeBusy()||normalScramblePreparing||switchPending);
    $("guidedUndoBtn").disabled=busy||!session?.undoMove;$("guidedRedoBtn").disabled=busy||!session?.redoMove;
    $("guidedNewScrambleBtn").disabled=busy;
    renderArrows();
  }
  window.GuidedSolve={start,exit:()=>setMode("normal"),setMode,handleMove:requestMove,refresh,
    get enabled(){return enabled();},get active(){return active||finished;},get isPractice(){return !battle()&&(tainted||enabled());},
    get state(){return session?{index:session.index,total:session.plan.length,next:session.next,correction:session.correction,partial:session.partial,finished,head:session.head}:null;}};
  window.addEventListener("stcube:cube-reset",()=>{clear();origin=snapshot();});
  window.addEventListener("stcube:scramble-applied",event=>{
    if(battle()||!origin)return;
    try{candidate={origin,scramble:event.detail.moves.map(S.normalize),freeMoves:[]};S.buildSolution({...candidate,actual:snapshot(),parse:window.getCubeMoveSpec});error="";}catch(e){candidate=null;error=e.message;}
    render();
  });
  window.addEventListener("stcube:move-complete",event=>{
    if(battle())return;
    const move=event.detail.move;
    if(!move||!window.getCubeMoveSpec(move)){if(candidate||active)fail("This rotation cannot be verified. Please scramble again.");return;}
    if(candidate)candidate.freeMoves.push(S.normalize(move));
    if(active&&pending){try{const action=pending.action;pending=null;session.commit(move,snapshot(),action);if(session.complete){active=false;finished=true;window.endGuidedPractice();}}catch(e){fail(e.message);return;}}
    else if(active){fail("The cube changed outside Guided Solve. Please scramble again.");return;}
    else pending=null;
    refresh();
  });
  window.addEventListener("stcube:keymap-changed",render);
  window.addEventListener("stcube:cube-view",()=>{if(enabled())render();});
  document.addEventListener("DOMContentLoaded",()=>{
    $("solveModeSelect").addEventListener("change",event=>setMode(event.target.value));
    $("guidedExitBtn").addEventListener("click",()=>setMode("normal"));
    $("guidedNewScrambleBtn").addEventListener("click",()=>scrambleCube());
    $("guidedUndoBtn").addEventListener("click",()=>{if(session?.undoMove)requestMove(session.undoMove,"undo");});
    $("guidedRedoBtn").addEventListener("click",()=>{if(session?.redoMove)requestMove(session.redoMove,"redo");});
    new MutationObserver(()=>{
      const now=battle();if(now===lastBattle)return;lastBattle=now;
      if(now)clear();else{if(enabled())window.beginGuidedPractice();refresh();window.applyCubeSizeScale?.();}
    }).observe(document.body,{attributes:true,attributeFilter:["class"]});
    if(enabled()){tainted=true;window.beginGuidedPractice();window.applyCubeSizeScale?.();}
    render();
  });
})();
