/* Pure state/solution layer. A future solver can replace buildSolution without
   changing input, animation, journal or presentation code. No DOM or storage. */
(function(root) {
  "use strict";
  const normalize = move => String(move).replace(/^yRotation/, "y").replace(/^zRotation/, "z");
  function inverse(move) {
    move = normalize(move);
    return move.endsWith("2") ? move : move.endsWith("'") ? move.slice(0,-1) : move + "'";
  }
  const invert = moves => [...moves].reverse().map(inverse);
  const signature = state => state.map(s => [...s.p,...s.n,s.c].join(",")).sort().join(";");
  function rotate(v, axis, dir) {
    const [x,y,z] = v;
    if (axis === "x") return dir > 0 ? [x,-z,y] : [x,z,-y];
    if (axis === "y") return dir > 0 ? [z,y,-x] : [-z,y,x];
    return dir > 0 ? [-y,x,z] : [y,-x,z];
  }
  function apply(state, move, parse) {
    const spec = parse(normalize(move));
    if (!spec || !["x","y","z"].includes(spec.axis)) throw Error(`Unsupported move: ${move}`);
    const turns = Math.round(spec.angle / (Math.PI / 2));
    if (Math.abs(turns * Math.PI / 2 - spec.angle) > 1e-6) throw Error("Non-quarter rotation");
    const coordinate = "xyz".indexOf(spec.axis);
    return state.map(s => {
      let p = [...s.p], n = [...s.n];
      if (spec.layers.includes(p[coordinate])) {
        for (let i=0;i<Math.abs(turns);i++) { p=rotate(p,spec.axis,Math.sign(turns));n=rotate(n,spec.axis,Math.sign(turns)); }
      }
      return {p,n,c:s.c};
    });
  }
  const applyAll = (state,moves,parse) => moves.reduce((s,m)=>apply(s,m,parse),state);
  function solved(state) {
    if (state.length !== 54) return false;
    const faces = new Map();
    for (const s of state) {
      const key=s.n.join(",");if(!faces.has(key))faces.set(key,[]);faces.get(key).push(s.c);
    }
    return faces.size===6 && [...faces.values()].every(f=>f.length===9 && f.every(c=>c===f[0]));
  }
  function buildSolution({ origin, scramble, freeMoves, actual, parse }) {
    const path=[...scramble,...freeMoves].map(normalize);
    if (signature(applyAll(origin,path,parse))!==signature(actual)) throw Error("This cube state cannot be verified. Please scramble again.");
    const moves=invert(path);
    if (signature(applyAll(actual,moves,parse))!==signature(origin) || !solved(origin)) throw Error("The inverse solution could not be verified.");
    return moves;
  }
  class Session {
    constructor(start,moves,parse) {
      this.start=start;this.plan=moves.map(normalize);this.parse=parse;
      this.targets=[start];for(const move of this.plan)this.targets.push(apply(this.targets.at(-1),move,parse));
      this.signatures=this.targets.map(signature);
      this.halves=this.plan.map((move,index)=>move.endsWith("2")
        ? [move.slice(0,-1),inverse(move.slice(0,-1))].map(quarter=>({move:quarter,key:signature(apply(this.targets[index],quarter,parse))})) : []);
      this.journal=[];this.head=0;this.analyze();
    }
    analyze() {
      let state=this.start,index=0,off=[];
      for(const move of this.journal.slice(0,this.head)) {
        const before=state;state=apply(state,move,this.parse);const key=signature(state);
        const matches=this.signatures.map((s,i)=>s===key?i:-1).filter(i=>i>=0);
        const forward=matches.filter(i=>i>index);
        const half=this.halves[index]?.some(quarter=>quarter.key===key);
        if(forward.length) {index=Math.min(...forward);off=[];}
        else if(matches.includes(index))off=[];
        // A valid half turn may coincide with a previous target (e.g. L' L2).
        // Prefer completing the current half turn; Undo is a journal rewind.
        else if(matches.length && !half) {index=Math.max(...matches);off=[];}
        else {const back=off.findIndex(entry=>signature(entry.before)===key);if(back>=0)off.splice(back);else off.push({move,before});}
      }
      this.state=state;this.index=index;this.complete=solved(state);
      const target=this.plan[index];this.partial=false;
      const half=!this.complete && this.halves[index]?.find(quarter=>quarter.key===signature(state));
      if(half){this.partial=true;this.next=half.move;}
      this.correction=!this.partial && off.length>0;
      this.repairs=this.correction ? invert(off.map(entry=>entry.move)) : [];
      if(!this.partial)this.next=this.repairs[0] || target || null;
      return this;
    }
    commit(move,actual,action="move") {
      const oldJournal=[...this.journal],oldHead=this.head;
      if(action==="undo")this.head--;
      else if(action==="redo")this.head++;
      else {this.journal=this.journal.slice(0,this.head);this.journal.push(normalize(move));this.head++;}
      this.analyze();
      if(signature(this.state)!==signature(actual)) {this.journal=oldJournal;this.head=oldHead;this.analyze();throw Error("The actual cube diverged from the guide. Please scramble again.");}
    }
    get undoMove(){return this.head>0?inverse(this.journal[this.head-1]):null;}
    get redoMove(){return this.journal[this.head] || null;}
  }
  const api={normalize,inverse,invert,signature,apply,applyAll,solved,buildSolution,Session};
  if(typeof module!=="undefined" && module.exports)module.exports=api;else root.GuidedSolver=api;
})(globalThis);
