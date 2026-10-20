const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('../guided-solver.js');
const cube=fs.readFileSync(path.join(__dirname,'../cube.js'),'utf8'),adapter={Math};
vm.createContext(adapter);
vm.runInContext(cube.slice(cube.indexOf('function parseMove('),cube.indexOf('function rotateLayer(')),adapter);
const parse=adapter.parseMove;
const origin=[];
for(let axis=0;axis<3;axis++)for(const sign of [-1,1])for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){
  const p=axis===0?[sign,a,b]:axis===1?[a,sign,b]:[a,b,sign];
  const n=[0,0,0];n[axis]=sign;origin.push({p,n,c:axis*2+(sign===1?1:0)});
}
function commit(session,move,action){
  const state=S.apply(session.state,move,parse);session.commit(move,state,action);return session;
}
test('inverse notation and supported rotations',()=>{
  assert.deepEqual(S.invert(['R','U',"F'",'L']),["L'",'F',"U'","R'"]);
  for(const face of ['R','L','U','D','F','B','M','E','S','Rw','Lw','Uw','Dw','Fw','x','y','z'])for(const suffix of ['',"'",'2']){
    const move=face+suffix;assert.equal(S.signature(S.applyAll(origin,[move,S.inverse(move)],parse)),S.signature(origin));
  }
});
test('partial 180 turn that equals an old target must not oscillate',()=>{
  const start=S.apply(origin,'F',parse),session=new S.Session(start,["L'",'L2','F'],parse);
  commit(session,"L'");assert.equal(session.index,1);commit(session,'L');
  assert(session.partial);assert.equal(session.index,1);commit(session,'L');assert.equal(session.index,2);
  commit(session,session.undoMove,'undo');assert(session.partial);commit(session,session.redoMove,'redo');assert.equal(session.index,2);
});
test('equivalent state from commuting turns advances two targets',()=>{
  const start=S.apply(origin,'F',parse),session=new S.Session(start,['R','L','F'],parse);
  commit(session,'L');assert(session.correction);commit(session,'R');assert.equal(session.index,2);
});
test('repairs, nested mistakes, undo, redo and branching',()=>{
  const start=S.apply(origin,'F',parse),session=new S.Session(start,['R2',"F'"],parse);
  commit(session,'R');assert(session.partial);commit(session,'U');commit(session,'B');
  assert.equal(session.next,"B'");assert.equal(session.index,0);
  commit(session,session.undoMove,'undo');assert.equal(session.next,"U'");
  commit(session,session.redoMove,'redo');assert.equal(session.next,"B'");
  commit(session,"B'");assert.equal(session.redoMove,null);commit(session,"U'");assert(session.partial);
  commit(session,'R');assert.equal(session.index,1);
  const before=session.head;
  assert.throws(()=>session.commit('U',origin),/diverged/);assert.equal(session.head,before);
});
test('deterministic mixed inverse paths all solve',()=>{
  let seed=53197;const rand=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n};
  const faces=['R','L','U','D','F','B','M','E','S','x','y','z','Rw','Lw','Uw','Dw','Fw'];
  for(let run=0;run<40;run++){
    const scramble=Array.from({length:20},()=>faces[rand(faces.length)]+['',"'",'2'][rand(3)]),freeMoves=Array.from({length:5},()=>faces[rand(faces.length)]);
    const actual=S.applyAll(origin,[...scramble,...freeMoves],parse),plan=S.buildSolution({origin,scramble,freeMoves,actual,parse}),session=new S.Session(actual,plan,parse);
    for(let i=0;i<400&&!session.complete;i++){
      if(i%11===0){for(const move of ['U','B',"R'"])commit(session,move);commit(session,session.undoMove,'undo');commit(session,session.redoMove,'redo');}
      const move=session.next;assert(move);commit(session,move.endsWith('2')?move.slice(0,-1):move);
    }
    assert(session.complete,`path ${run} stalled`);
  }
});
