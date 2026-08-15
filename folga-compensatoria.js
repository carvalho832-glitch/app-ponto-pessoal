(function(){
'use strict';
const REG_KEY='app_ponto_pessoal_registros_v9';
const CORRECAO_KEY='app_ponto_correcao_folga_compensatoria_v1';
function $(id){return document.getElementById(id)}
function init(){
  if(typeof registros==='undefined'){setTimeout(init,180);return}
  corrigirJulho();
  ajustarInterface();
  document.addEventListener('click',function(){setTimeout(ajustarInterface,120)});
  setTimeout(ajustarInterface,600);
}
function corrigirJulho(){
  if(localStorage.getItem(CORRECAO_KEY)==='1')return;
  const r=registros['2026-07-28'];
  if(r&&r.tipoDia==='folga'){
    r.folgaUtilizada=false;
    r.motivoDia='Folga registrada no espelho; não contabilizada automaticamente como uso do banco';
    const base='Importado do espelho de ponto de julho/2026.';
    if(!r.observacao||r.observacao.includes('Folga compensatória utilizada')){
      r.observacao=base+' A indicação “Folga” do espelho não movimenta o banco de folgas compensatórias.';
    }
    salvar();
  }
  localStorage.setItem(CORRECAO_KEY,'1');
}
function ajustarInterface(){
  const btn=$('btnFolgaUtilizada');
  if(btn){
    btn.innerHTML='💳<br>Folga compensatória usada';
    btn.title='Use somente quando você realmente utilizar um dia do banco de folgas. A palavra Folga no espelho não desconta o banco.';
  }
  const card=$('mesFolgas')&&$('mesFolgas').closest('.card');
  const tela=$('telaMes');
  if(card&&tela&&!$('folgaBancoNota')){
    const nota=document.createElement('p');
    nota.id='folgaBancoNota';
    nota.className='aviso';
    nota.style.marginTop='10px';
    nota.textContent='Banco de folgas: o app gera +1 crédito quando sábado e domingo do mesmo fim de semana forem trabalhados. O uso do crédito é marcado manualmente em “Folga compensatória usada”. A indicação “Folga” do espelho de ponto, sozinha, não soma nem desconta crédito.';
    card.parentElement.insertAdjacentElement('afterend',nota);
  }
}
function salvar(){
  if(typeof salvarRegistros==='function')salvarRegistros();
  else localStorage.setItem(REG_KEY,JSON.stringify(registros));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,120));else setTimeout(init,120);
})();