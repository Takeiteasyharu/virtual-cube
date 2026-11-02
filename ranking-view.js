/* Presentation only: no queries, awarding or mutation of saved player names. */
(function(root){
 'use strict';
 const labels={single:'Single',ao5:'Ao5',tps:'TPS',moves:'Moves',rating:'Battle Rating'};
 function value(s,type){const n=Number(type==='tps'?s.tps:type==='moves'?s.moveCount:type==='rating'?s.rating:s.time);if(!Number.isFinite(n))return '—';return type==='moves'?Math.round(n)+' moves':type==='rating'?Math.round(n)+' pts':type==='tps'?n.toFixed(2)+' TPS':n.toFixed(2)+' s';}
 function el(tag,cls,text){const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function player(s,medals){const n=el('div','ranking-player'),name=el('span','ranking-player-name',s.name||'Player');n.append(name);root.MedalDisplay?.append(n,medals?.get(s.uid));return n;}
 function render({podium,list,entries,type='single',medals=new Map(),showPodium=true,unranked=false}){
  podium?.replaceChildren();list.replaceChildren();list.classList.add('ranking-results');list.setAttribute('role','list');list.start=showPodium?4:1;
  if(podium){podium.hidden=!showPodium||!entries.length;podium.setAttribute('aria-label',labels[type]+' top three');}
  for(let i=0;i<entries.length;i++){
   const s=entries[i],rank=i+1;
   if(showPodium&&i<3&&podium){
    const card=el('article','podium-place podium-place-'+rank);card.dataset.rank=rank;card.setAttribute('aria-label','Rank '+rank);
    if(rank===1){const crown=el('span','podium-crown','👑');crown.setAttribute('aria-hidden','true');card.append(crown);}
    const info=el('div','podium-player-card');info.append(player(s,medals),el('strong','ranking-record',value(s,type)));
    const base=el('div','podium-step');base.append(el('span','podium-position','#'+rank));card.append(info,base);podium.append(card);
   }else{
    const row=el('li','ranking-result-row');if(!unranked)row.dataset.rank=rank;row.append(el('span',unranked?'ranking-unplayed':'ranking-position',unranked?'Not played yet':'#'+rank),player(s,medals),el('strong','ranking-record',value(s,type)));if(unranked)row.classList.add('ranking-unplayed-row');list.append(row);
   }
  }
 }
 root.RankingView={render,value,labels};
})(typeof window==='object'?window:globalThis);
