/* Diagnostické jadro – bez UI. Používa globálne KB a S (S.dx, S.f). */
/* =====================================================================
   DIAGNOSTICKÉ JADRO
   ===================================================================== */
const LV=['green','yellow','orange','red'];
const lvMax=(a,b)=>LV.indexOf(a)>=LV.indexOf(b)?a:b;
const clamp=p=>Math.min(.99,Math.max(.01,p));
const F=KB.FIND,V=KB.VARS,C=KB.COND;
/* váhy môžu závisieť od veku: c.eva = {child:{...}, senior:{...}} */
function pf(c,f){const ag=S&&S.dx&&S.dx.A.age;const o=c.eva&&ag&&(c.eva[ag]||(ag==='infant'&&c.eva.child));
 if(o&&o[f]!==undefined)return clamp(o[f]);return clamp(c.ev[f]!==undefined?c.ev[f]:F[f].q)}
function pv(c,v,val){const X=V[v];const i=X.vals.findIndex(x=>x[0]===val);let arr=(c.vars&&c.vars[v])||X.base;
 if(v==='age'&&arr.length===4)arr=[arr[0]*.3,arr[0]*.7,arr[1],arr[2],arr[3]]; // staré 4-hodnotové váhy: dieťa → dojča + dieťa
const s=arr.reduce((a,b)=>a+b,0);return clamp(arr[i]/s)}
function urgOf(c,A){return typeof c.urg==='function'?c.urg(A):c.urg}
/* posterior: Bayes nad všetkými stavmi */
function postVec(A){
 const l=C.map(c=>{let s=Math.log(c.prior);
  const soft=(S.dx&&S.dx.soft)||{};
  for(const f in F){if(A[f]===true)s+=Math.log(pf(c,f));else if(A[f]===false)s+=(soft[f]?.5:1)*Math.log(1-pf(c,f))}
  for(const v in V){if(A[v]&&A[v]!=='?')s+=Math.log(pv(c,v,A[v]))}
  return s});
 const m=Math.max(...l),e=l.map(x=>Math.exp(x-m)),z=e.reduce((a,b)=>a+b,0);return e.map(x=>x/z);
}
function ranked(A){const P=postVec(A);return C.map((c,i)=>({c,p:P[i]})).sort((a,b)=>b.p-a.p)}
const H=ps=>{let h=0;for(const p of ps)if(p>1e-12)h-=p*Math.log2(p);return h};
function igBool(P,f){let py=0;const y=[],n=[];C.forEach((c,i)=>{const p=pf(c,f);y[i]=P[i]*p;n[i]=P[i]*(1-p);py+=y[i]});
 const pn=1-py;return H(P)-(py*H(y.map(x=>x/py))+pn*H(n.map(x=>x/pn)))}
function igVar(P,v){let e=0,tot=0;const parts=V[v].vals.map(([val])=>{const w=C.map((c,i)=>P[i]*pv(c,v,val));const s=w.reduce((a,b)=>a+b,0);tot+=s;return{w,s}});
 parts.forEach(({w,s})=>{e+=(s/tot)*H(w.map(x=>x/s))});return H(P)-e}
/* relevancia pre naliehavé stavy – aby sa nezabudlo na otázky, ktoré rozhodujú o 155 */
function urgRel(P,A,f){let r=0;C.forEach((c,i)=>{if(urgOf(c,A)==='red')r+=P[i]*Math.abs(pf(c,f)-F[f].q)});return r}
function eligible(id,isVar){const D=S.dx,A=D.A;if(D.asked.includes(id))return false;if(A[id]!==undefined&&!(D.soft&&D.soft[id]))return false;
 const X=isVar?V[id]:F[id];if(D.mode==='obs'&&!X.obs)return false;if(X.req&&!X.req(A))return false;return true}
const prioOf=(X,A)=>typeof X.prio==='function'?X.prio(A):(X.prio||0);
function pickNext(){
 const D=S.dx,A=D.A,P=postVec(A);
 /* zameranie: informačný zisk len medzi stavmi, ktoré ešte prichádzajú do úvahy */
 let Pf=P.map((p,i)=>(p>=.02||C[i].id==='other')?p:0);const z=Pf.reduce((a,b)=>a+b,0);Pf=Pf.map(p=>p/z);
 let best=null,bs=-1,rf=null;
 for(const f in F){if(!eligible(f,false))continue;
  const sc=igBool(Pf,f)+1.0*urgRel(P,A,f)+prioOf(F[f],A)-((D.soft&&D.soft[f])?.12:0);
  if(sc>bs){bs=sc;best={kind:'bool',id:f,sc}}
  if(F[f].rf&&F[f].req&&(!rf||sc>rf.sc))rf={kind:'bool',id:f,sc}}
 for(const v in V){if(v==='age'||v==='sex'||!eligible(v,true))continue;const sc=igVar(Pf,v)+prioOf(V[v],A);if(sc>bs){bs=sc;best={kind:'var',id:v,sc}}}
 if(!best)return null;
 const top=Math.max(...P),maxQ=16+D.extra;
 if(best.sc<2){ // prio>=2 = vynútená otázka
  const stop=D.n>=maxQ||(D.n>=4&&top>.8)||(D.n>=3&&best.sc<.03);
  if(stop)return rf||recheck(P); // pred ukončením: zostávajúce varovné otázky, potom kontrola prehliadnutých
 }
 return best;
}
/* kontrola ako u dispečera: prehliadnuté (neoznačené) príznaky, ktoré by zvýšili naliehavosť a sú pri tomto obraze pravdepodobné */
function recheck(P){const D=S.dx,A=D.A;if(!D.soft)return null;
 let cur='green';safety(A).forEach(r=>cur=lvMax(cur,r.u));
 let best=null,bs=0;
 for(const f in D.soft){if(!D.soft[f]||D.asked.includes(f))continue;if(D.mode==='obs'&&!F[f].obs)continue;
  const old=A[f];A[f]=true;let lv='green';safety(A).forEach(r=>lv=lvMax(lv,r.u));A[f]=old;
  const gain=LV.indexOf(lv)-LV.indexOf(cur);if(gain<=0)continue;
  let py=0;C.forEach((c,i)=>py+=P[i]*pf(c,f));const sc=py*gain;
  if(py>=.1&&sc>bs){bs=sc;best={kind:'bool',id:f,sc,recheck:true}}}
 return best;
}
function safety(A){const out=[];KB.SAFETY.forEach(r=>{try{if(r.when(A,S)){out.push({...r,u:typeof r.urg==='function'?r.urg(A):r.urg})}}catch(e){}});return out}
function verdict(){
 const A=S.dx.A,R=ranked(A),sf=safety(A);
 let lv=S.dx.chokeDone?(S.log.some(x=>/stlačenia brucha/.test(x.txt))?'orange':'yellow'):'green';sf.forEach(r=>lv=lvMax(lv,r.u));
 R.forEach(({c,p})=>{if(c.id==='other')return;const u=urgOf(c,A);if(p>=.25||(u==='red'&&p>=.15))lv=lvMax(lv,u)});
 return{lv,R,sf};
}
function reasons(c,A){const pro=[],con=[];
 for(const f in F){if(A[f]===true){const lr=pf(c,f)/F[f].q;if(lr>=2)pro.push(F[f].t);else if(lr<=.5)con.push(F[f].t)}
  else if(A[f]===false){const lr=(1-pf(c,f))/(1-F[f].q);if(lr<=.6)con.push('nie je: '+F[f].t.toLowerCase())}}
 for(const v in V){const val=A[v];if(!val||val==='?')continue;const X=V[v];const lab=X.vals.find(x=>x[0]===val)[1];
  const i=X.vals.findIndex(x=>x[0]===val);const b=X.base[i]/X.base.reduce((a,b)=>a+b,0);const lr=pv(c,v,val)/b;
  if(lr>=2)pro.push(X.t+': '+lab);else if(lr<=.4)con.push(X.t+': '+lab)}
 return{pro,con};
}


if(typeof module!=="undefined")module.exports={postVec,ranked,pickNext,safety,verdict,reasons,urgOf};
