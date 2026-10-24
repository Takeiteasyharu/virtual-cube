/* Local, explicitly unrated opponent. No Firebase API is imported here. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),M=window.BotModel,S=window.GuidedSolver;
 let state=null,generation=0,modelPromise=null;const waits=new Map();
 const text=(id,value)=>{const el=$(id);if(el&&el.textContent!==String(value))el.textContent=String(value);};
 function wait(ms){return new Promise(resolve=>{const id=setTimeout(()=>{waits.delete(id);resolve(true)},Math.max(0,ms));waits.set(id,resolve)});}
 function clear(){++generation;for(const[id,resolve]of waits){clearTimeout(id);resolve(false)}waits.clear();window.opponentCube?.cancelMove();}
 async function prepare(scramble,rating){
  modelPromise ||= fetch('bot-calibration.json').then(r=>{if(!r.ok)throw Error('No calibration');return r.json()}).catch(()=>M.calibrate([],{}));
  const model=await modelPromise,local=(typeof getSolves==='function'?getSolves('virtual'):[]).filter(s=>s.mode==='virtual'&&s.moves?.length&&Number.isFinite(s.time)&&s.time>=3&&s.time<=300&&s.moveCount>=10&&s.moveCount<=300&&s.tps>=.1&&s.tps<=15&&Math.abs(s.moveCount/s.time-s.tps)<.03&&!s.practice&&!s.bot&&!s.dnf).slice(0,10).map(s=>s.time);
  const config=M.choose(model,rating,local),target=M.sample(config);
  window.opponentCube.clear();const origin=window.opponentCube.snapshot(),moves=M.plan(scramble,S,window.getCubeMoveSpec,origin);
  const weights=moves.map(m=>(m.endsWith('2')?1.25:1)*(.65+Math.random()*.7)),sum=weights.reduce((a,b)=>a+b,0);
  return {scramble,config,target,moves,origin,durations:weights.map(w=>target*1000*w/sum)};
 }
 function start(prepared,name,rating){
  clear();state={...prepared,name,rating:Number.isFinite(rating)?rating:null,phase:'ready',you:{status:'joined',time:null},bot:{status:'joined',time:null,index:0},started:null,cancelled:false};
  document.body.classList.add('bot-battle-mode');window.BotBattleBridge.enter(prepared.scramble);render();
 }
 function ready(){
  if(!state||state.phase!=='ready')return;state.phase='inspection';state.you.status='inspecting';state.bot.status='inspecting';
  window.opponentCube.clear();window.opponentCube.setScramble(state.scramble,1);
  if(S.signature(window.opponentCube.snapshot())!==S.signature(S.applyAll(state.origin,state.scramble.split(' '),window.getCubeMoveSpec))){abort('BOT scramble could not be verified.');return;}
  window.startBattleInspection(state.scramble,Date.now(),1);render();const ticket=generation;
  wait(3000).then(valid=>{if(valid&&ticket===generation&&state)runBot(ticket);});
 }
 async function runBot(ticket){
  const s=state;s.bot.status='solving';s.bot.started=performance.now();let expected=window.opponentCube.snapshot(),end=s.bot.started;
  try{for(let i=0;i<s.moves.length;i++){
    if(ticket!==generation||state!==s)return;
    const slot=s.durations[i],start=end;end+=slot;
    if(!await wait(start-performance.now())||ticket!==generation)return;
    const duration=Math.max(1,Math.min(180,slot*.7,end-performance.now()));
    if(!await window.opponentCube.animateMove(s.moves[i],duration)||ticket!==generation)return;
    expected=S.apply(expected,s.moves[i],window.getCubeMoveSpec);
    if(S.signature(window.opponentCube.snapshot())!==S.signature(expected))throw Error('BOT cube diverged');
    s.bot.index=i+1;s.bot.lastMove=s.moves[i];
    if(!await wait(end-performance.now())||ticket!==generation)return;
  }
  if(!S.solved(window.opponentCube.snapshot()))throw Error('BOT is not solved');
  s.bot.status='finished';s.bot.time=(performance.now()-s.bot.started)/1000;s.bot.solved=true;settle();render();
  }catch(e){if(state!==s||ticket!==generation)return;s.bot.status='dnf';s.bot.error=e.message;settle();render();}
 }
 function playerStarted(){
  if(!state||state.you.status==='solving'||state.you.status==='finished')return;
  state.you.status='solving';state.you.started=performance.now();const ticket=generation;
  wait(120000).then(valid=>{if(!valid||ticket!==generation||!state||state.you.status==='finished')return;window.clearBattleInspection();stopTimerAtLimit(120);state.you.status='dnf';state.you.time=null;battleInputState='finished';readyToSolve=false;settle();render();});
 }
 function finish(seconds,stats){
  if(!state||state.phase==='finished'||state.you.status==='finished')return;
  state.you.status=stats.rankingEligible&&window.isCubeSolved()?'finished':'dnf';state.you.time=state.you.status==='finished'?seconds:null;state.you.moves=stats.moveCount;state.you.tps=stats.tps;settle();render();
 }
 function settle(){
  if(!state||!['finished','dnf'].includes(state.you.status)||!['finished','dnf'].includes(state.bot.status))return;
  state.phase='finished';const a=state.you.time,b=state.bot.solved?state.bot.time:null;
  state.outcome=a===null&&b===null?'draw':b===null?'win':a===null?'lose':Math.abs(a-b)<.005?'draw':a<b?'win':'lose';
  window.BotBattleBridge.stopClock();
  clear();window.clearBattleInspection();resetTimer();readyToSolve=false;firstTurnDone=false;battleInputState='finished';setSolvingMode(false);window.setBattleInspectionOverlay(false);
 }
 function abort(message='Battle cancelled. No rating change.'){
  if(!state)return;state.cancelled=true;state.you.status='dnf';state.you.time=null;state.bot.status='dnf';state.bot.time=null;state.bot.solved=false;state.message=message;settle();render();
 }
 function render(){
  if(!state)return;const s=state,ended=s.phase==='finished',inspecting=s.you.status==='inspecting',room=window.BotBattleBridge.room();if(!room)return;
  room.status=ended?'finished':s.phase==='ready'?'waiting':'solving';window.BotBattleBridge.players({status:s.you.status,finalTime:s.you.time},{status:s.bot.status,finalTime:s.bot.time});
  text('battleModeLabel','BOT Battle');text('battleRoomMeta',`BOT · ${s.config.level} · Unrated local practice`);text('battleScramble',s.phase==='ready'?'':s.scramble);
  for(const id of ['copyRoomUrlBtn','multiplayerRoster','hostStartBattleBtn','scrambleNetPanel','friendRealTimerPanel','friendRealControls','realCubeInstruction','friendRealHistoryPanel'])if($(id))$(id).hidden=true;
  if($('leaveBattleBtn'))$('leaveBattleBtn').hidden=false;
  $('battleReadyBtn').hidden=s.phase!=='ready';$('battleReadyBtn').disabled=false;text('battleReadyBtn','Ready');
  $('rankedVersus').hidden=false;text('rankedYouName',s.name);text('rankedYouRating',s.rating??'—');text('rankedYouRatingChange','No rating change');text('rankedOpponentName',`BOT · ${s.config.level}`);text('rankedOpponentRating',s.config.level);text('rankedOpponentRatingChange','Scripted opponent · Unrated');
  document.querySelectorAll('#rankedVersus .ranked-rating-label')[1].textContent='DIFFICULTY';
  $('opponentCubePanel').hidden=false;text('opponentCubeTitle',`BOT · ${s.config.level}`);
  const elapsed=s.bot.time??(s.bot.started?(performance.now()-s.bot.started)/1000:0);text('opponentCubeStatus',`BOT: ${s.bot.status.toUpperCase()} | ${elapsed.toFixed(2)} s | ${s.bot.index}/${s.moves.length} turns`);
  $('rankedExperience').hidden=false;$('rankedMoment').hidden=inspecting;$('rankedMoment').dataset.phase=ended?s.outcome:s.you.time!==null?'waiting':s.you.status==='solving'?'solving':'ready';
  const title=ended?(s.cancelled?'BATTLE CANCELLED':s.outcome==='win'?'YOU WIN!':s.outcome==='lose'?'BOT WINS!':"IT’S A DRAW!"):s.you.time!==null?'YOU DID IT!':s.you.status==='solving'?"LET’S GO!":'MEET YOUR BOT!';
  text('rankedMomentTitle',title);text('rankedMomentDetail',ended?'BOT battle · No rating change · Human battle statistics unchanged':s.you.time!==null?`Waiting for BOT · About ${Math.max(0,Math.ceil(s.target-elapsed))}s remaining`:`${s.config.level} BOT · No rating change`);
  text('battleNotice',s.message|| (ended?'BOT battle finished.':inspecting?'Inspection: make your first move to start.':s.you.time!==null?'Your solve is complete. Waiting for BOT.':'Unrated BOT battle in progress.'));
  const time=t=>t===null?'DNF':t.toFixed(2)+' s';text('battleResult',ended?`You: ${time(s.you.time)} | BOT: ${time(s.bot.solved?s.bot.time:null)} | Rating unchanged`:'');text('battleResultBadge',ended?(s.cancelled?'CANCELLED':s.outcome.toUpperCase()):'');
  $('battleRematchPanel').hidden=!ended;text('battleRematchYou','Rematch searches for a human first.');text('battleRematchOpponent','BOT results do not count toward human battle statistics.');$('playAgainBtn').disabled=false;text('playAgainBtn','Find next match');
  $('rankedTimeLimitDisplay').hidden=false;text('rankedTimeLimitDisplay',ended?'Unrated · No ranking submission':`BOT ${s.config.level} · Your solve time limit: 2:00`);
  window.renderBattleResultsUI?.({finished:ended,ranked:true,you:{status:s.you.status,finalTime:s.you.time},opponent:{status:s.bot.status,finalTime:s.bot.solved?s.bot.time:null},bot:true});
 }
 function dispose(){clear();state=null;document.body.classList.remove('bot-battle-mode');const labels=document.querySelectorAll('#rankedVersus .ranked-rating-label');labels.forEach(l=>l.textContent='RATING');}
 window.BotBattle={prepare,start,ready,playerStarted,finish,abort,render,dispose,get active(){return !!state;},get diagnostics(){return state?{level:state.config.level,source:state.config.source,target:state.target,actual:state.bot.time,solved:!!state.bot.solved,phase:state.phase,outcome:state.outcome,moves:state.moves.length}:null;}};
 window.addEventListener('pagehide',dispose);
})();
