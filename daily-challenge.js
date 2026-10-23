import {doc,getDocFromServer,runTransaction,serverTimestamp,collection,query,orderBy,limit,startAfter,getDocs,getCountFromServer,where} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

const $=id=>document.getElementById(id),utc=()=>new Date().toISOString().slice(0,10);
let connection=null,selected=utc(),day=null,attempt=null,active=false,tainted=false,ranked=false,round=null,busy=false,loading=false,generation=0,cursor=null,offset=0,lastTime=null,lastRank=0,opId=null,unsub=null;
const cache=new Map();
const user=()=>connection?.auth.currentUser;
const google=()=>!!user()&&!user().isAnonymous&&user().providerData.some(p=>p.providerId==='google.com');
const expired=a=>a?.status==='started'&&(Date.now()>=a.startedAt.toMillis()+600000||Date.now()>=day.closesAt.toMillis());
const consumed=()=>!!attempt;
const publicScramble=()=>consumed()||active||$('dailyModal')?.dataset.revealed===selected;
function message(text){$('dailyMessage').textContent=text;}
function render(){
 if(!$('dailyStart'))return;
 $('dailyDate').value=selected;$('dailyDate').max=utc();
 $('dailyScramble').textContent=day?(publicScramble()?day.scramble:'Start Challenge / Practiceを押すと表示されます。'): '—';
 $('dailyState').textContent=attempt?(attempt.status==='completed'?`初回記録: ${(attempt.timeMs/1000).toFixed(2)} s · TPS ${attempt.tps.toFixed(2)}`:attempt.status==='dnf'||expired(attempt)||!active?'挑戦権消費済み · DNF':'挑戦中 · 未完了はDNF'):(google()?'未挑戦 · 初回のみランキング対象':'Guest / 未ログイン · Practiceのみ');
 $('dailyStart').textContent=google()&&!consumed()?'Start Challenge':'Start Practice';
 $('dailyStart').disabled=busy||loading||!day||selected!==utc()||isBattleModeActive()||(active&&!round?.ended)||(!active&&(isTimerRunning()||normalInspectionActive||normalScramblePreparing));
 $('dailyMore').disabled=busy||loading||!cursor;
 $('dailyRefresh').disabled=busy||loading;
 $('dailyDate').disabled=busy||active;
 $('dailyExit').hidden=!active;
 $('dailyPlayStatus').hidden=!active;
 if(active)$('dailyPlayStatus').textContent=`Daily ${round.date} · ${ranked?'Ranked attempt':'Practice'} · ${round.ended?'結果を確認してください':'Spaceで再スクランブル不可 · Abortで終了'}`;
}
async function refresh(){
 if(!connection){message('Firebaseへの接続を待っています。');return;}
 const seq=++generation,date=selected;loading=true;cursor=null;offset=0;lastTime=null;lastRank=0;day=null;attempt=null;$('dailyRanking').replaceChildren();render();message('Loading…');
 try{
  let value=cache.get(date);if(!value){const snap=await getDocFromServer(doc(connection.db,'dailyChallenges',date));if(!snap.exists())throw Error('本日のチャレンジは準備中です。');value=snap.data();if(value.date!==date||!Array.isArray(value.scramble?.split(' '))||!value.scramble.split(' ').every(m=>window.getCubeMoveSpec(m)))throw Error('チャレンジデータが不正です。');cache.set(date,value);}
  const a=google()?await getDocFromServer(doc(connection.db,'dailyChallenges',date,'attempts',user().uid)):null;
  if(seq!==generation)return;day=value;attempt=a?.exists()?a.data():null;
  await ranking(true,seq);if(seq===generation)message('初回開始で挑戦権を消費します。Abort・途中離脱・受付期限超過はDNF。受付は開始から10分以内かつ当日UTC終了まで。');
 }catch(e){if(seq===generation)message(e.code==='permission-denied'?'対象日は未公開、またはアクセスできません。':e.message||'取得に失敗しました。再読み込みしてください。');}
 finally{if(seq===generation){loading=false;render();}}
}
async function ranking(reset=false,seq=generation){
 const date=selected,base=collection(connection.db,'dailyChallenges',date,'results');
 if(reset){cursor=null;offset=0;lastTime=null;lastRank=0;$('dailyRanking').replaceChildren();$('dailyOwnRank').textContent='';}
 const clauses=[orderBy('timeMs'),orderBy('__name__'),limit(25)];if(cursor)clauses.push(startAfter(cursor));
 const snap=await getDocs(query(base,...clauses));if(seq!==generation)return;
 for(const s of snap.docs){const r=s.data();offset++;if(r.timeMs!==lastTime)lastRank=offset;lastTime=r.timeMs;const li=document.createElement('li');li.textContent=`#${lastRank}  ${r.name} · ${(r.timeMs/1000).toFixed(2)} s · TPS ${Number(r.tps).toFixed(2)} · ${r.moveCount} moves`;if(s.id===user()?.uid)li.className='daily-me';$('dailyRanking').append(li);}
 cursor=snap.size===25?snap.docs.at(-1):null;
 if(reset&&attempt?.status==='completed'){const count=await getCountFromServer(query(base,where('timeMs','<',attempt.timeMs)));if(seq===generation)$('dailyOwnRank').textContent=`あなたの順位: #${count.data().count+1}（同タイムは同順位）`;}
 if(reset&&snap.empty){const li=document.createElement('li');li.textContent='まだ有効な記録がありません。';$('dailyRanking').append(li);}
 render();
}
async function start(){
 if(busy||loading||!day||selected!==utc()||isBattleModeActive()||(active&&!round?.ended)||(!active&&(isTimerRunning()||normalInspectionActive||normalScramblePreparing)))return;
 busy=true;render();const identity=user(),date=selected;let official=false,claimed=attempt;
 try{
  if(google()&&!consumed()){
   opId ||= crypto.randomUUID();const operationId=opId;
   claimed=await runTransaction(connection.db,async tx=>{const ref=doc(connection.db,'dailyChallenges',date,'attempts',identity.uid),old=await tx.get(ref);if(old.exists())return old.data();const data={uid:identity.uid,date,name:(identity.displayName||'Player').slice(0,80),operationId,status:'started',startedAt:serverTimestamp()};tx.set(ref,data);return null;});
   // Never arm until a server read confirms consumption and the same operation.
   const confirmed=await getDocFromServer(doc(connection.db,'dailyChallenges',date,'attempts',identity.uid));claimed=confirmed.data();attempt=claimed;
   official=claimed?.operationId===operationId&&claimed.status==='started'&&!expired(claimed);
  }
  if(user()?.uid!==identity?.uid||selected!==utc())throw Error('アカウントまたはUTC日付が変わりました。挑戦状況を再取得してください。');
  if(active)exit(false);
  ranked=official;round={date,uid:identity?.uid,operationId:claimed?.operationId,ended:false,scramble:day.scramble,deadline:official?Math.min(claimed.startedAt.toMillis()+600000,day.closesAt.toMillis()):day.closesAt.toMillis()};
  active=true;tainted=false;document.body.classList.add('daily-mode');window.endGuidedPractice();
  resetCube();resetTimer();resetSolveStats();setCurrentScramble(round.scramble);normalActiveScramble=round.scramble;document.getElementById('scrambleText').textContent=round.scramble;
  applyScramble(round.scramble.split(' '));readyToSolve=true;firstTurnDone=false;normalSolveState='idle';setSolvingMode(true);startNormalInspection();
  $('dailyModal').dataset.revealed=date;$('dailyModal').hidden=true;opId=null;message(official?'初回挑戦を開始しました。':'Practice: ランキングには反映されません。');render();
 }catch(e){message('開始を確認できませんでした。通信を確認して再試行してください。挑戦権が消費されている場合があります。');console.warn('Daily start failed',e.code||e.message);}
 finally{busy=false;render();}
}
async function finish(seconds,stats){
 if(!active||round.ended)return;round.ended=true;const saved={...round},timeMs=Math.round(seconds*1000);message(`結果: ${seconds.toFixed(2)} s · TPS ${stats.tps??'—'} · ${stats.moveCount} moves${ranked?' · 送信中…':' · Practice（記録対象外）'}`);$('dailyModal').hidden=false;render();
 if(!ranked)return;
 if(!stats.rankingEligible||Date.now()>=saved.deadline){await dnf(saved);message('DNF: 受付期限を過ぎたか、完成状態を検証できませんでした。');render();return;}
 const payload={timeMs,moveCount:stats.moveCount,tps:stats.tps};
 async function submit(){return runTransaction(connection.db,async tx=>{const ref=doc(connection.db,'dailyChallenges',saved.date,'attempts',saved.uid),snap=await tx.get(ref),old=snap.data();if(old?.status==='completed'){if(old.operationId===saved.operationId&&old.timeMs===timeMs)return old;throw Error('Already finalized');}if(old?.status!=='started'||old.operationId!==saved.operationId)throw Error('Attempt not available');const data={...old,...payload,status:'completed',completedAt:serverTimestamp()};tx.update(ref,data);tx.set(doc(connection.db,'dailyChallenges',saved.date,'results',saved.uid),data);return data;});}
 busy=true;render();
 try{await submit();const snap=await getDocFromServer(doc(connection.db,'dailyChallenges',saved.date,'attempts',saved.uid));attempt=snap.data();await ranking(true);message(`Daily記録を保存しました: ${seconds.toFixed(2)} s · TPS ${stats.tps}`);}
 catch(e){message('送信を確認できませんでした。期限内なら「結果を再送」、または更新で確認してください。通常ランキングには送信していません。');$('dailyRetry').hidden=false;$('dailyRetry').onclick=async()=>{if(busy)return;busy=true;render();try{await submit();$('dailyRetry').hidden=true;await refresh();message('Daily結果を確認しました。');}catch{message('結果を確定できませんでした。期限超過時はDNFです。');}finally{busy=false;render();}};}
 finally{busy=false;render();}
}
async function dnf(saved){if(!ranked||!saved?.uid)return;try{await runTransaction(connection.db,async tx=>{const ref=doc(connection.db,'dailyChallenges',saved.date,'attempts',saved.uid),snap=await tx.get(ref);if(snap.data()?.status==='started'&&snap.data().operationId===saved.operationId)tx.update(ref,{status:'dnf',completedAt:serverTimestamp()});});if(round===saved||round?.operationId===saved.operationId){attempt={...attempt,status:'dnf'};}}catch{message('DNF送信を確認できません。挑戦権は消費済みで、期限後はDNFになります。');}}
function abort(){if(!active||round.ended)return;round.ended=true;dnf(round).then(render);message('DNF: 挑戦を中止しました。初回枠は復活しません。');$('dailyModal').hidden=false;render();}
function exit(withAbort=true){if(!active)return;if(withAbort)abort();active=false;tainted=true;round=null;ranked=false;document.body.classList.remove('daily-mode');window.endGuidedPractice();resetCube();normalSolveState='idle';render();}
window.DailyChallenge={get active(){return active;},get isPractice(){return tainted&&!active;},finish,abort,exit};
addEventListener('stcube:cube-reset',()=>{if(!active)tainted=false;});
function init(){
 document.body.insertAdjacentHTML('beforeend',`<div id="dailyPlayStatus" hidden role="status"></div><div id="dailyModal" class="app-modal" hidden role="dialog" aria-modal="true" aria-labelledby="dailyTitle"><section class="modal-content daily-content"><div class="modal-heading"><h2 id="dailyTitle">Daily Challenge</h2><button id="dailyClose">Close</button></div><label>UTC date <input id="dailyDate" type="date"></label><p id="dailyCountdown"></p><p id="dailyMessage" role="status"></p><p id="dailyState"></p><p id="dailyScramble"></p><div class="daily-actions"><button id="dailyStart">Start Challenge</button><button id="dailyRefresh">Refresh</button><button id="dailyExit" hidden>Exit Daily</button><button id="dailyRetry" hidden>結果を再送</button></div><h3>Daily Ranking</h3><p id="dailyOwnRank"></p><ol id="dailyRanking"></ol><button id="dailyMore" disabled>More results</button><p class="daily-disclaimer">Practiceは記録されません。タイムはクライアント申告値です。完全な不正防止・公平性は保証しません。</p></section></div>`);
 $('openDailyBtn').onclick=()=>{if(isBattleModeActive())return;$('dailyModal').hidden=false;selected=utc();$('dailyRetry').hidden=true;refresh();};$('dailyClose').onclick=()=>{$('dailyModal').hidden=true;$('openDailyBtn').focus();};$('dailyExit').onclick=()=>{exit();refresh();};$('dailyStart').onclick=start;$('dailyRefresh').onclick=refresh;$('dailyDate').onchange=()=>{selected=$('dailyDate').value;if(/^\d{4}-\d{2}-\d{2}$/.test(selected))refresh();};$('dailyMore').onclick=async()=>{if(busy)return;busy=true;render();try{await ranking();}catch{message('ランキングを取得できませんでした。');}finally{busy=false;render();}};
 let today=utc();setInterval(()=>{const current=utc(),remaining=Math.max(0,new Date(current+'T00:00:00Z').getTime()+86400000-Date.now()),h=Math.floor(remaining/3600000),m=Math.floor(remaining/60000)%60,s=Math.floor(remaining/1000)%60;$('dailyCountdown').textContent=`現在UTC: ${current} · 次の更新まで ${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;if(active&&!round.ended&&Date.now()>=round.deadline){abortNormalSolve();message('DNF: 受付期限を過ぎました。');}if(today!==current){const previous=today;today=current;if(active&&round.ended)exit(false);if(!active&&selected===previous){selected=current;if(!$('dailyModal').hidden)refresh();}render();}},1000);
 for(const type of ['keydown','keyup'])document.addEventListener(type,e=>{if(!$('dailyModal').hidden){if(e.key==='Escape'){$('dailyModal').hidden=true;e.preventDefault();}if(e.key==='Tab'){const items=[...$('dailyModal').querySelectorAll('button:not(:disabled):not([hidden]),input:not(:disabled)')],a=items[0],z=items.at(-1);if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}}e.stopImmediatePropagation();}else if(active&&round.ended&&e.code==='Space'){e.preventDefault();e.stopImmediatePropagation();$('dailyModal').hidden=false;}},true);
 new MutationObserver(()=>{const battle=document.body.classList.contains('battle-mode');$('openDailyBtn').disabled=battle;$('openBattleBtn').disabled=active;if(battle&&active)exit();render();}).observe(document.body,{attributes:true,attributeFilter:['class']});render();connect();
}
function connect(){if(connection||!window.STcubeDailyConnection||!$('dailyModal'))return;connection=window.STcubeDailyConnection;unsub=onAuthStateChanged(connection.auth,()=>{if(active&&user()?.uid!==round.uid){abortNormalSolve();exit(false);}if(!$('dailyModal').hidden)refresh();});if(!$('dailyModal').hidden)refresh();}
addEventListener('stcube:daily-connection',connect);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
