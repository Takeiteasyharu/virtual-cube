/* Lazy SVG charts over the retained local normal-virtual history only. */
(function(root){
 'use strict';
 const A=root.SolveAnalytics,$=id=>document.getElementById(id),fmt=(n,s='')=>n===null?'Not available':n.toFixed(2)+s;
 let controller=null,model=null,selected=null,previousFocus=null;
 const svgNS='http://www.w3.org/2000/svg';
 function svgNode(tag,attrs,text){const n=document.createElementNS(svgNS,tag);for(const [k,v]of Object.entries(attrs||{}))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;}
 function read(){try{return JSON.parse(localStorage.getItem('virtualCubeSolveHistory')||'[]');}catch{return [];}}
 function close(){if(!controller)return;controller.abort();controller=null;$('analyticsModal').hidden=true;for(const id of ['analyticsTimeChart','analyticsTpsChart','analyticsMovesChart'])$(id).replaceChildren();model=null;selected=null;previousFocus?.focus();}
 function blocked(){return root.isBattleMode?.()||root.GuidedSolve?.isPractice||root.DailyChallenge?.active||root.SolveReplay?.active||root.isTimerRunning?.()||root.isCubeBusy?.()||normalScramblePreparing||normalInspectionActive;}
 function choose(index){
  const row=model?.rows.find(r=>r.storageIndex===Number(index));if(!row)return;selected=row.storageIndex;$('analyticsSolveSelect').value=String(selected);
  const details=$('analyticsDetails');details.replaceChildren();
  const title=document.createElement('h3');title.textContent=`Solve #${row.order}`;details.append(title);
  const dl=document.createElement('dl');
  for(const [label,value]of [['Solve Time',row.dnf?'DNF':fmt(row.time,' s')],['TPS',fmt(row.tps)],['Moves',row.moves===null?'Not available':String(row.moves)],['Date',row.date||'Not recorded'],['Scramble',row.scramble||'Not recorded']]){
   const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);
  }
  details.append(dl);const replay=root.SolveReplay?.data,available=A.replayAvailable(row,replay),note=document.createElement('p');
  note.textContent=available?'Replay available · Latest recorded solve only':'Replay unavailable · No matching operation recording';details.append(note);
  if(available){const button=document.createElement('button');button.type='button';button.id='analyticsReplayBtn';button.textContent='Replay';button.dataset.replay=row.id;details.append(button);}
  for(const point of $('analyticsModal').querySelectorAll('[data-solve]'))point.classList.toggle('selected',Number(point.dataset.solve)===selected);
 }
 function chart(id,key,label){
  const host=$(id);host.replaceChildren();const rows=model.rows;
  if(!rows.length){host.textContent='No solves available in this selection.';return;}
  const value=r=>key==='ao5'||key==='ao12'?r[key].value:r[key],vals=rows.map(value).filter(v=>v!==null),top=Math.max(1,...vals)*1.12;
  const width=Math.max(220,host.clientWidth),left=50,plot=width-70;
  const svg=svgNode('svg',{viewBox:`0 0 ${width} 260`,preserveAspectRatio:'none',tabindex:'0',role:'group','aria-label':label+'. Select a point, or use Left and Right arrows to inspect solves.','data-chart':id,'data-width':width});
  const x=i=>rows.length===1?left+plot/2:left+i*plot/(rows.length-1),y=v=>220-v/top*190;
  for(let i=0;i<4;i++){const v=top*i/3,yy=y(v);svg.append(svgNode('line',{x1:left,x2:width-20,y1:yy,y2:yy,class:'analytics-grid'}),svgNode('text',{x:left-7,y:yy+4,'text-anchor':'end',class:'analytics-axis'},v.toFixed(1)));}
  svg.append(svgNode('text',{x:left,y:252,class:'analytics-axis'},'#'+rows[0].order),svgNode('text',{x:width-20,y:252,'text-anchor':'end',class:'analytics-axis'},'#'+rows.at(-1).order));
  let path='';rows.forEach((r,i)=>{const v=value(r);if(v===null){path+=' ';return;}path+=(i&&value(rows[i-1])!==null?' L':' M')+x(i)+' '+y(v);});
  svg.append(svgNode('path',{d:path,fill:'none',class:'analytics-line'}));
  rows.forEach((r,i)=>{
   const v=value(r),dnf=(key==='time'||key==='ao5'||key==='ao12')&&(r.dnf&&key==='time'||r[key]?.state==='dnf');
   if(v===null&&!dnf)return;
   const point=svgNode(dnf?'text':'circle',dnf?{x:x(i),y:24,'text-anchor':'middle',class:'analytics-dnf','data-solve':r.storageIndex}:{cx:x(i),cy:y(v),r:5,class:'analytics-dot','data-solve':r.storageIndex});
   if(dnf)point.textContent='×';point.append(svgNode('title',{},`Solve #${r.order}: ${dnf?'DNF':v.toFixed(2)}`));svg.append(point);
  });host.append(svg);
 }
 function render(){
  const identity=root.getAnalyticsIdentity?.(),scope=$('analyticsScope').value;
  model=A.analyze(read(),{limit:$('analyticsRange').value,accountOnly:scope==='account',ownerUid:identity?.uid||null});
  const s=model.summary;
  $('analyticsCoverage').textContent=`${scope==='account'?'Current '+(identity?.type||'account')+' account · Identified local records only':'Shared device history · Not account-owned or cloud totals'}. Showing ${s.total} of ${model.scoped} matching records (${model.available} available in this browser). At most 100 virtual solves are retained; cleared or older data cannot be recovered. Legacy entries keep their original local virtual classification; missing source/owner metadata is not reconstructed. Dates are shown exactly as saved. ${model.excluded} incompatible records excluded.`;
  const summary=$('analyticsOverview');summary.replaceChildren();
  for(const [label,value]of [['Total Solves',String(s.total)],['Average Time',fmt(s.average,' s')],['Personal Best',fmt(s.pb,' s')],['Average TPS',fmt(s.tps)],['Average Moves',fmt(s.moves)]]){const card=document.createElement('div'),name=document.createElement('span'),n=document.createElement('strong');card.className='analytics-stat';name.textContent=label;n.textContent=value;card.append(name,n);summary.append(card);}
  $('analyticsCounts').textContent=`${s.completed} completed · ${s.dnf} DNF. Overview averages exclude DNF and missing values. Ao5/Ao12 remove one best and one worst result; two DNFs make an average DNF. Rolling windows may include earlier retained solves outside the selected range.`;
  chart('analyticsTimeChart',$('analyticsTimeMetric').value,'Solve order / seconds');chart('analyticsTpsChart','tps','Solve order / turns per second');chart('analyticsMovesChart','moves','Solve order / normalized moves');
  $('analyticsTpsSummary').textContent=`Average TPS: ${fmt(s.tps)} · Best TPS: ${fmt(s.bestTps)}`;
  $('analyticsMovesSummary').textContent=`Average Moves: ${fmt(s.moves)} · Minimum Moves: ${s.minMoves===null?'Not available':s.minMoves}`;
  const pb=$('analyticsPbHistory');pb.replaceChildren();for(const item of [...model.history].reverse()){const li=document.createElement('li');li.textContent=`#${item.order} · ${item.date||'Date not recorded'} · ${item.previous===null?'Earlier PB unknown':item.previous.toFixed(2)+' s'} → ${item.time.toFixed(2)} s`;pb.append(li);}if(!pb.children.length){const li=document.createElement('li');li.textContent='No retained PB improvements in this range.';pb.append(li);}
  const select=$('analyticsSolveSelect');select.replaceChildren();for(const row of model.rows){const option=document.createElement('option');option.value=row.storageIndex;option.textContent=`#${row.order} · ${row.dnf?'DNF':row.time.toFixed(2)+' s'}`;select.append(option);}select.disabled=!model.rows.length;
  if(model.rows.length)choose(model.rows.some(r=>r.storageIndex===selected)?selected:model.rows.at(-1).storageIndex);else $('analyticsDetails').textContent=scope==='account'?'No identified solves for this account. Shared device history may contain older, unassigned records.':'Complete a normal virtual solve to start your analysis.';
 }
 function open(){
  if(controller||blocked())return;previousFocus=document.activeElement;controller=new AbortController();const opts={signal:controller.signal};
  const identity=root.getAnalyticsIdentity?.();$('analyticsScope').querySelector('[value="account"]').disabled=!identity;$('analyticsScope').value=identity?'account':'device';$('analyticsModal').hidden=false;
  $('analyticsClose').addEventListener('click',close,opts);
  $('analyticsModal').addEventListener('click',e=>{
   if(e.target.id==='analyticsModal'){close();return;}
   const button=e.target.closest('[data-replay]');if(button){const id=button.dataset.replay;close();if(!root.SolveReplay.open(id))open();return;}
   const svg=e.target.closest('svg[data-chart]');if(svg&&model.rows.length){const box=svg.getBoundingClientRect(),width=Number(svg.dataset.width),i=Math.max(0,Math.min(model.rows.length-1,Math.round(((e.clientX-box.left)/box.width*width-50)/(width-70)*(model.rows.length-1))));choose(model.rows[i].storageIndex);}
  },opts);
  for(const id of ['analyticsScope','analyticsRange','analyticsTimeMetric'])$(id).addEventListener('change',render,opts);
  $('analyticsSolveSelect').addEventListener('change',e=>choose(e.target.value),opts);
  root.addEventListener('storage',e=>{if(e.key===null||e.key==='virtualCubeSolveHistory')render();},opts);root.addEventListener('resize',render,opts);root.addEventListener('stcube:analytics-identity',()=>{close();},opts);
  document.addEventListener('keydown',e=>{
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
   if(e.target.matches('svg[data-chart]')&&['ArrowLeft','ArrowRight'].includes(e.key)&&model.rows.length){e.preventDefault();const i=model.rows.findIndex(r=>r.storageIndex===selected),n=Math.max(0,Math.min(model.rows.length-1,i+(e.key==='ArrowRight'?1:-1)));choose(model.rows[n].storageIndex);}
   if(e.key==='Tab'){const items=[...$('analyticsModal').querySelectorAll('button:not(:disabled),select:not(:disabled),svg[tabindex]')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  },{...opts,capture:true});render();$('analyticsClose').focus();
 }
 document.addEventListener('DOMContentLoaded',()=>{
  document.body.insertAdjacentHTML('beforeend',`<div class="app-modal" id="analyticsModal" hidden role="dialog" aria-modal="true" aria-labelledby="analyticsTitle"><section class="modal-content analytics-content"><div class="modal-heading"><h2 id="analyticsTitle">Solve Analytics</h2><button id="analyticsClose">Close</button></div><div class="analytics-filters"><label>History scope<select id="analyticsScope"><option value="device">Shared device history</option><option value="account">Current account only</option></select></label><label>Range<select id="analyticsRange"><option value="10">Last 10</option><option value="50">Last 50</option><option value="100">Last 100</option><option value="all" selected>All Available</option></select></label></div><p id="analyticsCoverage" class="analytics-note"></p><h3>Overview</h3><div id="analyticsOverview" class="analytics-overview"></div><p id="analyticsCounts" class="analytics-note"></p><section class="analytics-section"><h3>Solve Time Progress</h3><label>Series <select id="analyticsTimeMetric"><option value="time">Solve Time</option><option value="ao5">Ao5</option><option value="ao12">Ao12</option></select></label><p class="analytics-note">Horizontal: solve order · Vertical: seconds · × DNF · Gaps: missing or insufficient data. Select a point to inspect.</p><div id="analyticsTimeChart" class="analytics-chart"></div></section><section class="analytics-section"><h3>TPS Analysis</h3><p id="analyticsTpsSummary"></p><div id="analyticsTpsChart" class="analytics-chart"></div></section><section class="analytics-section"><h3>Move Count Analysis</h3><p id="analyticsMovesSummary"></p><div id="analyticsMovesChart" class="analytics-chart"></div></section><section class="analytics-section"><h3>Solve Details</h3><label>Selected solve <select id="analyticsSolveSelect"></select></label><div id="analyticsDetails" aria-live="polite"></div></section><section class="analytics-section"><h3>Personal Best History</h3><p class="analytics-note">Improvements within retained history, not lifetime PBs. The first retained result cannot establish an earlier PB.</p><ol id="analyticsPbHistory"></ol></section></section></div>`);
  $('openAnalyticsBtn').addEventListener('click',open);
 });
 root.AnalyticsView={open,close,get active(){return !!controller;}};
})(window);
