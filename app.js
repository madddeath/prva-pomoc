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
let toastT;function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('show'),3200)}

/* ---------- state ---------- */
function fresh(){return{node:'START',f:{},log:[],alerts:[],hist:[],scen:'',onset:false,onsetH:null,onsetTxt:'',called:{},
 patient:{sex:''},after:null,cprStart:null,dx:{A:{},asked:[],n:0,mainDone:false,mode:'talk',extra:0}}}
let S=fresh();
let CUR=[],timers=[],CURQ=null;
function addLog(k,txt){S.log.push({k,t:tm(),txt})}
function logCall(num){if(!S.called[num]){S.called[num]=true;addLog('a','Volané '+num)}}
function snap(){const {hist,...rest}=S;return JSON.stringify(rest)}
function pushHist(){S.hist.push(snap())}
function back(){if(!S.hist.length){toast('Si na začiatku');return}const h=S.hist;const st=JSON.parse(h.pop());S={...st,hist:h};show(S.node)}

/* =====================================================================
   OBSAH TOKU (primárne vyšetrenie zostáva pevný protokol)
   ===================================================================== */
const onsetOpts=next=>[
 {l:'Pred chvíľou (do 1 hodiny)',ico:'⏱️',h:1,kw:['chvilou','chvilu','do hodiny']},
 {l:'Pred 1 – 4 hodinami',ico:'🕐',h:4,kw:['jednu az styri','par hodin']},
 {l:'Pred 4 – 24 hodinami',ico:'🕓',h:24,kw:['dnes','rano','vcera']},
 {l:'Dlhšie, zhoršuje sa postupne',ico:'📅',h:99,kw:['dlhsie','postupne','dni']},
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
 q:'Volaj 155 (hlasitý odposluch). Predkloň ho a daj 5 silných úderov dlaňou medzi lopatky. Ak to nepomôže, postav sa za neho, päsť nad pupok, druhou rukou ju chyť a 5× prudko zatlač dovnútra a hore. Striedaj 5 úderov a 5 stlačení. Ak stratí vedomie → resuscitácia.',
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
  {l:'Nič z toho',ico:'➜',cls:'primary',go:'DX',kw:['nic','nie','dalej']}]},
ONSET:{step:'Začiatok ťažkostí',ico:'🕐',t:'Kedy bol naposledy úplne v poriadku?',q:'Pri mozgovej príhode a úrazoch je tento čas pre lekárov veľmi dôležitý.',opts:onsetOpts('DX')},
DX:{type:'dx'},
DXR:{type:'dxr'}
};
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
 const sx=S.dx.A.sex&&S.dx.A.sex!=='?'?V.sex.vals.find(x=>x[0]===S.dx.A.sex)[1]:'';
 const p=[sx,age].filter(Boolean).join(', ');if(p)s+=`Pacient: ${p}\n`;
 const vit=[S.dx.A.bp&&S.dx.A.bp!=='?'?'TK '+V.bp.vals.find(x=>x[0]===S.dx.A.bp)[1]:'',S.dx.A.pulse&&S.dx.A.pulse!=='?'?'pulz '+V.pulse.vals.find(x=>x[0]===S.dx.A.pulse)[1]:'',S.dx.A.glu&&S.dx.A.glu!=='?'?'glykémia '+V.glu.vals.find(x=>x[0]===S.dx.A.glu)[1]:''].filter(Boolean).join(', ');if(vit)s+=`Namerané: ${vit}\n`;
 if(S.onsetTxt)s+=`Naposledy v poriadku: ${S.onsetTxt.toLowerCase()}\n`;
 const Fd=S.log.filter(x=>x.k==='f'),Ad=S.log.filter(x=>x.k==='a');
 const yes=Fd.filter(x=>!/: nie$|: nevie$/.test(x.txt)),no=Fd.filter(x=>/: nie$/.test(x.txt));
 s+='\nZISTENÉ:\n'+(yes.length?yes.map(x=>`• ${x.t}  ${x.txt.replace(/: áno$/,'')}`).join('\n'):'• –');
 if(no.length)s+='\n\nNEPRÍTOMNÉ: '+no.map(x=>x.txt.replace(/: nie$/,'').toLowerCase()).join(', ');
 s+='\n\nVYKONANÉ:\n'+(Ad.length?Ad.map(x=>`• ${x.t}  ${x.txt}`).join('\n'):'• –');
 s+=`\n\nVÝSLEDOK SPRIEVODCU: ${KB.LEVEL[lv].label}`;
 const why=sf.filter(r=>r.u!=='green').map(r=>r.why);if(why.length)s+='\n'+why.map(x=>'! '+x).join('\n');
 if(S.dx.mainDone){s+='\n\nMOŽNÉ PRÍČINY (laický odhad, nie diagnóza):\n'+R.slice(0,3).map(({c,p})=>`• ${c.name} – ${Math.round(p*100)} %`).join('\n')}
 s+='\n\n(Laické posúdenie, nie diagnóza.)';
 return s;
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
function speak(t){
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
 stopScreen();S.node=id;const n=N[id];recTries=0;pauseRec();
 app.innerHTML='';CUR=[];CURQ=null;window.scrollTo(0,0);
 ({start:renderStart,cpr:renderCPR,dx:renderDX,dxr:renderResult}[n.type]||renderQ)(n);
 if(S.node!==id)return; // počas renderu sa presmerovalo (napr. na upozornenie)
 if(n.type!=='start')speakNode();else if(listening)startRec();
}
function optBtn(o,i,onClick){const b=el('button','opt '+(o.cls||''),`<span class="ico">${o.ico||''}</span><span>${esc(o.l)}</span>${i>=0?`<span class="num">${i+1}</span>`:''}`);b.onclick=onClick;return b}
function callBtn(num,label){
 const a=el('a','opt danger',`<span class="ico">📞</span><span>Volať ${esc(label||num)}</span>`);
 a.href='tel:'+num;a.target='_top';
 a.onclick=()=>{logCall(label||num);toast('Ak sa hovor nespustil, vytoč '+(label||num)+' ručne')};
 CUR.push({kw:['volat','zavolaj','zavolat'],i:-1,act:()=>{logCall(label||num);toast('Vytoč '+(label||num))}});
 return a;
}
function head(n,w){
 w.append(el('div','step',`<span class="big">${n.ico||''}</span><span>${esc(n.step||'')}</span>`));
 w.append(el('h1','',esc(n.t)));
 if(n.q)w.append(el('p','q',esc(n.q)));
 if(n.hint)w.append(el('div','hint','💡 '+esc(n.hint)));
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
 pushHist();const D=S.dx;D.A[id]=val;D.asked.push(id);if(D.soft)delete D.soft[id];if(D.mainDone&&id!=='age')D.n++;
 addLog('f',label);show('DX');
}
function hypLine(){
 const R=ranked(S.dx.A);const t=R[0];if(!S.dx.mainDone||t.c.id==='other'||t.p<.25)return null;
 return el('p','small',`Zatiaľ najviac sedí: <b>${esc(t.c.name)}</b> (${Math.round(t.p*100)} %)`);
}
function renderDX(){
 const D=S.dx,A=D.A;
 for(const r of safety(A))if(r.alert&&!S.alerts.includes(r.alert)){S.alerts.push(r.alert);S.after='DX';show('AL_'+r.alert);return}
 if(A.age===undefined)return renderVar('age');
 if(A.sex===undefined)return renderVar('sex');
 if(!S.onset){S.onset=true;show('ONSET');return}
 if(!D.mainDone)return renderMain();
 const nx=pickNext();if(!nx){show('DXR');return}
 nx.kind==='var'?renderVar(nx.id):renderBool(nx.id);
}
function qWrap(ico,step,title,hint){
 const w=el('div');w.append(el('div','step',`<span class="big">${ico}</span><span>${esc(step)}</span>`));
 w.append(el('h1','',esc(title)));if(hint)w.append(el('div','hint','💡 '+esc(hint)));
 const hl=hypLine();if(hl)w.append(hl);return w;
}
function finishBtn(box){
 if(!S.dx.mainDone)return;
 const o={l:'Vyhodnotiť teraz',ico:'🏁',cls:'ghost'};const act=()=>{pushHist();show('DXR')};
 box.append(optBtn(o,-1,act));CUR.push({kw:['vyhodnotit','vyhodnot','koniec'],i:-1,act});
}
function renderBool(f){
 const X=F[f];CURQ={say:X.ask};
 const w=qWrap(X.ico,`Otázka ${S.dx.n+1}`+(S.dx.mode==='obs'?' · pozoruj':''),X.ask,X.hint);
 const box=el('div','opts');
 [{l:'Áno',ico:'✅',v:true,kw:['ano','hej','jo','ma','mal','je']},{l:'Nie',ico:'❌',v:false,kw:['nie','nema','nemal','neni']},{l:'Neviem',ico:'❓',v:'?',kw:['neviem','nevie','netusim']}]
  .forEach((o,i)=>{const act=()=>{if(o.v==='?'){pushHist();S.dx.asked.push(f);S.dx.n++;if(S.dx.soft&&S.dx.soft[f]){delete S.dx.soft[f];delete S.dx.A[f]}addLog('f',X.t+': nevie');show('DX')}else answer(f,o.v,X.t+': '+(o.v?'áno':'nie'))};
   box.append(optBtn(o,i,act));reg(o,i,act)});
 finishBtn(box);w.append(box);app.append(w);
 if(listening)CURQ.say+='. Áno, nie, alebo neviem?';
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
function renderMain(){
 CURQ={say:'Čo pozoruješ? Označ všetko, čo platí, a potom povedz hotovo.'};
 const A=S.dx.A;
 const w=qWrap('🔎','Krok 4 · Príznaky','Čo pozoruješ?','Označ všetko, čo platí. Čo neoznačíš, beriem, že to nemá – na dôležité sa ešte opýtam.');
 const sel=new Set(KB.MAIN.filter(f=>A[f]===true));let i=0;const shown=[];
 KB.MAIN_GROUPS.forEach(([title,items])=>{
  const vis=items.filter(f=>{const X=F[f];if(S.dx.mode==='obs'&&!X.obs)return false;try{return !X.req||X.req(A)||A[f]===true}catch(e){return true}});
  if(!vis.length)return;
  w.append(el('div','grp',esc(title)));const box=el('div','opts grid2');
  vis.forEach(f=>{const X=F[f];const n=i++;shown.push(f);const b=optBtn({l:X.t,ico:X.ico},n,()=>tog());if(sel.has(f))b.classList.add('sel');
   const tog=()=>{sel.has(f)?sel.delete(f):sel.add(f);b.classList.toggle('sel',sel.has(f))};b.onclick=tog;box.append(b);
   reg({l:X.t,kw:[X.t.split(' ')[0]]},n,()=>{tog();toast((sel.has(f)?'Označené: ':'Odznačené: ')+X.t)})});
  w.append(box)});
 const done=()=>{pushHist();shown.forEach(f=>{if(sel.has(f)){if(A[f]!==true){A[f]=true;addLog('f',F[f].t+': áno')}}else if(A[f]===undefined){A[f]=false;(S.dx.soft=S.dx.soft||{})[f]=true}});S.dx.mainDone=true;show('DX')};
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
 c.append(el('ul','list',L.advice.map(x=>`<li>${esc(x)}</li>`).join('')));w.append(c);
 const why=sf.filter(r=>r.u==='red'||r.u==='orange');
 if(why.length)w.append(el('div','card',`<h2>Prečo</h2><ul class="list">${why.map(r=>`<li>${r.u==='red'?'🔴':'🟠'} ${esc(r.why)}</li>`).join('')}</ul>`));
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
   w.append(el('div','card',`<h2>🩹 Čo robiť pri: ${esc(top.c.name.toLowerCase())}</h2><ul class="list">${top.c.aid.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="small">Zdroj: ${(top.c.src||[]).map(k=>KB.REFS[k]?esc(KB.REFS[k].t.split(' – ')[0]):'').filter(Boolean).join('; ')||'–'}</p>`));
 }
 const box=el('div','opts');
 if(lv==='red'||lv==='orange')box.append(callBtn('155'));
 if(lv==='orange'||lv==='yellow')w.append(docBox());
 const more=S.dx.mainDone&&(()=>{const D=S.dx;D.extra+=8;const x=pickNext();D.extra-=8;return!!x})();
 const acts=[
  {l:'Súhrn pre záchranku / lekára',ico:'📋',cls:'primary',run:showSummary,kw:['suhrn']},
  ...(more?[{l:'Ďalšie otázky (spresniť)',ico:'➕',run:()=>{pushHist();S.dx.extra+=8;show('DX')},kw:['dalsie','spresnit']}]:[]),
  ...(lv==='red'?[{l:'Prestal dýchať → resuscitácia',ico:'🫀',run:()=>choose(N.DXR,{flag:'cardiac',f:'Prestal dýchať',go:'CPR'}),kw:['prestal','nedycha']}]:[]),
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
  <li>Potom sa opýta, kto to je (vek, pohlavie), kedy to začalo a čo pozoruješ.</li>
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
 stopScreen();app.innerHTML='';CUR=[];window.scrollTo(0,0);
 const w=el('div');
 w.append(el('div','step','<span class="big">📋</span><span>Súhrn</span>'));
 w.append(el('h1','','Súhrn pre záchranku / lekára'));
 const pre=el('pre','sum');
 pre.textContent=summaryText();w.append(pre);
 const box=el('div','opts');
 [{l:'Kopírovať text',ico:'📄',cls:'primary',run:()=>copyText(summaryText()),kw:['kopirovat']},
  {l:'Prečítať nahlas (napr. operátorovi)',ico:'🔊',run:()=>{const o=ttsOn;ttsOn=true;speak(summaryText().replace(/•|!/g,''));ttsOn=o},kw:['precitat','citaj']},
  {l:'Späť',ico:'←',cls:'ghost',run:()=>show(S.node),kw:['spat','naspat']}]
  .forEach((o,i)=>{box.append(optBtn(o,i,o.run));reg(o,i,o.run)});
 w.append(box);app.append(w);
}
function restart(){if('speechSynthesis' in window)speechSynthesis.cancel();S=fresh();show('START')}

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
show('START');
try{if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>r.update())}catch(e){}
