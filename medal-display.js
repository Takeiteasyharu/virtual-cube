/* Read-only decoration; stored player names never change. */
(function(root){
 'use strict';
 function append(container,data){if(data===undefined)return;try{const c=root.RankingMedals.counts(data),text=root.RankingMedals.symbols(data);if(!text)return;const span=document.createElement('span');span.className='player-medals';span.textContent=text;span.setAttribute('role','img');span.setAttribute('aria-label',`${c.gold} gold, ${c.silver} silver, ${c.bronze} bronze ranking medals`);span.title=`Gold: ${c.gold} · Silver: ${c.silver} · Bronze: ${c.bronze}`;container.append(span);}catch{const span=document.createElement('small');span.textContent=' · Medals unavailable';container.append(span);}}
 root.MedalDisplay={append};
})(window);
