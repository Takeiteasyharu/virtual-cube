const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
test('shipped UI source stays English (user-entered names are not translated)',()=>{
  const root=path.join(__dirname,'..');
  const files=fs.readdirSync(root).filter(name=>!name.startsWith('.')&&/\.(html|js|css)$/.test(name));
  for(const file of files){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    assert.doesNotMatch(source,/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,`${file} contains non-English UI source`);
  }
});
