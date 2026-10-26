const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'online-battle/index.html'),'utf8');
test('English guide has unique canonical metadata, semantic content and five FAQ answers',()=>{
 assert.match(html,/<html lang="en">/);assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.match(html,/<title>How to Play &amp; Battle Guide - STcube3D<\/title>/);
 for(const name of ['description','twitter:card','twitter:title','twitter:description','twitter:url','twitter:image'])assert(html.includes(`name="${name}"`));
 for(const name of ['og:title','og:description','og:url','og:image'])assert(html.includes(`property="${name}"`));
 assert.match(html,/<link rel="canonical" href="https:\/\/stcube3d.com\/online-battle\/">/);
 assert.equal((html.match(/<details>/g)||[]).length,5);assert.equal((html.match(/class="button primary" href="\/"/g)||[]).length,2);
 assert.match(html,/1200/);assert.match(html,/after 5 seconds/);assert.match(html,/BOT/);assert.match(html,/out of 54 stickers/);
 assert.doesNotMatch(html,/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u);
 assert.doesNotMatch(html,/takeiteasyharu\.github\.io|three\.min\.js|firebasejs|<meta[^>]+noindex/i);
 const data=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);assert.equal(data.url,'https://stcube3d.com/online-battle/');
});
test('static links, compressed screenshot, sitemap and Pages artifact are consistent',()=>{
 for(const [,url]of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  if(url.startsWith('#'))assert(html.includes(`id="${url.slice(1)}"`));
  else if(url.startsWith('/'))assert(fs.existsSync(path.join(root,url.slice(1))),url);
 }
 assert.match(html,/<img[^>]+width="1100" height="560"[^>]+alt="[^"]+"/);
 assert(fs.statSync(path.join(root,'images/online-battle-menu.jpg')).size<150000);
 const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8'),locations=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 assert.equal(locations.length,5);assert.equal(new Set(locations).size,5);assert(locations.includes('https://stcube3d.com/online-battle/'));assert(locations.every(u=>u.startsWith('https://stcube3d.com/')));
 assert(fs.readFileSync(path.join(root,'.github/workflows/pages.yml'),'utf8').includes('cp -R online-battle _site/online-battle'));
 const game=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert(game.includes('How to Play &amp; Battle Guide'));
 assert.equal((game.match(/href="\/online-battle\/"/g)||[]).length,1);
 assert(!game.includes('howToPlayBtn'));assert(!game.includes('howToPlayModal'));
 assert(game.indexOf('id="battleGuideLink"')<game.indexOf('</header>'));
});
test('all former help topics and keyboard image are migrated without stale modal handlers',()=>{
 for(const heading of ['Basic Controls','Solve Flow','Ranking Rules','Battle Mode','Keyboard Controls'])assert(html.includes('>'+heading+'<'));
 for(const text of ['csTimer-style','15-second inspection','rotations do not start it','Suspicious solves are excluded','All keyboard shortcuts can be customized in Settings','/images/keycontrol.png'])assert(html.includes(text));
 assert.equal((html.match(/>Play STcube /g)||[]).length,2);
 for(const file of ['online.js','style.css','game-ui.css'])assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/howToPlayBtn|howToPlayModal|keyboard-controls-figure/);
 assert(html.includes('imageDialog.showModal()'));assert(html.includes('imageDialog.close()'));
});
