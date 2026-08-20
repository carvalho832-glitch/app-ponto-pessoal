(function(){
'use strict';
function $(id){return document.getElementById(id)}
function init(){
  if(!$('telaMes')){setTimeout(init,200);return}
  injectStyle();
  ensureTools();
  bindNav();
}
function injectStyle(){
  if($('monthToolsStyle'))return;
  const s=document.createElement('style');
  s.id='monthToolsStyle';
  s.textContent=`
    #monthToolsBox{margin-top:14px}
    #monthToolsBox h3{margin-bottom:5px}
    .month-tools-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
    .month-tools-grid button{width:100%}
    #btnFolhaPontoFix{grid-column:1/-1}
    #graficoMensalFix{display:none;width:100%;height:230px;background:#101827;border:1px solid #25314b;border-radius:18px;margin-top:12px}
    #monthToolsNote{color:#91a2c3;font-size:12px;line-height:1.45;margin:10px 0 0}
    @media(max-width:390px){.month-tools-grid{grid-template-columns:1fr}.month-tools-grid button,#btnFolhaPontoFix{grid-column:auto}}
    @media print{#monthToolsBox{display:none!important}}
  `;
  document.head.appendChild(s);
}
function ensureTools(){
  const tela=$('telaMes');
  if(!tela)return;
  let box=$('monthToolsBox');
  if(!box){
    box=document.createElement('section');
    box.id='monthToolsBox';
    box.className='box';
    box.innerHTML=`
      <h3>Ferramentas do mês</h3>
      <p class="aviso">Gere o holerite, a folha de ponto e visualize o gráfico do mês selecionado.</p>
      <div class="month-tools-grid">
        <button id="btnHoleriteFix" class="ok">Gerar holerite</button>
        <button id="btnPDFFix" class="sec">Salvar holerite em PDF</button>
        <button id="btnGraficoFix" class="sec">Ver gráfico</button>
        <button id="btnFolhaPontoFix" class="sec">Gerar folha de ponto</button>
      </div>
      <canvas id="graficoMensalFix" width="460" height="230"></canvas>
      <p id="monthToolsNote">O gráfico usa os registros do mês selecionado. A folha de ponto abre a prévia completa com opção de salvar em PDF.</p>
    `;
    const principal=tela.querySelector('.box');
    if(principal)principal.insertAdjacentElement('afterend',box);else tela.appendChild(box);
  }
  bind('btnHoleriteFix',gerarHolerite);
  bind('btnPDFFix',gerarPDF);
  bind('btnGraficoFix',toggleGrafico);
  bind('btnFolhaPontoFix',gerarFolha);
}
function bind(id,fn){
  const b=$(id);if(!b||b.dataset.bound==='1')return;
  b.dataset.bound='1';b.addEventListener('click',fn);
}
function bindNav(){
  document.querySelectorAll('.nav button').forEach(function(b){
    if(b.dataset.monthToolsBound==='1')return;
    b.dataset.monthToolsBound='1';
    b.addEventListener('click',function(){setTimeout(ensureTools,80)});
  });
}
function gerarHolerite(){
  if(typeof window.gerarHoleriteRefinado==='function')window.gerarHoleriteRefinado();
  else if(typeof gerarHoleritePessoal==='function')gerarHoleritePessoal();
  else alert('O gerador de holerite ainda não carregou. Feche e abra o app novamente.');
}
function gerarPDF(){
  gerarHolerite();
  setTimeout(function(){
    try{window.print()}catch(e){alert('Não foi possível abrir a impressão. Use a folha de ponto ou tente novamente.');}
  },350);
}
function gerarFolha(){
  if(typeof window.gerarFolhaPonto==='function'){
    window.gerarFolhaPonto();
    setTimeout(function(){
      const p=$('folhaPontoPreview');if(p)p.scrollIntoView({behavior:'smooth',block:'start'});
    },120);
  }else alert('O módulo de folha de ponto ainda não carregou. Feche e abra o app novamente.');
}
function toggleGrafico(){
  const c=$('graficoMensalFix');if(!c)return;
  const mostrar=c.style.display==='none'||!c.style.display;
  c.style.display=mostrar?'block':'none';
  $('btnGraficoFix').textContent=mostrar?'Ocultar gráfico':'Ver gráfico';
  if(mostrar)drawChart(c);
}
function drawChart(canvas){
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#101827';ctx.fillRect(0,0,w,h);
  const mes=($('mesResumo')&&$('mesResumo').value)||mesAtual();
  const dados=getRegistros(),datas=datasMes(mes);
  const vals=datas.map(function(d){
    const r=dados[d];if(!r||typeof calcularDia!=='function')return 0;
    try{return Math.round(((calcularDia(r).totalConsiderado||0)/60)*100)/100}catch(e){return 0}
  });
  const max=Math.max(9,...vals),pad=34,cw=w-pad*2,ch=h-pad*2,bw=cw/Math.max(1,vals.length);
  ctx.strokeStyle='#25314b';ctx.lineWidth=1;
  for(let i=0;i<=3;i++){const y=pad+(ch/3)*i;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke()}
  vals.forEach(function(v,i){const bh=(v/max)*ch,x=pad+i*bw+1,y=h-pad-bh;ctx.fillStyle=v>=8.8?'#16a34a':v>0?'#2b6cff':'#26334f';ctx.fillRect(x,y,Math.max(2,bw-2),bh)});
  ctx.fillStyle='#b7c5e4';ctx.font='12px Arial';ctx.fillText('Horas consideradas por dia',pad,20);ctx.fillText(max.toFixed(0)+'h',5,pad+4);ctx.fillText('0h',10,h-pad);
}
function getRegistros(){
  try{if(typeof registros!=='undefined')return registros}catch(e){}
  try{return JSON.parse(localStorage.getItem('app_ponto_pessoal_registros_v9')||'{}')}catch(e){return{}}
}
function datasMes(m){const p=m.split('-').map(Number),u=new Date(p[0],p[1],0).getDate(),a=[];for(let d=1;d<=u;d++)a.push(p[0]+'-'+String(p[1]).padStart(2,'0')+'-'+String(d).padStart(2,'0'));return a}
function mesAtual(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,1300)});else setTimeout(init,1300);
})();