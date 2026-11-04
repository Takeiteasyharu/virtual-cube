// Transaction adapter shared by the administrator CLI and local Emulator test.
module.exports=function restSdk(call,name){return{
 doc:(db,...parts)=>parts.join('/'),serverTimestamp:()=>({__serverTimestamp:true}),
 runTransaction:async(db,fn)=>{for(let attempt=0;attempt<5;attempt++){
 const {transaction}=await call(':beginTransaction',{options:{readWrite:{}}}),writes=[];
 const tx={getAll:async(...paths)=>{
 const response=await call(':batchGet',{documents:paths.map(name),transaction}),docs=new Map(response.filter(r=>r.found).map(r=>[r.found.name,r.found]));
 return paths.map(p=>{const d=docs.get(name(p));return{exists:()=>!!d,data:()=>d?decode(d.fields):undefined};});
 },set:(p,data)=>{
 const fields={},transforms=[];for(const [k,v]of Object.entries(data))if(v?.__serverTimestamp)transforms.push({fieldPath:k,setToServerValue:'REQUEST_TIME'});else fields[k]=encode(v);
 writes.push({update:{name:name(p),fields},...(transforms.length?{updateTransforms:transforms}:{})});
 }};
 try{const result=await fn(tx);if(writes.length)await call(':commit',{transaction,writes});else await call(':rollback',{transaction});return result;}
 catch(e){await call(':rollback',{transaction}).catch(()=>{});if(!String(e).includes('409')||attempt===4)throw e;}
 }}
};};
function value(v){if('stringValue'in v)return v.stringValue;if('integerValue'in v)return +v.integerValue;if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;if('timestampValue'in v)return v.timestampValue;if('arrayValue'in v)return(v.arrayValue.values||[]).map(value);if('mapValue'in v)return decode(v.mapValue.fields||{});return null;}
function decode(f){return Object.fromEntries(Object.entries(f||{}).map(([k,v])=>[k,value(v)]));}
function encode(v){if(v===null)return{nullValue:null};if(Array.isArray(v))return{arrayValue:{values:v.map(encode)}};if(typeof v==='object')return{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(typeof v==='boolean')return{booleanValue:v};return{stringValue:v};}
