(function(){
'use strict';
const REG_KEY='app_ponto_pessoal_registros_v9';
const MIG_KEY='app_ponto_restauracao_agosto_2026_v1';
const ORIGEM='backup-google-drive-2026-08-15';

const AGOSTO={
  '2026-08-01': r('15:25','21:00','22:00','00:01',{dia100:true}),
  '2026-08-02': r('07:05',null,null,'15:19',{dia100:true}),
  '2026-08-03': r('15:18',null,null,'00:54'),
  '2026-08-04': r(null,null,null,null,{tipoDia:'atestado',motivoDia:'Saída antecipada autorizada'}),
  '2026-08-05': r('15:32','21:31','22:31','00:58'),
  '2026-08-06': r('16:02','21:00','22:00','00:58'),
  '2026-08-07': r('15:29',null,null,null),
  '2026-08-08': r('15:27','21:00','22:00','23:49',{dia100:true}),
  '2026-08-10': r('15:26','21:00','22:00','00:56'),
  '2026-08-11': r('15:26',null,null,null),
  '2026-08-12': r('15:26','21:07','22:07','04:35'),
  '2026-08-13': r('15:25','21:26','22:26','00:56'),
  '2026-08-14': r('15:37','21:00',null,null)
};

function r(entrada,saidaDescanso,voltaDescanso,saidaFinal,opts){
  opts=opts||{};
  return {entrada,saidaDescanso,voltaDescanso,saidaFinal,dia100:!!opts.dia100,tipoDia:opts.tipoDia||'normal',motivoDia:opts.motivoDia||'',observacao:''};
}

function init(){
  if(typeof registros==='undefined'){setTimeout(init,160);return;}
  restaurar();
}

function restaurar(){
  if(localStorage.getItem(MIG_KEY)==='1')return;
  let alterou=false;

  Object.keys(AGOSTO).forEach(function(data){
    const existente=registros[data];
    if(temConteudo(existente))return;
    registros[data]=montar(data,AGOSTO[data]);
    alterou=true;
  });

  if(alterou){
    if(typeof salvarRegistros==='function')salvarRegistros();
    else localStorage.setItem(REG_KEY,JSON.stringify(registros));
    try{
      if(typeof renderizar==='function')renderizar();
      if(typeof renderizarHistorico==='function')renderizarHistorico();
      if(typeof renderizarResumoMensal==='function')renderizarResumoMensal();
    }catch(e){}
  }
  localStorage.setItem(MIG_KEY,'1');
}

function temConteudo(x){
  if(!x)return false;
  return !!(x.entrada||x.saidaDescanso||x.voltaDescanso||x.saidaFinal||x.observacao||x.motivoDia||(x.tipoDia&&x.tipoDia!=='normal'));
}

function montar(data,f){
  const out={
    data:data,
    entrada:null,
    saidaDescanso:null,
    voltaDescanso:null,
    saidaFinal:null,
    dia100:!!f.dia100,
    observacao:'Restaurado do backup do App Ponto de agosto/2026.',
    tipoDia:f.tipoDia||'normal',
    motivoDia:f.motivoDia||'',
    folgaUtilizada:false,
    origemRegistro:ORIGEM
  };
  if(f.entrada)out.entrada=iso(data,f.entrada,null);
  if(f.saidaDescanso)out.saidaDescanso=iso(data,f.saidaDescanso,out.entrada);
  if(f.voltaDescanso)out.voltaDescanso=iso(data,f.voltaDescanso,out.saidaDescanso||out.entrada);
  if(f.saidaFinal)out.saidaFinal=iso(data,f.saidaFinal,out.voltaDescanso||out.saidaDescanso||out.entrada);
  return out;
}

function iso(data,hora,referencia){
  if(typeof criarISO==='function')return criarISO(data,hora,referencia);
  const d=new Date(data+'T'+hora+':00');
  if(referencia){const ref=new Date(referencia);while(d<=ref)d.setDate(d.getDate()+1);}
  return localISO(d);
}

function localISO(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':00';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,120);});
else setTimeout(init,120);
})();