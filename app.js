/* =====================================================================
   Sprievodca prvej pomoci – aplikácia (UI + diagnostické jadro)
   Obsah (príznaky, stavy, pravidlá, pokyny) je v kb.js
   ===================================================================== */
/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const app=$('#app');
const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const tm=()=>new Date().toLocaleTimeString('sk-SK',{hour:'2-digit',minute:'2-digit'});
function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!==undefined)e.innerHTML=html;return e}
/* ---------- texty podľa pohlavia (pri žene) ---------- */
const GPH=[['bledý, studený a spotený','bledá, studená a spotená'],['na dotyk studený','na dotyk studená'],['na dotyk horúci','na dotyk horúca'],['za neho','za ňu'],['sa ho opýtaj','sa jej opýtaj'],['sa ho opýtať','sa jej opýtať'],['Je diabetik?','Je diabetička?'],['Diabetik','Diabetička']];
const GW={bol:'bola',mal:'mala',mohol:'mohla',mával:'mávala',odpadol:'odpadla',spadol:'spadla',udrel:'udrela',zlepšil:'zlepšila',bledý:'bledá',bodnutý:'bodnutá',nehybný:'nehybná',
 ospalý:'ospalá',opretý:'opretá',pil:'pila',pokúsil:'pokúsila',pomočil:'pomočila',prebral:'prebrala',rozrušený:'rozrušená',samého:'samú',slabý:'slabá',spotený:'spotená',
 unavený:'unavená',užil:'užila',vystrašený:'vystrašená',zjedol:'zjedla',zmätený:'zmätená',zranil:'zranila',zvracal:'zvracala',topil:'topila',spavý:'spavá',horúci:'horúca',
 ho:'ju',jeho:'jej',mu:'jej',neho:'nej',ním:'ňou',ňom:'nej',prebudil:'prebudila',vymočil:'vymočila'};
const GRX=new RegExp('(^|[^\\p{L}])('+Object.keys(GW).map(w=>w+'|'+w[0].toUpperCase()+w.slice(1)).join('|')+')(?![\\p{L}])','gu');
function gx(s){if(!s||typeof S==='undefined'||!S.dx||S.dx.A.sex!=='f')return s;let t=String(s);
 GPH.forEach(([m,f])=>{t=t.split(m).join(f)});
 return t.replace(GRX,(all,pre,w)=>{const low=w.toLowerCase();let r=GW[low];if(w[0]!==low[0])r=r[0].toUpperCase()+r.slice(1);return pre+r})}
let toastT;function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('show'),3200)}

/* ---------- state ---------- */
function fresh(){return{node:'START',f:{},log:[],alerts:[],hist:[],scen:'',onset:false,onsetH:null,onsetTxt:'',called:{},
 patient:{sex:''},after:null,cprStart:null,dx:{A:{},asked:[],n:0,mainDone:false,mode:'talk',extra:0}}}
let S=fresh();
let CUR=[],timers=[],CURQ=null;
function addLog(k,txt){S.log.push({k,t:tm(),txt})}
function logCall(num){if(!S.called[num]){S.called[num]=true;addLog('a','Volané '+num)}}
function snap(){const {hist,...rest}=S;return JSON.stringify(rest)}
/* uloženie stavu – ak telefón appku na pozadí zavrie, po návrate pokračuje tam, kde si bol */
function save(){try{localStorage.setItem('pp_state',JSON.stringify({t:Date.now(),S,OVER,LOC}))}catch(e){}}
function restore(){try{const j=JSON.parse(localStorage.getItem('pp_state')||'null');if(!j||Date.now()-j.t>6*3600e3||!j.S||j.S.node==='START')return false;
 S=j.S;if(j.LOC&&!j.LOC.busy)LOC=j.LOC;show(S.node);if(j.OVER==='sum')showSummary();else if(j.OVER==='brief')showBrief();toast('Pokračujeme tam, kde si skončil');return true}catch(e){return false}}
function pushHist(){S.hist.push(snap())}
let OVER=null;
function back(){if(OVER){OVER=null;save();show(S.node);return}if(!S.hist.length){toast('Si na začiatku');return}const h=S.hist;const st=JSON.parse(h.pop());S={...st,hist:h};show(S.node)}

/* =====================================================================
   OBSAH TOKU (primárne vyšetrenie zostáva pevný protokol)
   ===================================================================== */
const onsetOpts=next=>[
 {l:'Pred chvíľou (do hodiny)',ico:'⏱️',h:1,kw:['chvilou','chvilu','do hodiny']},
 {l:'Pred pár hodinami (1 – 4 h)',ico:'🕐',h:4,kw:['jednu az styri','par hodin']},
 {l:'Dnes alebo od včera',ico:'🕓',h:24,kw:['dnes','rano','vcera']},
 {l:'Už niekoľko dní',ico:'📅',h:99,kw:['dlhsie','postupne','dni']},
 {l:'Neviem',ico:'❓',h:null,kw:['neviem']}
].map(o=>({...o,go:next,set:S=>{S.onset=true;S.onsetH=o.h;S.onsetTxt=o.l;
  if(o.h!==null)S.dx.A.confusion_sudden=o.h<=4?true:(o.h>=99?false:undefined);if(S.dx.A.confusion_sudden===undefined)delete S.dx.A.confusion_sudden}}));

const N={
START:{type:'start'},
L1:{step:'Krok 1 · Bezpečnosť',ico:'⚠️',t:'Je miesto bezpečné?',
 q:'Skôr než k nemu pristúpiš, rozhliadni sa: doprava, elektrina, plyn, oheň, agresívny človek.',
 opts:[{l:'Áno, je bezpečné',ico:'✅',go:'L2',kw:['ano','bezpecne','idem']},
  {l:'Nie je bezpečné',ico:'⛔',alert:'danger',go:'L2',f:'Nebezpečné prostredie na mieste',kw:['nie','nebezpecne']}]},
L2:{step:'Krok 2 · Vedomie',ico:'🗣️',t:'Reaguje?',q:'Nahlas ho osloviť („Haló, počujete ma?") a jemne mu zatriasť ramenami.',
 opts:[{l:'Otvorí oči, hovorí alebo sa hýbe',ico:'🙂',f:'Reaguje na oslovenie',go:'DX',kw:['otvori','hovori','hybe','reaguje']},
  {l:'Len stoná / reaguje až na bolesť',ico:'😣',f:'Reaguje len na bolestivý podnet / stoná',set:S=>{S.dx.A.drowsy=true;S.dx.mode='obs';S.alerts.push('drowsy')},go:'L3',kw:['stona','bolest']},
  {l:'Nereaguje vôbec',ico:'😶',f:'Nereaguje na oslovenie ani zatrasenie',flag:'unresp',set:S=>{S.dx.mode='obs'},go:'L3',kw:['nereaguje','vobec','nic']}]},
L3:{step:'Krok 3 · Dýchanie',ico:'🌬️',t:'Dýcha normálne?',
 q:'Otoč ho na chrbát a zaklon mu hlavu (ruka na čelo, dva prsty pod bradu). Pozeraj na hrudník, počúvaj a cíť dych pri ústach – najviac 10 sekúnd.',
 hint:'Ojedinelé lapavé „vzdychy" NIE sú normálne dýchanie. Ak si nie si istý, ber to ako „nedýcha".',
 opts:[{l:'Dýcha normálne',ico:'🌬️',f:'Dýcha normálne',alert:'unc',go:'DX',kw:['dycha','normalne']},
  {l:'Nedýcha / len lapá po dychu',ico:'🚫',f:'Nedýcha normálne (bez dychu / lapavé dychy)',flag:'cardiac',go:'CPR',kw:['nedycha','lapa']},
  {l:'Neviem posúdiť',ico:'❓',f:'Dýchanie nejasné – postup ako pri zástave',flag:'cardiac',go:'CPR',kw:['neviem']}]},
CPR:{type:'cpr'},
B0:{step:'Začiatok ťažkostí',ico:'🕐',t:'Kedy bol naposledy úplne v poriadku?',q:'Pri mozgovej príhode je tento čas pre lekárov veľmi dôležitý.',opts:onsetOpts('B1')},
B1:{step:'Vedomie',ico:'🗣️',t:'Ako reaguje, keď sa mu prihovoríš?',
 opts:[{l:'Je hore a komunikuje',ico:'🙂',f:'Pri vedomí, komunikuje',go:'DX',kw:['komunikuje','hore','hovori']},
  {l:'Spavý, ťažko sa prebúdza',ico:'😴',f:'Spavý, ťažko prebuditeľný',set:S=>{S.dx.A.drowsy=true},go:'DX',kw:['spavy','prebudza','spi']},
  {l:'Nereaguje',ico:'😶',f:'Nereaguje na oslovenie',flag:'unresp',set:S=>{S.dx.mode='obs'},go:'L3',kw:['nereaguje']}]},
CH1:{step:'Dusenie (dospelý / dieťa nad 1 rok)',ico:'😮',t:'Dokáže kašľať alebo hovoriť?',
 q:'Opýtaj sa: „Dusíte sa?" Ak kašle, je to dobré – kašeľ je najúčinnejší.',
 opts:[{l:'Áno, kašle / hovorí',ico:'🗣️',f:'Dusenie – účinný kašeľ',go:'CH2',kw:['ano','kasle','hovori']},
  {l:'Nie – nevie kašľať, hovoriť ani dýchať',ico:'🚫',f:'Dusenie – neúčinný kašeľ',go:'CH3',kw:['nie','nevie','nedycha']},
  {l:'Stratil vedomie',ico:'😶',f:'Dusenie – strata vedomia',flag:'unresp cardiac',go:'CPR',kw:['stratil','vedomie','nereaguje']}]},
CH2:{step:'Dusenie',ico:'🗣️',t:'Povzbudzuj ho, nech kašle',q:'Nič nerob, len ho povzbudzuj ku kašľu a buď pri ňom. Ak prestane kašľať alebo nemôže dýchať, prejdi na údery do chrbta.',
 opts:[{l:'Vykašľal to, dýcha normálne',ico:'✅',a:'Cudzie teleso vykašľané',go:'CH4',kw:['vykaslal','dycha']},
  {l:'Kašeľ slabne, nevie dýchať',ico:'🚫',f:'Kašeľ zoslabol',go:'CH3',kw:['slabne','nevie']}]},
CH3:{type:'alert',step:'Dusenie',ico:'✋',t:'5 úderov do chrbta, potom 5 stlačení brucha',call:'155',
 q:'Volaj 155 (hlasitý odposluch). Predkloň ho a daj 5 silných úderov dlaňou medzi lopatky. Ak to nepomôže, postav sa za neho, päsť nad pupok, druhou rukou ju chyť a 5× prudko zatlač dovnútra a hore. Striedaj 5 úderov a 5 stlačení. DOJČA do 1 roka: polož ho bruškom na predlaktie hlavou nižšie, 5 úderov medzi lopatky, potom ho otoč na chrbát a 5× stlač stred hrudníka dvoma prstami (brucho dojčaťu nestláčaj). Ak stratí vedomie → resuscitácia.',
 opts:[{l:'Uvoľnilo sa, dýcha',ico:'✅',a:'Údery do chrbta / stlačenia brucha – uvoľnené',go:'CH4',kw:['uvolnilo','dycha']},
  {l:'Stratil vedomie',ico:'😶',a:'Strata vedomia pri dusení',flag:'unresp cardiac',go:'CPR',kw:['stratil','vedomie']}]},
CH4:{type:'alert',step:'Po dusení',ico:'🩺',t:'Nechaj ho skontrolovať lekárom',call:'none',
 q:'Ak boli potrebné stlačenia brucha alebo ak pretrváva kašeľ, bolesť alebo ťažkosti s prehĺtaním či dýchaním, musí ho ešte dnes vyšetriť lekár (stlačenia môžu spôsobiť vnútorné poranenie).',
 opts:[{l:'Rozumiem – vyhodnotiť',ico:'🏁',go:'DXR',set:S=>{S.dx.chokeDone=true},kw:['rozumiem','vyhodnotit']}]},
S1:{step:'Krok 1',ico:'🗣️',t:'Reaguje, keď ho oslovíš?',
 q:'Nahlas ho osloviť („Haló, počujete ma?") a jemne mu zatriasť ramenami.',hint:'Najprv sa rozhliadni, či je miesto bezpečné (doprava, elektrina, plyn, oheň).',
 opts:[{l:'Áno, komunikuje normálne',ico:'🙂',f:'Pri vedomí, komunikuje',go:'S2',set:S=>{S.scen='Pri vedomí'},kw:['ano','normalne','komunikuje']},
  {l:'Reaguje, ale je zmätený alebo mrmle',ico:'😵‍💫',f:'Pri vedomí, zmätený',go:'S2',set:S=>{S.scen='Pri vedomí, zmätený';S.dx.A.confusion=true},kw:['zmateny','mrmle']},
  {l:'Je spavý, ťažko ho prebudím, len stoná',ico:'😴',f:'Porucha vedomia – spavý / reaguje len na bolesť',go:'S2',set:S=>{S.scen='Porucha vedomia';S.dx.A.drowsy=true},kw:['spavy','prebudim','stona']},
  {l:'Nereaguje vôbec',ico:'😶',f:'Nereaguje na oslovenie ani zatrasenie',flag:'unresp',go:'L3',set:S=>{S.scen='Bezvedomie';S.dx.mode='obs'},kw:['nereaguje','vobec']},
  {l:'Miesto nie je bezpečné',ico:'⛔',cls:'ghost',alert:'danger',go:'S1',f:'Nebezpečné prostredie na mieste',kw:['nebezpecne','bezpecne']}]},
S2:{step:'Krok 2',ico:'⚠️',t:'Ohrozuje ho niečo práve teraz?',
 opts:[{l:'Dusí sa – nevie dýchať ani hovoriť',ico:'😮',go:'CH1',set:S=>{S.scen+=' · dusenie'},kw:['dusi','dusenie','zaskocilo']},
  {l:'Silno krváca',ico:'🩸',go:'DX',set:S=>{S.dx.A.bleeding_heavy=true;S.scen+=' · krvácanie'},kw:['krvaca']},
  {l:'Má práve kŕče',ico:'⚡',go:'DX',set:S=>{S.dx.A.seizure=true;S.scen+=' · kŕče'},kw:['krce']},
  {l:'Ťažko dýcha',ico:'😮‍💨',go:'DX',set:S=>{S.dx.A.dyspnea=true;S.scen+=' · dýchavica'},kw:['dycha','tazko']},
  {l:'Zaseklo sa mu sústo, ale dýcha',ico:'🍖',go:'DX',set:S=>{S.dx.A.food_stuck=true;S.scen+=' · zaseknuté sústo'},kw:['sustom','zaseklo','jedlo']},
  {l:'Nič z toho',ico:'➜',cls:'primary',go:'DX',kw:['nic','nie','dalej']}]},
ONSET:{step:'Začiatok ťažkostí',ico:'🕐',t:'Odkedy má tieto ťažkosti?',q:'Ak to nevieš presne, odhadni. Pri mozgovej príhode a úrazoch rozhoduje každá hodina.',opts:onsetOpts('DX')},
DX:{type:'dx'},
DXR:{type:'dxr'}
};
N.NEHODA={type:'alert',step:'Dopravná nehoda',ico:'🚗',t:'Najprv bezpečnosť – tvoja aj ostatných',call:'112',
 q:'Zastav bezpečne, zapni výstražné svetlá, obleč reflexnú vestu a postav výstražný trojuholník dostatočne ďaleko za nehodu. Ak sa dá, vypni motor havarovaného auta. Nefajči.',
 hint:'Volaj 112 – pošlú záchranku, hasičov aj políciu naraz. Povedz, koľko je zranených a či je niekto zakliesnený v aute.',
 opts:[{l:'Posúdiť zraneného',ico:'➜',cls:'primary',go:'S1',f:'Dopravná nehoda',set:S=>{S.scen='Dopravná nehoda';S.dx.A.mvc=true},kw:['posudit','zraneneho','dalej']},
  {l:'Zranených je viac – koho prvého?',ico:'👥',go:'NEHODA2',kw:['viac','koho']}]};
N.NEHODA2={type:'alert',step:'Viac zranených',ico:'👥',t:'Najprv tí, ktorí sú ticho',call:'112',
 q:'1) Kto nereaguje alebo nedýcha normálne – ten má prednosť (uvoľni dýchacie cesty, prípadne resuscitácia). 2) Kto silno krváca – stlač ranu. 3) Kto kričí a hýbe sa, dýcha – príde na rad neskôr. Každého posúď zvlášť; po výsledku daj „Posúdiť ďalšieho zraneného“.',
 opts:[{l:'Posúdiť prvého zraneného',ico:'➜',cls:'primary',go:'S1',f:'Dopravná nehoda, viac zranených',set:S=>{S.scen='Dopravná nehoda';S.dx.A.mvc=true},kw:['posudit','prveho','dalej']}]};
Object.entries(KB.ALERTS).forEach(([k,a])=>{
 const num=a.call||'155';
 const opts=[{l:a.cont||(num==='none'?'Pokračovať':('Volám / volal som '+(num==='0254774166'?'':num+' ')+'– pokračovať').replace('  ',' ')),ico:'➜',cls:'primary',go:S=>S.after||'DX',
  set:S=>{if(num==='155'||num==='112')logCall(num)},kw:['pokracovat','pokracuj','dalej','volam','volal']}];
 if(k==='unc')opts.push({l:'Prestal dýchať',ico:'🚫',flag:'cardiac',f:'Prestal dýchať',go:'CPR',cls:'danger',kw:['prestal','nedycha']});
 N['AL_'+k]={type:'alert',step:'Dôležité',ico:a.ico,t:a.t,q:a.q,call:num,callLabel:a.callLabel,also155:k==='poison',call2:a.call2,call2Label:a.call2Label,opts};
});

/* =====================================================================
   SÚHRN
   ===================================================================== */
function summaryText(){
 const d=new Date(),{lv,R,sf}=verdict();
 let s=`SÚHRN PRE ZÁCHRANKU / LEKÁRA\n${d.toLocaleDateString('sk-SK')} ${tm()}\n`;
 s+=`Situácia: ${S.scen||'–'}\n`;
 const age=S.dx.A.age&&S.dx.A.age!=='?'?V.age.vals.find(x=>x[0]===S.dx.A.age)[1]:'';
 const sx=sexLabel(S.dx.A);
 const p=[sx,age].filter(Boolean).join(', ');if(p)s+=`Pacient: ${p}\n`;
 const vit=[S.dx.A.bp&&S.dx.A.bp!=='?'?'TK '+V.bp.vals.find(x=>x[0]===S.dx.A.bp)[1]:'',S.dx.A.pulse&&S.dx.A.pulse!=='?'?'pulz '+V.pulse.vals.find(x=>x[0]===S.dx.A.pulse)[1]:'',S.dx.A.glu&&S.dx.A.glu!=='?'?'glykémia '+V.glu.vals.find(x=>x[0]===S.dx.A.glu)[1]:''].filter(Boolean).join(', ');if(vit)s+=`Namerané: ${vit}\n`;
 if(S.onsetTxt)s+=`Ťažkosti začali: ${S.onsetTxt.toLowerCase()}\n`;
 {const l=locLines();if(l&&!l.err)s+=`Poloha: ${l.addr?l.addr+' · ':''}GPS ${l.dec} (±${l.acc} m)\n`}
 const Fd=S.log.filter(x=>x.k==='f'),Ad=S.log.filter(x=>x.k==='a');
 const yes=Fd.filter(x=>!/: nie$|: nevie$/.test(x.txt)),no=Fd.filter(x=>/: nie$/.test(x.txt));
 s+='\nZISTENÉ:\n'+(yes.length?yes.map(x=>`• ${x.t}  ${x.txt.replace(/: áno$/,'')}`).join('\n'):'• –');
 if(no.length)s+='\n\nVYLÚČILI SME: '+no.map(x=>x.txt.replace(/: nie$/,'').toLowerCase()).join(', ');
 s+='\n\nVYKONANÉ:\n'+(Ad.length?Ad.map(x=>`• ${x.t}  ${x.txt}`).join('\n'):'• –');
 s+=`\n\nVÝSLEDOK SPRIEVODCU: ${KB.LEVEL[lv].label}`;
 const why=sf.filter(r=>r.u!=='green').map(r=>r.why);if(why.length)s+='\n'+why.map(x=>'! '+x).join('\n');
 if(S.dx.mainDone){s+='\n\nMOŽNÉ PRÍČINY (laický odhad, nie diagnóza):\n'+R.slice(0,3).map(({c,p})=>`• ${c.name} – ${Math.round(p*100)} %`).join('\n')}
 s+='\n\n(Laické posúdenie, nie diagnóza.)';
 return gx(s);
}
/* =====================================================================
   BRIEF PRE DISPEČING + POLOHA
   ===================================================================== */
const BLOCK=new Set(['unc','danger','airway','anaph','bleed']); // tieto prerušia otázky; ostatné len pruh hore
let LOC=null; // {lat,lon,acc,addr,err,busy}
function fmtDMS(v,pos,neg){const h=v>=0?pos:neg;v=Math.abs(v);const d=Math.floor(v),m=Math.floor((v-d)*60),s=((v-d)*60-m)*60;return `${d}°${String(m).padStart(2,'0')}'${s.toFixed(1).padStart(4,'0')}"${h}`}
function locLines(){
 if(!LOC||LOC.busy)return null;if(LOC.err)return {err:LOC.err};
 const la=LOC.lat.toFixed(5),lo=LOC.lon.toFixed(5);
 return {dec:`${la} N, ${lo} E`,say:`${la.replace('.',',')} severne, ${lo.replace('.',',')} východne`,dms:`${fmtDMS(LOC.lat,'N','S')} ${fmtDMS(LOC.lon,'E','W')}`,acc:Math.round(LOC.acc),addr:LOC.addr};
}
function getLoc(cb){
 if(!('geolocation' in navigator)){LOC={err:'Telefón neposkytuje polohu.'};cb&&cb();return}
 LOC={busy:true};cb&&cb();
 navigator.geolocation.getCurrentPosition(p=>{
  LOC={lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy,addr:null};addLog('a','Poloha GPS zistená');cb&&cb();
  fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=sk&lat=${LOC.lat}&lon=${LOC.lon}`)
   .then(r=>r.json()).then(j=>{const a=j.address||{};
    const street=[a.road||a.pedestrian||a.footway||a.path,a.house_number].filter(Boolean).join(' ');
    const town=a.city||a.town||a.village||a.municipality||a.hamlet||'';
    const part=a.suburb||a.city_district||a.quarter||'';
    const s=[street,part&&part!==town?part:'',town].filter(Boolean).join(', ');
    if(LOC&&!LOC.err){LOC.addr=s||null;cb&&cb()}}).catch(()=>{});
 },e=>{LOC={err:e.code===1?'Prístup k polohe je zakázaný – povoľ ho v nastaveniach prehliadača.':'Polohu sa nepodarilo zistiť (skús vonku alebo zapni GPS).'};cb&&cb()},
 {enableHighAccuracy:true,timeout:20000,maximumAge:30000});
}
function keyFindings(){
 const A=S.dx.A,soft=S.dx.soft||{};
 const pos=Object.keys(A).filter(k=>F[k]&&A[k]===true&&!soft[k]&&!(k==='confusion_sudden'&&A.confusion!==true));
 pos.sort((a,b)=>(F[b].rf?1:0)-(F[a].rf?1:0));
 return pos.map(k=>F[k].t);
}
function sexLabel(A){if(!A.sex||A.sex==='?')return'';const kid=A.age==='infant'||A.age==='child',adult=A.age&&A.age!=='?'&&!kid;
 return A.sex==='m'?(kid?'Chlapec':adult?'Muž':'Muž / chlapec'):(kid?'Dievča':adult?'Žena':'Žena / dievča')}
function briefData(){
 const A=S.dx.A,vv=(k)=>A[k]&&A[k]!=='?'?V[k].vals.find(x=>x[0]===A[k])[1]:'';
 const ag=vv('age');const who=[sexLabel(A),sexLabel(A)&&ag?ag.charAt(0).toLowerCase()+ag.slice(1):ag].filter(Boolean).join(', ')||'–';
 const fx=keyFindings();
 const vit=[vv('bp')&&'tlak '+vv('bp'),vv('pulse')&&'pulz '+vv('pulse'),vv('temp')&&'teplota '+vv('temp'),vv('glu')&&'cukor '+vv('glu'),vv('pain')&&'bolesť '+vv('pain')].filter(Boolean);
 const done=S.log.filter(x=>x.k==='a'&&!/^Volané|^Poloha/.test(x.txt)).map(x=>x.txt);
 const st=(S.scen||'').split(' · ').filter(Boolean);
 return {who,fx,vit,done,st,onset:S.onsetTxt};
}
function briefText(){
 const b=briefData(),l=locLines();let s='';
 s+='KDE: '+(l&&!l.err?((l.addr?l.addr+' · ':'')+l.say):'[povedz adresu alebo opíš miesto]')+'\n';
 s+='KTO: '+b.who+'\n';
 s+='ČO SA DEJE: '+(b.fx.slice(0,6).join('; ')||b.st.join(', ')||'–')+'\n';
 if(b.onset)s+='ZAČIATOK: '+b.onset.toLowerCase()+'\n';
 if(b.st.length)s+='STAV: '+b.st.join(', ')+'\n';
 if(b.vit.length)s+='NAMERANÉ: '+b.vit.join(', ')+'\n';
 if(b.done.length)s+='UROBIL SOM: '+b.done.join('; ')+'\n';
 return gx(s);
}
function briefCard(opts={}){
 const c=el('div','card brief');
 const draw=()=>{
  const b=briefData(),l=locLines();
  const row=(k,v)=>`<div class="br"><span class="bk">${k}</span><span class="bv">${v}</span></div>`;
  let loc;
  if(!LOC)loc=`<button class="chip" data-loc>📍 Zistiť moju polohu</button>`;
  else if(LOC.busy)loc='Zisťujem polohu…';
  else if(l.err)loc=esc(l.err)+` <button class="chip" data-loc>Skúsiť znova</button>`;
  else loc=`${l.addr?'<b>'+esc(l.addr)+'</b><br>':''}<span class="gps">${l.say}</span>${l.acc>100?' <span class="small">(nepresné – opíš aj okolie)</span>':''}<br><a class="chip" target="_blank" href="https://maps.google.com/?q=${LOC.lat.toFixed(5)},${LOC.lon.toFixed(5)}">🗺️ Mapa</a>`;
  c.innerHTML=`<h2>📞 Čo povedať do telefónu</h2>
   ${row('📍 Kde',loc)}
   ${row('👤 Kto',esc(gx(b.who)))}
   ${row('⚠️ Čo sa deje',esc(gx(b.fx.slice(0,6).join(' · ')||b.st.join(', ')||'–')))}
   ${b.onset?row('🕐 Začiatok',esc(b.onset)):''}
   ${b.st.length?row('🫀 Stav',esc(gx(b.st.join(', ')))):''}
   ${b.vit.length?row('📏 Namerané',esc(b.vit.join(', '))):''}
   ${b.done.length?row('🩹 Urobil som',esc(gx(b.done.join('; ')))):''}
   <p class="small">Daj hovor na reproduktor, odpovedaj na otázky dispečera a nezaväzuj prvý. V horách: Horská záchranná služba 18 300.</p>`;
  const lb=c.querySelector('[data-loc]');if(lb)lb.onclick=()=>getLoc(draw);
 };
 draw();
 if(!LOC&&navigator.permissions)navigator.permissions.query({name:'geolocation'}).then(p=>{if(p.state==='granted'&&!LOC)getLoc(draw)}).catch(()=>{});
 if(opts.autoLoc&&!LOC)getLoc(draw);
 return c;
}
function showBrief(){
 stopScreen();OVER='brief';save();const ret=S.node;app.innerHTML='';CUR=[];window.scrollTo(0,0);
 const w=el('div');w.append(el('div','step','<span class="big">📞</span><span>Hovor so záchrankou</span>'));
 w.append(el('h1','','Toto povedz dispečerovi'));
 w.append(briefCard({autoLoc:true}));
 const box=el('div','opts');box.append(callBtn('155'));
 [{l:'Prečítať nahlas',ico:'🔊',run:()=>{const o=ttsOn;ttsOn=true;speak(briefText().replace(/\n/g,'. '));ttsOn=o},kw:['precitat','citaj']},
  {l:'Kopírovať text',ico:'📄',run:()=>copyText(briefText()),kw:['kopirovat']},
  {l:'Späť k otázkam',ico:'←',cls:'ghost',run:()=>show(ret),kw:['spat','naspat']}]
  .forEach((o,i)=>{box.append(optBtn(o,i,o.run));reg(o,i,o.run)});
 w.append(box);app.append(w);
}
function alertBanner(){
 const A=S.dx.A,sf=safety(A).filter(r=>r.u==='red'||r.u==='orange');if(!sf.length)return null;
 let lv='orange';if(sf.some(r=>r.u==='red'))lv='red';
 const rs=sf.filter(r=>r.u===lv),ks=[...new Set(sf.map(r=>r.alert).filter(k=>k&&KB.ALERTS[k]&&!BLOCK.has(k)))];
 const L=KB.LEVEL[lv],b=el('div','banner'+(lv==='orange'?' or':''));
 const t=ranked(A)[0];let reason;
 if(S.dx.mainDone&&t.c.id!=='other'&&t.p>=.3&&urgOf(t.c,A)===lv)reason=`${t.p>=.5?'Najviac sedí':'Podozrenie na'}: <b>${esc(t.c.name)}</b>`;
 else reason='Dôvod: '+esc(gx(rs[0].why))+(rs.length>1?` (+${rs.length-1} ďalší)`:'');
 const extra=ks.map(k=>KB.ALERTS[k]).filter(a=>a.call&&a.call!=='155'&&a.call!=='none');
 b.innerHTML=`<div class="bt"><span>${L.ico}</span><b>${esc(L.label)}</b></div>
  <div class="small bw">${reason}</div>
  <div class="bb"><a class="bbtn call" href="tel:155">📞 155</a><button class="bbtn" data-brief>Čo povedať</button>${ks.length?'<button class="bbtn" data-what>Čo robiť ▾</button>':''}</div>
  <div class="bq" hidden>${sf.length>1?`<p><b>Všetky dôvody:</b> ${sf.map(r=>esc(gx(r.why))).join(' · ')}</p>`:''}${ks.map(x=>{const y=KB.ALERTS[x];return `<p><b>${y.ico||''} ${esc(gx(y.t))}:</b> ${esc(gx(y.q||''))}</p>`}).join('')}${extra.map(a=>`<a class="bbtn" href="tel:${a.call}">📞 ${esc(a.callLabel||a.call)}</a> `).join('')}<p class="small bw">Varovné príznaky sa vyhodnocujú zvlášť od odhadu príčiny: aj keď najviac sedí iná príčina, tieto príznaky laik nevie bezpečne vylúčiť. Otázky môžeš dokončiť aj počas čakania na záchranku.</p></div>`;
 b.querySelector('.call').onclick=()=>logCall('155');
 b.querySelector('[data-brief]').onclick=showBrief;
 const wb=b.querySelector('[data-what]');if(wb)wb.onclick=e=>{const q=b.querySelector('.bq');q.hidden=!q.hidden;e.target.textContent=q.hidden?'Čo robiť ▾':'Skryť ▴'};
 return b;
}
async function copyText(t){try{await navigator.clipboard.writeText(t);toast('Skopírované')}
 catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');toast('Skopírované')}catch(_){toast('Označ text a skopíruj ručne')}ta.remove()}}

/* =====================================================================
   REČ – výstup
   ===================================================================== */
let ttsOn=true,voice=null,speaking=false,voiceWarned=false;
function pickVoice(){if(!('speechSynthesis' in window))return;const vs=speechSynthesis.getVoices();voice=vs.find(v=>/^sk/i.test(v.lang))||vs.find(v=>/^cs/i.test(v.lang))||null}
if('speechSynthesis' in window){pickVoice();speechSynthesis.onvoiceschanged=pickVoice}
const clean=t=>(t||'').replace(/\p{Extended_Pictographic}|️|‍/gu,'').replace(/[„"“]/g,'').replace(/–/g,',');
function speak(t){t=gx(t);
 if(!ttsOn||!('speechSynthesis' in window)){if(listening)startRec();return}
 speechSynthesis.cancel();
 if(!voice){pickVoice();if(!voice&&!voiceWarned){voiceWarned=true;toast('V zariadení chýba slovenský hlas – doinštaluj ho v nastaveniach (Prevod textu na reč)')}}
 const u=new SpeechSynthesisUtterance(clean(t));u.lang=voice?voice.lang:'sk-SK';if(voice)u.voice=voice;u.rate=1.02;
 u.onend=u.onerror=()=>{speaking=false;if(listening)startRec()};speaking=true;pauseRec();speechSynthesis.speak(u);
}
function nodeSpeech(n){
 if(!n)return'';
 if(n.type==='dxr'){const {lv}=verdict();return KB.LEVEL[lv].label+'. '+KB.LEVEL[lv].advice[0]}
 if(n.type==='cpr')return'Volaj 155. Stláčaj stred hrudníka, päť až šesť centimetrov hlboko, sto až stodvadsať krát za minútu. Spusti metronóm a stláčaj do rytmu.';
 if(n.type==='start')return'Čo sa deje?';
 if(n.type==='dx')return CURQ?CURQ.say:'';
 let t=[n.t,n.q].filter(Boolean).join('. ');
 if(listening){const l=(n.opts||[]).map(o=>o.l);if(l.length)t+='. Možnosti: '+l.join('; ')}
 return t;
}
function speakNode(){speak(nodeSpeech(N[S.node]))}

/* =====================================================================
   REČ – vstup (jedno počúvanie na otázku)
   ===================================================================== */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
let rec=null,listening=false,recActive=false,recTries=0,recGot=false,recStarted=0;
function updMic(){const b=$('#bMic');b.classList.toggle('on',listening);b.textContent=!listening?'🎤 Hovoriť':recActive?'🎤 Počúvam… (vypnúť)':'🎤 Ťukni a hovor'}
function pauseRec(){try{rec&&rec.abort()}catch(e){}recActive=false}
function startRec(){
 if(!SR||!listening||speaking||recActive)return;
 rec=new SR();rec.lang='sk-SK';rec.interimResults=false;rec.maxAlternatives=3;rec.continuous=false;recGot=false;recStarted=Date.now();
 rec.onstart=()=>{recActive=true;updMic()};
 rec.onresult=e=>{recGot=true;handleVoice([...e.results[0]].map(r=>r.transcript))};
 rec.onerror=e=>{if(/not-allowed|service-not-allowed|audio-capture/.test(e.error)){listening=false;toast('Mikrofón nie je povolený. Povoľ ho v nastaveniach prehliadača pre túto stránku.')}};
 rec.onend=()=>{recActive=false;if(listening&&!recGot&&!speaking&&recTries<1&&Date.now()-recStarted<1500){recTries++;setTimeout(startRec,700)}updMic()};
 try{rec.start()}catch(e){recActive=false}
}
const ORD=[['prva','prvu','prvy','jedna','jednotka'],['druha','druhu','druhy','dva','dvojka'],['tretia','tretiu','treti','tri','trojka'],['stvrta','stvrtu','styri','stvorka'],['piata','piatu','pat','patka'],['siesta','siestu','sest']];
function handleVoice(alts){
 toast('🎤 „'+(alts[0]||'')+'"');
 for(const raw of alts){const t=norm(raw),p=' '+t+' ';
  if(/ (spat|naspat) /.test(p)){back();return}
  if(/ (suhrn) /.test(p)){showSummary();return}
  if(/ (opakuj|zopakuj|este raz) /.test(p)){speakNode();return}
  let best=null,bl=0;
  CUR.forEach(c=>c.kw.forEach(k=>{if(!k)return;const hit=k.length>=4?t.includes(k):p.includes(' '+k+' ');if(hit&&k.length>bl){bl=k.length;best=c}}));
  if(best){best.act();return}}
 const p=' '+norm(alts[0])+' ';
 for(let i=0;i<ORD.length;i++)if(ORD[i].some(w=>p.includes(' '+w+' '))){const c=CUR.find(c=>c.i===i);if(c){c.act();return}}
 toast('Nerozumel som – zopakuj alebo klikni');
}
function kwOf(o){const l=norm(o.l);const first=l.split(' ')[0];return[...(o.kw||[]).map(norm),l,first.length>=4?first:''].filter(Boolean)}
function reg(o,i,act){CUR.push({kw:kwOf(o),i,act})}

/* =====================================================================
   ENGINE / RENDER
   ===================================================================== */
function apply(o){if(o.f)addLog('f',o.f);if(o.a)addLog('a',o.a);(o.flag||'').split(' ').filter(Boolean).forEach(k=>S.f[k]=true);if(o.set)o.set(S)}
function nextOf(n,o){const g=o&&o.go!==undefined?o.go:n.next;return typeof g==='function'?g(S):g}
function proceed(next,al){if(al&&!S.alerts.includes(al)){S.alerts.push(al);S.after=next;next='AL_'+al}show(next)}
function choose(n,o){pushHist();apply(o);proceed(nextOf(n,o),o.alert)}
function stopScreen(){timers.forEach(clearInterval);timers=[]}
function show(id){
 stopScreen();OVER=null;S.node=id;const n=N[id];recTries=0;pauseRec();
 app.innerHTML='';CUR=[];CURQ=null;window.scrollTo(0,0);
 ({start:renderStart,cpr:renderCPR,dx:renderDX,dxr:renderResult}[n.type]||renderQ)(n);
 save();
 if(S.node!==id)return; // počas renderu sa presmerovalo (napr. na upozornenie)
 if(n.type==='dx'){const bn=alertBanner();if(bn)app.prepend(bn);if(S.newAlert&&CURQ){const y=KB.ALERTS[S.newAlert];CURQ.say='Pozor: '+gx(y.t)+'. '+(y.call==='none'?'':'Zváž volanie '+(y.callLabel||y.call||'155')+'. ')+CURQ.say}S.newAlert=null}
 if(n.type!=='start')speakNode();else if(listening)startRec();
}
function optBtn(o,i,onClick){const b=el('button','opt '+(o.cls||''),`<span class="ico">${o.ico||''}</span><span>${esc(gx(o.l))}</span>${i>=0?`<span class="num">${i+1}</span>`:''}`);b.onclick=onClick;return b}
function callBtn(num,label){
 const a=el('a','opt danger',`<span class="ico">📞</span><span>Volať ${esc(label||num)}</span>`);
 a.href='tel:'+num;a.target='_top';
 a.onclick=()=>{logCall(label||num);toast('Ak sa hovor nespustil, vytoč '+(label||num)+' ručne')};
 CUR.push({kw:['volat','zavolaj','zavolat'],i:-1,act:()=>{logCall(label||num);toast('Vytoč '+(label||num))}});
 return a;
}
function head(n,w){
 w.append(el('div','step',`<span class="big">${n.ico||''}</span><span>${esc(n.step||'')}</span>`));
 w.append(el('h1','',esc(gx(n.t))));
 if(n.q)w.append(el('p','q',esc(gx(n.q))));
 if(n.hint)w.append(el('div','hint','💡 '+esc(gx(n.hint))));
}
function renderQ(n){
 const w=el('div',n.type==='alert'?'alert':'');head(n,w);const box=el('div','opts');
 if(n.call&&n.call!=='none')box.append(callBtn(n.call,n.callLabel));
 if(n.also155)box.append(callBtn('155'));
 if(n.call2)box.append(callBtn(n.call2,n.call2Label));
 n.opts.forEach((o,i)=>{const act=()=>choose(n,o);box.append(optBtn(o,i,act));reg(o,i,act)});
 w.append(box);app.append(w);
}

/* ---------- adaptívne otázky ---------- */
function answer(id,val,label){
 pushHist();const D=S.dx;D.A[id]=val;D.asked.push(id);if(id==='temp'&&(val==='hot'||val==='vhot')&&D.A.fever===undefined)D.A.fever=true;if(id==='temp'&&val==='low'&&D.A.cold_env===undefined){}if(D.soft)delete D.soft[id];if(D.mainDone&&id!=='age')D.n++;
 addLog('f',label);show('DX');
}
function hypLine(){
 const R=ranked(S.dx.A);const t=R[0];if(!S.dx.mainDone||t.c.id==='other'||t.p<.25)return null;
 return el('p','small',`${t.p>=.5?'Zatiaľ najviac sedí':'Podozrenie na'}: <b>${esc(t.c.name)}</b> (${Math.round(t.p*100)} %)${t.p<.5?' – zatiaľ neisté':''}`);
}
function renderDX(){
 const D=S.dx,A=D.A;
 for(const r of safety(A))if(r.alert&&!S.alerts.includes(r.alert)){S.alerts.push(r.alert);if(BLOCK.has(r.alert)){S.after='DX';show('AL_'+r.alert);return}S.newAlert=r.alert;try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}}
 if(A.age===undefined)return renderVar('age');
 if(A.sex===undefined)return renderVar('sex');
 if(!S.onset){S.onset=true;show('ONSET');return}
 if(!D.catsDone)return renderCats();
 if(!D.mainDone)return renderMain();
 const nx=pickNext();if(!nx){show('DXR');return}
 if(nx.kind==='bool'){const g=(KB.GROUPS||[]).find(g=>g.opts.some(o=>o[1]===nx.id)&&g.when(A));
  if(g){const el2=g.opts.filter(o=>o[1]&&eligible(o[1],false));if(el2.length>=2)return renderGroup(g,el2)}}
 nx.kind==='var'?renderVar(nx.id):renderBool(nx.id);
}
function qWrap(ico,step,title,hint){
 const w=el('div');w.append(el('div','step',`<span class="big">${ico}</span><span>${esc(step)}</span>`));
 w.append(el('h1','',esc(gx(title))));if(hint)w.append(el('div','hint','💡 '+esc(gx(hint))));
 const hl=hypLine();if(hl)w.append(hl);return w;
}
function finishBtn(box){
 if(!S.dx.mainDone)return;
 const o={l:'Vyhodnotiť teraz',ico:'🏁',cls:'ghost'};const act=()=>{pushHist();show('DXR')};
 box.append(optBtn(o,-1,act));CUR.push({kw:['vyhodnotit','vyhodnot','koniec'],i:-1,act});
}
function renderBool(f){
 const X=F[f],ask=typeof X.ask==='function'?X.ask(S.dx.A):X.ask;CURQ={say:gx(ask)};
 const w=qWrap(X.ico,`Otázka ${S.dx.n+1}`+(S.dx.mode==='obs'?' · pozoruj':''),ask,X.hint);
 const box=el('div','opts');
 [{l:X.yes||'Áno',ico:'✅',v:true,kw:['ano','hej','jo','ma','mal','je','preslo']},{l:X.no||'Nie',ico:'❌',v:false,kw:['nie','nema','nemal','neni']},{l:'Neviem',ico:'❓',v:'?',kw:['neviem','nevie','netusim']}]
  .forEach((o,i)=>{const act=()=>{if(o.v==='?'){pushHist();S.dx.asked.push(f);S.dx.n++;if(S.dx.soft&&S.dx.soft[f]){delete S.dx.soft[f];delete S.dx.A[f]}addLog('f',X.t+': nevie');show('DX')}else{const v=X.inv?!o.v:o.v;answer(f,v,X.t+': '+(v?'áno':'nie'))}};
   box.append(optBtn(o,i,act));reg(o,i,act)});
 finishBtn(box);w.append(box);app.append(w);
 if(listening)CURQ.say+='. Áno, nie, alebo neviem?';
}
function renderGroup(g,mem){
 const D=S.dx,A=D.A;CURQ={say:g.ask};
 const w=qWrap(g.ico,`Otázka ${D.n+1}`,g.ask,g.hint);const box=el('div','opts');
 const ids=mem.map(o=>o[1]);
 const opts=g.opts.filter(o=>!o[1]||ids.includes(o[1]));
 const set=pick=>{pushHist();ids.forEach(f=>{A[f]=(f===pick);D.asked.push(f);if(D.soft)delete D.soft[f]});D.n++;
  addLog('f',g.ask.replace(/\?.*$/,'')+': '+(pick?F[pick].t:opts.find(o=>!o[1])[0]));show('DX')};
 opts.forEach((o,i)=>{const act=()=>set(o[1]);box.append(optBtn({l:o[0],ico:o[2]||'•'},i,act));reg({l:o[0]},i,act)});
 const nv=()=>{pushHist();ids.forEach(f=>D.asked.push(f));D.n++;addLog('f',g.ask.replace(/\?.*$/,'')+': nevie');show('DX')};
 box.append(optBtn({l:'Neviem',ico:'❓',cls:'ghost'},opts.length,nv));reg({l:'Neviem',kw:['neviem']},opts.length,nv);
 finishBtn(box);w.append(box);app.append(w);
}
function renderVar(v){
 const X=V[v];CURQ={say:X.ask};
 const w=qWrap(X.ico,(v==='age'||v==='sex')?'Krok 3 · Kto to je':`Otázka ${S.dx.n+1}`,X.ask);
 const box=el('div','opts');
 X.vals.forEach(([val,lab],i)=>{const o={l:lab,ico:'•'};const act=()=>answer(v,val,X.t+': '+lab);box.append(optBtn(o,i,act));reg(o,i,act)});
 const sk={l:X.skip||'Neviem',ico:'❓',kw:['neviem','nemam']};
 const act=()=>{pushHist();S.dx.A[v]='?';S.dx.asked.push(v);if(S.dx.mainDone)S.dx.n++;show('DX')};
 box.append(optBtn(sk,X.vals.length,act));reg(sk,X.vals.length,act);
 finishBtn(box);w.append(box);app.append(w);
}
const dispOk=(f,A)=>{const X=F[f];if(S.dx.mode==='obs'&&!X.obs)return false;if(A[f]===true)return true;if(X.na&&X.na.includes(A.age))return false;try{return X.disp?X.disp(A):(!X.req||X.req(A))}catch(e){return true}};
function renderCats(){
 CURQ={say:'Čo sa deje? Ťukni na oblasť, rozbalia sa príznaky. Označ všetko, čo platí, a potom povedz hotovo.'};
 const D=S.dx,A=D.A;
 const w=qWrap('🧭','Krok 4 · Čo sa deje','Kde je problém a čo pozoruješ?','Ťukni na oblasť – rozbalia sa jej príznaky. Označ všetko, čo platí (aj vo viacerých oblastiach).');
 const cats=KB.CATS.filter(c=>{try{return !c.show||c.show(A)}catch(e){return true}});
 const sel=new Set(KB.MAIN.filter(f=>A[f]===true));
 const open=new Set(D.cats||[]);cats.forEach(c=>{if(c.items.some(f=>sel.has(f)&&dispOk(f,A)))open.add(c.id)});
 if(sel.size)w.append(el('p','small','✓ Niektoré príznaky sú už označené podľa tvojich predchádzajúcich odpovedí. Ak neplatia, odznač ich.'));
 const btns={};const heads={};
 const cnt=c=>c.items.filter(f=>sel.has(f)&&dispOk(f,A)).length;
 const updHead=c=>{const h=heads[c.id];const n=cnt(c);h.classList.toggle('sel',open.has(c.id)||n>0);
  h.querySelector('.num').textContent=(n?n+' ✓  ':'')+(open.has(c.id)?'▴':'▾')};
 const togF=f=>{sel.has(f)?sel.delete(f):sel.add(f);(btns[f]||[]).forEach(b=>b.classList.toggle('sel',sel.has(f)));cats.forEach(c=>{if(c.items.includes(f))updHead(c)})};
 const list=el('div','opts');
 cats.forEach((c,ci)=>{
  const vis=c.items.filter(f=>dispOk(f,A));
  const h=optBtn({l:c.t,ico:c.ico},-1,()=>tog());h.classList.add('cat');h.append(el('span','num',''));heads[c.id]=h;
  const body=el('div','opts grid2 catbody');
  vis.forEach(f=>{const X=F[f];const b=optBtn({l:X.t,ico:X.ico},-1,()=>togF(f));b.classList.add('small-opt');if(sel.has(f))b.classList.add('sel');(btns[f]=btns[f]||[]).push(b);body.append(b);
   reg({l:X.t,kw:[X.t.split(' ')[0]]},-1,()=>{if(!open.has(c.id))return;togF(f);toast((sel.has(f)?'Označené: ':'Odznačené: ')+X.t)})});
  body.hidden=!open.has(c.id);
  const tog=()=>{open.has(c.id)?open.delete(c.id):open.add(c.id);body.hidden=!open.has(c.id);updHead(c);if(!body.hidden)setTimeout(()=>{const hb=(document.querySelector('header')||{offsetHeight:0}).offsetHeight+(document.querySelector('.toolbar,#toolbar,nav')||{offsetHeight:0}).offsetHeight;const r=body.getBoundingClientRect(),vh=window.innerHeight;if(r.bottom>vh){const want=Math.min(r.bottom-vh+16,h.getBoundingClientRect().top-hb-8);if(want>0)window.scrollBy({top:want,behavior:'smooth'})}},30)};
  reg({l:c.t,kw:c.t.split(/[ ,]+/).filter(x=>x.length>=4)},-1,()=>{tog();toast((open.has(c.id)?'Otvorené: ':'Zatvorené: ')+c.t)});
  list.append(h,body);updHead(c)});
 w.append(list);
 const b2=el('div','opts');
 const done=()=>{pushHist();
  const ch=cats.filter(c=>open.has(c.id)||cnt(c)>0);D.cats=ch.map(c=>c.id);
  const shown=new Set();ch.forEach(c=>c.items.forEach(f=>{if(dispOk(f,A))shown.add(f)}));
  shown.forEach(f=>{if(sel.has(f)){if(A[f]!==true){A[f]=true;addLog('f',F[f].t+': áno')}}else if(A[f]===undefined){A[f]=false;(D.soft=D.soft||{})[f]=true}});
  D.catsDone=true;D.mainDone=true;show('DX')};
 const d=optBtn({l:'Hotovo – pokračovať',ico:'➜'},-1,done);d.classList.add('primary');b2.append(d);
 const none=()=>{pushHist();D.cats=[];D.catsDone=true;D.mainDone=true;show('DX')};
 b2.append(optBtn({l:'Neviem / nič konkrétne',ico:'❓',cls:'ghost'},-1,none));
 CUR.push({kw:['hotovo','dalej','pokracovat'],i:-1,act:done});CUR.push({kw:['neviem','nic konkretne'],i:-1,act:none});
 w.append(b2);app.append(w);
}
function renderMain(){
 CURQ={say:'Čo pozoruješ? Označ všetko, čo platí, a potom povedz hotovo.'};
 const D=S.dx,A=D.A;
 const w=qWrap('🔎','Krok 5 · Príznaky','Čo pozoruješ?','Označ všetko, čo platí. Na ďalšie sa opýtam postupne.');
 const sel=new Set(KB.MAIN.filter(f=>A[f]===true));let i=0;const shown=[];
 KB.CATS.filter(c=>(D.cats||[]).includes(c.id)).forEach(c=>{
  const vis=c.items.filter(f=>!shown.includes(f)&&dispOk(f,A));
  if(!vis.length)return;
  w.append(el('div','grp',esc(c.ico+' '+c.t)));const box=el('div','opts grid2');
  vis.forEach(f=>{const X=F[f];const n=i++;shown.push(f);const b=optBtn({l:X.t,ico:X.ico},n,()=>tog());if(sel.has(f))b.classList.add('sel');
   const tog=()=>{sel.has(f)?sel.delete(f):sel.add(f);b.classList.toggle('sel',sel.has(f))};b.onclick=tog;box.append(b);
   reg({l:X.t,kw:[X.t.split(' ')[0]]},n,()=>{tog();toast((sel.has(f)?'Označené: ':'Odznačené: ')+X.t)})});
  w.append(box)});
 if([...sel].some(f=>shown.includes(f)))w.insertBefore(el('p','small','✓ Niektoré príznaky sú už označené podľa tvojich predchádzajúcich odpovedí. Ak neplatia, ťukni na ne a odznač ich.'),w.querySelector('.grp'));
 const done=()=>{pushHist();shown.forEach(f=>{if(sel.has(f)){if(A[f]!==true){A[f]=true;addLog('f',F[f].t+': áno')}}else if(A[f]===undefined){A[f]=false;(D.soft=D.soft||{})[f]=true}});D.mainDone=true;show('DX')};
 const box=el('div','opts');const d=optBtn({l:'Hotovo',ico:'➜'},-1,done);d.classList.add('primary');box.append(d);
 CUR.push({kw:['hotovo','dalej','nic z toho','pokracovat'],i:-1,act:done});
 w.append(box);app.append(w);
}

/* ---------- výsledok ---------- */
function getDoc(){try{return localStorage.getItem('mojLekar')||''}catch(e){return''}}
function setDoc(v){try{localStorage.setItem('mojLekar',v)}catch(e){}}
function docBox(){
 const d=el('div','card');d.append(el('h2','','👩‍⚕️ Môj lekár'));
 const inp=el('input');inp.type='tel';inp.placeholder='Telefón všeobecného lekára';inp.value=getDoc();
 inp.style.cssText='width:100%;font-size:18px;padding:10px 12px;border:1px solid #c5c9d0;border-radius:10px;margin:4px 0 8px';
 const call=el('a','opt danger','');call.target='_top';
 const upd=()=>{const n=inp.value.replace(/[^0-9+]/g,'');call.href='tel:'+n;call.style.display=n?'flex':'none';
  call.innerHTML=`<span class="ico">📞</span><span>Volať lekárovi</span><span class="num" style="color:#ffcdd2">${esc(inp.value)}</span>`};
 inp.oninput=()=>{setDoc(inp.value);upd()};
 call.onclick=()=>{const n=inp.value;if(!S.called['lekar']){S.called['lekar']=true;addLog('a','Volané lekárovi ('+n+')')}toast('Ak sa hovor nespustil, vytoč '+n+' ručne')};
 upd();d.append(inp,call);d.append(el('p','small','Číslo sa uloží v tomto zariadení. Mimo ordinačných hodín: pohotovosť (LSPP) alebo 155.'));return d;
}
function renderResult(){
 const {lv,R,sf}=verdict(),A=S.dx.A,L=KB.LEVEL[lv];
 const w=el('div');
 const c=el('div','result '+lv,`<div class="step" style="color:inherit;opacity:.85"><span class="big">${L.ico}</span><span>Výsledok</span></div><h1>${L.label}</h1>`);
 c.append(el('ul','list',L.advice.map(x=>`<li>${esc(gx(x))}</li>`).join('')));w.append(c);
 if(lv==='red'||lv==='orange'){const cb=el('div','opts');cb.append(callBtn('155'));w.append(cb);w.append(briefCard())}
 const why=sf.filter(r=>r.u==='red'||r.u==='orange');
 if(why.length)w.append(el('div','card',`<h2>Prečo</h2><ul class="list">${why.map(r=>`<li>${r.u==='red'?'🔴':'🟠'} ${esc(gx(r.why))}</li>`).join('')}</ul>`));
 if(S.dx.mainDone){
  const card=el('div','card');card.append(el('h2','','🔍 Možné príčiny'));
  card.append(el('p','small','Hrubý odhad podľa odpovedí – nie diagnóza.'));
  R.slice(0,3).forEach(({c,p},i)=>{
   const pct=Math.round(p*100),u=urgOf(c,A);
   const row=el('div','');row.style.margin='10px 0';
   row.innerHTML=`<div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(c.name)}</b><span style="white-space:nowrap">${pct} %</span></div>
    <div style="height:8px;background:#e8eaed;border-radius:4px;margin-top:4px"><div style="height:8px;width:${Math.max(pct,2)}%;border-radius:4px;background:${{red:'#c62828',orange:'#e65100',yellow:'#f9c623',green:'#2e7d32'}[u]}"></div></div>`;
   if(c.id!=='other'&&p>=.1){const r=reasons(c,A);
    if(r.pro.length)row.append(el('div','small','✔ Pre: '+esc(r.pro.slice(0,5).join(', '))));
    if(r.con.length)row.append(el('div','small','✖ Proti: '+esc(r.con.slice(0,4).join(', '))));}
   card.append(row)});
  w.append(card);
  const top=R[0];if(top.c.id!=='other'&&top.p>=.25&&top.c.aid.length)
   w.append(el('div','card',`<h2>🩹 Čo robiť pri: ${esc(top.c.name.toLowerCase())}</h2><ul class="list">${top.c.aid.map(x=>`<li>${esc(gx(x))}</li>`).join('')}</ul><p class="small">Zdroj: ${(top.c.src||[]).map(k=>KB.REFS[k]?esc(KB.REFS[k].t.split(' – ')[0]):'').filter(Boolean).join('; ')||'–'}</p>`));
 }
 const box=el('div','opts');
 if(lv==='orange'||lv==='yellow')w.append(docBox());
 const more=S.dx.mainDone&&(()=>{const D=S.dx;D.extra+=8;const x=pickNext();D.extra-=8;return!!x})();
 const acts=[
  {l:'Súhrn pre záchranku / lekára',ico:'📋',cls:'primary',run:showSummary,kw:['suhrn']},
  ...(more?[{l:'Ďalšie otázky (spresniť)',ico:'➕',run:()=>{pushHist();S.dx.extra+=8;show('DX')},kw:['dalsie','spresnit']}]:[]),
  ...(lv==='red'?[{l:'Prestal dýchať → resuscitácia',ico:'🫀',run:()=>choose(N.DXR,{flag:'cardiac',f:'Prestal dýchať',go:'CPR'}),kw:['prestal','nedycha']}]:[]),
  ...(S.dx.A.mvc===true?[{l:'Posúdiť ďalšieho zraneného',ico:'👥',run:()=>{if('speechSynthesis' in window)speechSynthesis.cancel();S=fresh();S.scen='Dopravná nehoda';S.dx.A.mvc=true;addLog('f','Dopravná nehoda – ďalší zranený');show('S1')},kw:['dalsieho','zraneneho']}]:[]),
  {l:'Nové posúdenie',ico:'⟲',cls:'ghost',run:restart,kw:['nove','znova']}];
 acts.forEach((o,i)=>{box.append(optBtn(o,i,o.run));reg(o,i,o.run)});
 w.append(box);app.append(w);
}

/* ---------- štart ---------- */
function renderStart(){
 const w=el('div');w.append(el('h1','','Sprievodca prvej pomoci'));
 w.append(el('p','q','Prevediem ťa krok za krokom: zistíme, v akom je stave, čo treba urobiť hneď a či volať 155.'));
 const box=el('div','opts');
 const act=()=>{speak('');choose(N.START,{go:'S1'})};
 box.append(optBtn({l:'Začať',ico:'▶',cls:'primary'},0,act));reg({l:'zacat',kw:['zacat','start','zacni']},0,act);
 box.append(callBtn('155'));w.append(box);
 w.append(el('div','card',`<h2>Ako to funguje</h2><ul class="list small">
  <li>Najprv overí to najdôležitejšie: vedomie, dýchanie, bezprostredné ohrozenie.</li>
  <li>Potom sa opýta, kto to je (vek, pohlavie), kedy to začalo, kde je hlavný problém a čo pozoruješ – podobne ako triáž na urgentnom príjme.</li>
  <li>Ďalej kladie otázky, ktoré najlepšie rozlíšia možné príčiny – každá odpoveď prepočíta pravdepodobnosti.</li>
  <li>Pri vážnom zistení hneď ukáže, čo robiť, a tlačidlo na 155. Otázky môžeš dokončiť počas čakania.</li>
  <li>Na konci: odporúčanie, možné príčiny a <b>súhrn pre záchranku / lekára</b>.</li></ul>
  <p class="small">Databáza: ${KB.COND.length-1} stavov, ${Object.keys(KB.FIND).length} príznakov, ${KB.SAFETY.length} bezpečnostných pravidiel.</p>
  <p class="small"><span class="tag">PROTOTYP ${esc(KB.version)}</span>Nie je to zdravotnícka pomôcka ani diagnóza a obsah zatiaľ neskontroloval lekár. Pri akejkoľvek pochybnosti volaj <b>155</b>.</p>`));
 const rc=el('div','card');rc.append(el('h2','','📚 Zdroje'));
 const ul=el('ul','list small');Object.values(KB.REFS).forEach(r=>{const li=el('li','');li.innerHTML=r.u?`<a href="${esc(r.u)}" target="_blank" rel="noopener">${esc(r.t)}</a>`:esc(r.t);ul.append(li)});
 rc.append(ul);w.append(rc);
 app.append(w);
}

/* ---------- resuscitácia ---------- */
let ac=null;
function renderCPR(){
 if(!S.cprStart){S.cprStart=Date.now();addLog('a','Začatá resuscitácia (stláčanie hrudníka)')}
 const w=el('div','alert');
 w.append(el('div','step','<span class="big">🫀</span><span>Zástava – resuscitácia</span>'));
 w.append(el('h1','','Stláčaj hrudník'));
 w.append(el('ol','list',`<li><b>Volaj 155</b> na hlasitý odposluch – operátor ťa povedie.</li>
  <li>Ak je niekto pri tebe, pošli ho po <b>defibrilátor (AED)</b>.</li>
  <li>Dlane na stred hrudníka, ruky vystreté. Stláčaj <b>5–6 cm hlboko, 100–120× za minútu</b>.</li>
  <li>Vdychy len ak ich vieš (30 stlačení : 2 vdychy). Inak len stláčaj bez prestávky.</li>
  <li>Nezastavuj, kým nepríde záchranka, AED alebo kým nezačne normálne dýchať.</li>`));
 const box=el('div','opts');box.append(callBtn('155'));w.append(box);
 const pulse=el('div','pulse','<span id="cnt">0</span><small>stlačení</small>');
 const info=el('p','center small','Čas KPR: <b id="el">0:00</b>');
 const mb=el('button','opt primary','<span class="ico">▶</span><span>Spustiť metronóm (110/min)</span>');
 let n=0,beat=null;
 const tick=()=>{n++;const c=$('#cnt');if(c)c.textContent=n;pulse.classList.add('beat');setTimeout(()=>pulse.classList.remove('beat'),90);
  if(ac){const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=n%30===0?1320:880;
   g.gain.setValueAtTime(.35,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.07);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+.08)}};
 const toggle=()=>{
  if(beat){clearInterval(beat);timers=timers.filter(t=>t!==beat);beat=null;mb.innerHTML='<span class="ico">▶</span><span>Spustiť metronóm (110/min)</span>';return}
  try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();ac.resume()}catch(e){ac=null}
  if(speaking)speechSynthesis.cancel();
  beat=setInterval(tick,545);timers.push(beat);tick();mb.innerHTML='<span class="ico">⏸</span><span>Zastaviť metronóm</span>'};
 mb.onclick=toggle;CUR.push({kw:['metronom','spusti','start','zastav'],i:-1,act:toggle});
 const et=setInterval(()=>{const s=Math.floor((Date.now()-S.cprStart)/1000);const e=$('#el');if(e)e.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')},1000);timers.push(et);
 w.append(pulse,info);const b2=el('div','opts');b2.append(mb);
 const node={};
 [{l:'Začal normálne dýchať',ico:'🌬️',a:'Obnovené dýchanie – KPR ukončená',go:S=>{S.after='DX';S.dx.mode='obs';return'AL_unc'},kw:['dycha','zacal']},
  {l:'Priniesli AED – zapínam ho',ico:'⚡',a:'Priniesli AED, postup podľa jeho pokynov',go:'CPR',kw:['aed','defibrilator','priniesli']},
  {l:'Záchranka prevzala',ico:'🚑',a:'Záchranka prevzala pacienta',go:'DXR',kw:['zachranka','prevzala','prisli']}]
  .forEach((o,i)=>{const act=()=>choose(node,o);b2.append(optBtn(o,i,act));reg(o,i,act)});
 w.append(b2);app.append(w);
}

/* ---------- súhrn ---------- */
function showSummary(){
 stopScreen();OVER='sum';save();app.innerHTML='';CUR=[];window.scrollTo(0,0);
 const w=el('div');
 w.append(el('div','step','<span class="big">📋</span><span>Súhrn</span>'));
 w.append(el('h1','','Súhrn pre záchranku / lekára'));
 w.append(briefCard());w.append(el('h2','','Celý súhrn'));
 const pre=el('pre','sum');
 pre.textContent=summaryText();w.append(pre);
 const box=el('div','opts');
 [{l:'Kopírovať text',ico:'📄',cls:'primary',run:()=>copyText(summaryText()),kw:['kopirovat']},
  {l:'Prečítať nahlas (napr. operátorovi)',ico:'🔊',run:()=>{const o=ttsOn;ttsOn=true;speak(summaryText().replace(/•|!/g,''));ttsOn=o},kw:['precitat','citaj']},
  {l:'Späť',ico:'←',cls:'ghost',run:()=>show(S.node),kw:['spat','naspat']}]
  .forEach((o,i)=>{box.append(optBtn(o,i,o.run));reg(o,i,o.run)});
 w.append(box);app.append(w);
}
function restart(){try{localStorage.removeItem('pp_state')}catch(e){}if('speechSynthesis' in window)speechSynthesis.cancel();S=fresh();show('START')}

/* ---------- toolbar ---------- */
$('#bBack').onclick=back;$('#bNew').onclick=restart;$('#bSum').onclick=showSummary;
$('#bTts').onclick=()=>{ttsOn=!ttsOn;$('#bTts').classList.toggle('on',ttsOn);$('#bTts').textContent=ttsOn?'🔊 Hlas':'🔇 Hlas';if(!ttsOn&&'speechSynthesis' in window)speechSynthesis.cancel();else speakNode()};
$('#bMic').onclick=()=>{
 if(!SR){toast('Tento prehliadač nevie rozpoznávať reč. Skús Chrome na Androide.');return}
 if(listening&&recActive){listening=false;pauseRec();updMic();toast('Hlasové odpovede vypnuté');return}
 if(!listening){listening=true;toast('Po každej otázke budem chvíľu počúvať. Ak nestihneš, ťukni na 🎤.')}
 if('speechSynthesis' in window&&speaking){speechSynthesis.cancel();speaking=false}
 recTries=0;startRec();updMic();
};
document.querySelectorAll('[data-call]').forEach(a=>a.addEventListener('click',()=>{logCall(a.dataset.call);toast('Ak sa hovor nespustil, vytoč '+a.dataset.call+' ručne')}));
if(!restore())show('START');
try{if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>r.update())}catch(e){}
