(function(){
'use strict';
const HN=52.5,FIM='01:18',CARGA=528;
let calcAnterior=null,renderAnterior=null,resumoAnterior=null;
function $(id){return document.getElementById(id)}
function init(){
  if(typeof calcularDia!=='function'||typeof registros==='undefined'||typeof config==='undefined'){setTimeout(init,150);return}
  config.saidaFinal=FIM;config.cargaDiaria='08:48';config.inicioNoturno='22:00';config.fimNoturno='05:00';config.percentualEx60=60;config.adicionalNoturnoPercentual=50;
  try{localStorage.setItem('app_ponto_pessoal_config_v9',JSON.stringify(config))}catch(e){}
  const p=document.querySelector('.escala p');if(p)p.innerHTML='Segunda a sexta: <b>15:30 às 01:18 +1</b><br>Descanso padrão: <b>19:00 às 20:00</b><br>Carga oficial: <b>08h48</b><br>HE em dia útil: <b>após 01:18</b><br>Adicional noturno: <b>50% das 22:00 às 05:00</b>';
  calcAnterior=calcularDia;window.calcularDia=calcularFinal;
  if(typeof renderizar==='function'){renderAnterior=renderizar;window.renderizar=function(h){const x=renderAnterior(h);atualHoje();setTimeout(atualResumo,30);return x}}
  if(typeof renderizarResumoMensal==='function'){resumoAnterior=renderizarResumoMensal;window.renderizarResumoMensal=function(){const x=resumoAnterior();atualResumo();return x}}
  document.addEventListener('click',()=>setTimeout(function(){atualResumo();atualHoje();},520));
  const mes=$('mesResumo');if(mes)mes.addEventListener('change',()=>setTimeout(atualResumo,520));
  window.gerarHoleriteRefinado=holeriteFinal;
  const bh=$('btnHolerite');if(bh&&!bh.dataset.rhFinalV2){bh.dataset.rhFinalV2='1';bh.addEventListener('click',()=>setTimeout(holeriteFinal,650))}
  setTimeout(function(){atualHoje();atualResumo()},100);
}
function calcularFinal(r){
  const base=calcAnterior(r);if(!r)return base;
  const ints=intervalos(r),trab=ints.reduce((s,i)=>s+dif(i.inicio,i.fim),0),desc=r.saidaDescanso&&r.voltaDescanso?dif(new Date(r.saidaDescanso),new Date(r.voltaDescanso)):0;
  if(r.rhTotais&&r.origemRegistro==='espelho-rh-julho-2026')return oficial(base,r,trab,desc);
  const tipo=r.tipoDia||'normal';
  if((tipo==='atestado'||tipo==='abonado')&&trab===0)return base;
  if(tipo==='folga'&&trab===0)return finalizar(base,{trabalhadoPonto:0,ajusteRH:0,totalConsiderado:0,descanso:0,saldo:0,ex60:0,en60:0,ex100:0,en100:0,noturno:0});
  if(!r.saidaFinal&&tipo==='normal'&&!r.dia100&&!fimSemana(r.data))return Object.assign({},base,{en60:0,en100:0,valorEn60:0,valorEn100:0});
  const cem=!!r.dia100||fimSemana(r.data)||tipo==='feriado'||(tipo==='folga'&&trab>0);
  return cem?calc100(base,r,ints,trab,desc):calcUtil(base,r,ints,trab,desc);
}
function oficial(base,r,trab,desc){
  const q=r.rhTotais||{},norm=num(q.normais,0),ex60=num(q.ex60,0),en60=num(q.en60,0),ex100=num(q.ex100,0),en100=num(q.en100,0),noturno=num(q.noturno,0);
  return finalizar(base,{trabalhadoPonto:trab,ajusteRH:norm?Math.max(0,CARGA-trab):0,totalConsiderado:norm+ex60+en60+ex100+en100,descanso:desc,saldo:ex60+en60+ex100+en100,ex60,en60,ex100,en100,noturno,normaisRH:norm});
}
function calcUtil(base,r,ints,trab,desc){
  const lim=fimJornada(r.data);let extraN=0,extraD=0;
  ints.forEach(i=>{if(i.fim<=lim)return;const a=new Date(Math.max(i.inicio.getTime(),lim.getTime())),dur=dif(a,i.fim),n=noiteReal(a,i.fim);extraN+=n;extraD+=Math.max(0,dur-n)});
  const en60=extraN>0?extraN+1:0,ex60=extraD,totalNoite=ints.reduce((s,i)=>s+noiteReal(i.inicio,i.fim),0),noturno=Math.max(0,creditoNoturno(totalNoite)-extraN);
  return finalizar(base,{trabalhadoPonto:trab,ajusteRH:Math.max(0,CARGA-trab),totalConsiderado:CARGA+ex60+en60,descanso:desc,saldo:ex60+en60,ex60,en60,ex100:0,en100:0,noturno});
}
function calc100(base,r,ints,trab,desc){
  const noite=ints.reduce((s,i)=>s+noiteReal(i.inicio,i.fim),0),en100=creditoNoturno(noite),dia=Math.max(0,trab-noite),intervalo=r.saidaDescanso&&r.voltaDescanso?Math.min(60,desc):0,ex100=dia+intervalo;
  return finalizar(base,{trabalhadoPonto:trab,ajusteRH:0,totalConsiderado:ex100+en100,descanso:desc,saldo:ex100+en100,ex60:0,en60:0,ex100,en100,noturno:0});
}
function finalizar(base,c){
  const sal=num(config.salarioBase,0),div=num(config.divisorMensal,220),per=sal*num(config.periculosidadePercentual,0)/100,vh=config.valorHora?num(config.valorHora,0):sal/div,vhp=config.valorHora?num(config.valorHora,0):(sal+per)/div,p60=num(config.percentualEx60,60),pn=num(config.adicionalNoturnoPercentual,50);
  c.valorEx60=ref(c.ex60)*vhp*(1+p60/100);c.valorEn60=ref(c.en60)*vhp*2;c.valorEx100=ref(c.ex100)*vhp*2;c.valorEn100=ref(c.en100)*vhp*2;c.valorNoturno=ref(c.noturno)*vh*(pn/100);return Object.assign({},base,c);
}
function fimJornada(data){const d=new Date(data+'T'+FIM+':00');d.setDate(d.getDate()+1);return d}
function noiteReal(a,b){const ini=min(config.inicioNoturno||'22:00'),fim=min(config.fimNoturno||'05:00');let t=0,base=new Date(a);base.setHours(0,0,0,0);base.setDate(base.getDate()-1);for(let i=0;i<4;i++){const d=new Date(base);d.setDate(d.getDate()+i);const x=new Date(d);x.setHours(Math.floor(ini/60),ini%60,0,0);const y=new Date(d);if(fim<=ini)y.setDate(y.getDate()+1);y.setHours(Math.floor(fim/60),fim%60,0,0);const p=Math.max(a.getTime(),x.getTime()),q=Math.min(b.getTime(),y.getTime());if(q>p)t+=Math.round((q-p)/60000)}return t}
function creditoNoturno(m){m=Math.max(0,Math.round(m||0));return m?Math.ceil(m*60/HN):0}
function intervalos(r){const a=[];if(!r||!r.entrada)return a;if(r.saidaDescanso){a.push({inicio:new Date(r.entrada),fim:new Date(r.saidaDescanso)});if(r.voltaDescanso&&r.saidaFinal)a.push({inicio:new Date(r.voltaDescanso),fim:new Date(r.saidaFinal)})}else if(r.saidaFinal)a.push({inicio:new Date(r.entrada),fim:new Date(r.saidaFinal)});return a.filter(i=>i.fim>i.inicio)}
function atualHoje(){if(typeof registroAtual!=='function')return;const c=calcularFinal(registroAtual());set('ex60',hora(c.ex60));set('en60',hora(c.en60));set('ex100',hora(c.ex100));set('en100',hora(c.en100));set('adNoturno',hora(c.noturno));set('valorEx60',moeda(c.valorEx60));set('valorEn60',moeda(c.valorEn60));set('valorEx100',moeda(c.valorEx100));set('valorEn100',moeda(c.valorEn100));set('valorNoturno',moeda(c.valorNoturno))}
function resumo(mes){const t={ex60:0,en60:0,ex100:0,en100:0,noturno:0,normais:0};datasMes(mes).forEach(d=>{const r=registros[d];if(!r)return;const c=calcularFinal(r);t.ex60+=c.ex60||0;t.en60+=c.en60||0;t.ex100+=c.ex100||0;t.en100+=c.en100||0;t.noturno+=c.noturno||0;t.normais+=c.normaisRH||0});return t}
function atualResumo(){if(!$('mesResumo'))return;const mes=$('mesResumo').value||mesAtual(),t=resumo(mes),b=banco(mes);set('mesEx60',horaL(t.ex60));set('mesEn60',horaL(t.en60));set('mesEx100',horaL(t.ex100));set('mesEn100',horaL(t.en100));set('mesNoturno',horaL(t.noturno));set('mesFolgasGanhas',b.ganhas);set('mesFolgasUsadas',b.usadas);set('mesFolgas',b.saldo)}
function banco(mes){const fim=ultimo(mes),ds=Object.keys(registros).filter(d=>d<=fim).sort();if(!ds.length)return{ganhas:0,usadas:0,saldo:0};let s=sabado(ds[0]),g=0,u=0;while(s<=fim){const d=add(s,1);if(d<=fim&&trabalhou(s)&&trabalhou(d))g++;s=add(s,7)}ds.forEach(d=>{if(registros[d]&&registros[d].folgaUtilizada)u++});return{ganhas:g,usadas:u,saldo:g-u}}
function holeriteFinal(){const alvo=$('holeritePessoal');if(!alvo)return;const mes=($('mesResumo')&&$('mesResumo').value)||mesAtual(),t=resumo(mes),sal=num(config.salarioBase,0),div=num(config.divisorMensal,220),pp=num(config.periculosidadePercentual,30),pn=num(config.adicionalNoturnoPercentual,50),p60=num(config.percentualEx60,60),per=sal*pp/100,vh=sal/div,vhp=(sal+per)/div,v60=ref(t.ex60)*vhp*(1+p60/100),vn60=ref(t.en60)*vhp*2,v100=ref(t.ex100)*vhp*2,vn100=ref(t.en100)*vhp*2,vn=ref(t.noturno)*vh*pn/100,varr=v60+vn60+v100+vn100+vn,f=dsr(mes),vdsr=varr*f,bruto=sal+per+varr+vdsr;alvo.classList.add('ativo');alvo.innerHTML='<h3>Holerite pessoal RH</h3><p class="aviso">Prévia de '+nomeMes(mes)+'. Referências no padrão HH,MM do holerite.</p><div class="hlinha head"><span>Provento</span><span>Ref.</span><b>Valor</b></div>'+linha('Salário base','Mensal',sal)+linha('Periculosidade '+pp+'%',pp+'%',per)+linha('Horas extras '+p60+'%',refTxt(t.ex60),v60)+linha('Horas extras noturna '+p60+'%',refTxt(t.en60),vn60)+linha('Horas extras 100%',refTxt(t.ex100),v100)+linha('Horas extras noturna 100%',refTxt(t.en100),vn100)+linha('Adicional noturno '+pn+'%',refTxt(t.noturno),vn)+linha('Reflexo DSR estimado',(f*100).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%',vdsr)+'<div class="hlinha head"><span>Total vencimentos estimado</span><span></span><b>'+moeda(bruto)+'</b></div><p class="aviso">Julho/2026 usa os totais oficiais importados do espelho.</p>'}
function trabalhou(d){const r=registros[d];return !!(r&&intervalos(r).reduce((s,i)=>s+dif(i.inicio,i.fim),0)>0)}function fimSemana(d){const x=new Date(d+'T12:00:00').getDay();return x===0||x===6}function sabado(d){const x=new Date(d+'T12:00:00');while(x.getDay()!==6)x.setDate(x.getDate()-1);return dataISO(x)}function ultimo(m){const p=m.split('-').map(Number);return dataISO(new Date(p[0],p[1],0,12))}function add(d,n){const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return dataISO(x)}function dataISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}function datasMes(m){const p=m.split('-').map(Number),u=new Date(p[0],p[1],0).getDate(),a=[];for(let d=1;d<=u;d++)a.push(p[0]+'-'+String(p[1]).padStart(2,'0')+'-'+String(d).padStart(2,'0'));return a}function dsr(m){const a=datasMes(m),dom=a.filter(d=>new Date(d+'T12:00:00').getDay()===0).length;return dom/Math.max(1,a.length-dom)}function mesAtual(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}function dif(a,b){return Math.max(0,Math.round((b-a)/60000))}function min(h){const p=String(h||'00:00').split(':').map(Number);return p[0]*60+p[1]}function num(v,p){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:p}function ref(m){m=Math.max(0,Math.round(m||0));return Number(Math.floor(m/60)+'.'+String(m%60).padStart(2,'0'))}function refTxt(m){return ref(m).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}function hora(m){m=Math.max(0,Math.round(m||0));return String(Math.floor(m/60)).padStart(2,'0')+'h'+String(m%60).padStart(2,'0')}function horaL(m){m=Math.max(0,Math.round(m||0));return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}function moeda(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}function set(id,v){const n=$(id);if(n)n.textContent=v}function nomeMes(m){const n=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'],p=m.split('-');return n[Number(p[1])-1]+' de '+p[0]}function linha(n,r,v){return '<div class="hlinha"><span>'+n+'</span><span>'+r+'</span><b>'+moeda(v)+'</b></div>'}
window.resumoMesRHFinal=resumo;window.calcularBancoFolgasRHFinal=banco;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,80));else setTimeout(init,80);
})();