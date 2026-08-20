(function () {
  'use strict';

  const REG_KEY = 'app_ponto_pessoal_registros_v9';
  const CFG_KEY = 'app_ponto_pessoal_config_v9';
  const MIG_KEY = 'app_ponto_migracao_julho_2026_v2';
  const FIM_JORNADA = '01:18';
  const AJUSTE_RH_MIN = 18;
  const MINUTOS_HORA_NOTURNA = 52.5;

  const JULHO_2026 = {
    '2026-07-01': dia('15:43','21:08','22:13','00:55',{normais:528,noturno:186}),
    '2026-07-02': dia('15:40','21:13','22:20','00:58',{normais:528,noturno:181}),
    '2026-07-03': dia('15:53','21:15','22:17','01:00',{normais:528,noturno:187}),
    '2026-07-04': dia('12:42','20:52','22:01','23:59',{ex100:550,en100:135},{dia100:true,manual:'Saída 23:59 lançada manualmente'}),
    '2026-07-05': dia('07:20',null,null,'13:12',{ex100:352},{dia100:true}),
    '2026-07-06': dia('15:46','21:17','22:19','03:42',{normais:528,en60:145,noturno:226}),
    '2026-07-07': dia('15:42','21:04','22:06','00:58',{normais:528,noturno:197}),
    '2026-07-08': dia('15:33','21:07','21:54','00:53',{normais:528,noturno:198}),
    '2026-07-09': dia('15:31','19:00','20:00','23:57',{ex100:389,en100:134},{dia100:true,tipoDia:'feriado',manual:'Intervalo 19:00–20:00 lançado manualmente'}),
    '2026-07-10': dia('15:00','19:00','20:00','23:59',{ex100:420,en100:137},{dia100:true,tipoDia:'feriado',manual:'Batidas lançadas manualmente'}),
    '2026-07-11': folga(false),
    '2026-07-12': folga(false),
    '2026-07-13': dia('15:30','21:25','22:17','00:59',{normais:528,noturno:186},{manual:'Entrada 15:30 lançada manualmente'}),
    '2026-07-14': dia('15:35','21:08','22:08','00:58',{normais:528,noturno:195},{manual:'Volta 22:08 lançada manualmente'}),
    '2026-07-15': dia('15:39','21:07','22:07','01:03',{normais:528,noturno:202}),
    '2026-07-16': dia('15:34','21:10','22:04','00:59',{normais:528,noturno:201}),
    '2026-07-17': dia('15:52','21:14','22:07','00:55',{normais:528,noturno:193}),
    '2026-07-18': folga(false),
    '2026-07-19': folga(false),
    '2026-07-20': dia('16:50','21:25','22:37','00:57',{normais:528,noturno:161}),
    '2026-07-21': dia('15:30','21:00','22:00','01:00',{normais:528,noturno:207},{manual:'Batidas lançadas manualmente por relógio sem papel'}),
    '2026-07-22': dia('15:30','21:00','22:00','01:00',{normais:528,noturno:207},{manual:'Batidas lançadas manualmente por relógio sem papel'}),
    '2026-07-23': dia('15:30','21:00','22:00','01:00',{normais:528,noturno:207},{manual:'Batidas lançadas manualmente por relógio sem papel'}),
    '2026-07-24': dia('15:30','21:00','22:00','00:55',{normais:528,noturno:201},{manual:'Entrada e intervalo lançados manualmente por relógio sem papel'}),
    '2026-07-25': dia('15:03','21:00','22:00','23:55',{ex100:417,en100:132},{dia100:true,manual:'Intervalo lançado manualmente por relógio sem papel'}),
    '2026-07-26': dia('06:06','12:33','13:33','16:57',{ex100:651},{dia100:true}),
    '2026-07-27': dia('15:27','21:23','22:21','00:58',{normais:528,noturno:180}),
    '2026-07-28': folga(true),
    '2026-07-29': dia('15:30','21:02','22:02','00:58',{normais:528,noturno:202},{manual:'Volta 22:02 lançada manualmente'}),
    '2026-07-30': dia('15:29','21:13','22:13','00:56',{normais:528,noturno:187},{manual:'Volta 22:13 lançada manualmente'}),
    '2026-07-31': dia('15:30','20:59','21:59','00:58',{normais:528,noturno:204},{manual:'Entrada 15:30 lançada manualmente'})
  };

  let calcularAnterior = null;
  let renderizarAnterior = null;
  let resumoAnterior = null;
  let preencherAnterior = null;

  function $(id) { return document.getElementById(id); }

  function dia(entrada, saidaDescanso, voltaDescanso, saidaFinal, rh, opts) {
    opts = opts || {};
    return {
      entrada, saidaDescanso, voltaDescanso, saidaFinal,
      dia100: !!opts.dia100,
      tipoDia: opts.tipoDia || 'normal',
      motivoDia: opts.tipoDia === 'feriado' ? 'Feriado conforme espelho de ponto' : '',
      folgaUtilizada: false,
      manual: opts.manual || '',
      rh
    };
  }

  function folga(utilizada) {
    return {
      entrada: null, saidaDescanso: null, voltaDescanso: null, saidaFinal: null,
      dia100: false,
      tipoDia: 'folga',
      motivoDia: utilizada ? 'Folga compensatória utilizada' : 'Folga programada',
      folgaUtilizada: !!utilizada,
      manual: '',
      rh: {}
    };
  }

  function init() {
    if (typeof calcularDia !== 'function' || typeof renderizar !== 'function' || typeof registros === 'undefined') {
      setTimeout(init, 150);
      return;
    }

    aplicarConfiguracaoRH();
    importarJulho2026();
    atualizarTextoJornada();
    injetarCamposRH();
    patchCalculo();
    patchPreencherPadrao();
    patchRenderizacao();
    prepararFolgaUtilizada();
    substituirHoleriteRefinado();
    prepararHistoricoRH();

    if (typeof renderizar === 'function') renderizar();
    if (typeof renderizarResumoMensal === 'function') renderizarResumoMensal();
  }

  function aplicarConfiguracaoRH() {
    config.saidaFinal = FIM_JORNADA;
    config.cargaDiaria = '08:48';
    config.ajusteRHMaximo = '00:18';
    config.inicioNoturno = '22:00';
    config.fimNoturno = '05:00';
    config.percentualEx60 = 60;
    config.adicionalNoturnoPercentual = 50;
    localStorage.setItem(CFG_KEY, JSON.stringify(config));
  }

  function importarJulho2026() {
    if (localStorage.getItem(MIG_KEY) === '1') return;

    Object.keys(JULHO_2026).forEach(function (data) {
      if (temDadosReais(registros[data])) return;
      registros[data] = montarRegistroImportado(data, JULHO_2026[data]);
    });

    if (typeof salvarRegistros === 'function') salvarRegistros();
    else localStorage.setItem(REG_KEY, JSON.stringify(registros));
    localStorage.setItem(MIG_KEY, '1');
  }

  function temDadosReais(r) {
    return !!(r && (r.entrada || r.saidaDescanso || r.voltaDescanso || r.saidaFinal || r.observacao || r.tipoDia === 'atestado'));
  }

  function montarRegistroImportado(data, fonte) {
    const r = {
      data,
      entrada: fonte.entrada ? iso(data, fonte.entrada, null) : null,
      saidaDescanso: null,
      voltaDescanso: null,
      saidaFinal: null,
      dia100: !!fonte.dia100,
      observacao: 'Importado do espelho de ponto de julho/2026.' + (fonte.manual ? ' ' + fonte.manual + '.' : ''),
      tipoDia: fonte.tipoDia,
      motivoDia: fonte.motivoDia,
      folgaUtilizada: !!fonte.folgaUtilizada,
      origemRegistro: 'espelho-rh-julho-2026',
      rhTotais: Object.assign({normais:0,ex60:0,en60:0,ex100:0,en100:0,noturno:0}, fonte.rh || {})
    };

    if (fonte.saidaDescanso) r.saidaDescanso = iso(data, fonte.saidaDescanso, r.entrada);
    if (fonte.voltaDescanso) r.voltaDescanso = iso(data, fonte.voltaDescanso, r.saidaDescanso || r.entrada);
    if (fonte.saidaFinal) r.saidaFinal = iso(data, fonte.saidaFinal, r.voltaDescanso || r.saidaDescanso || r.entrada);
    return r;
  }

  function iso(data, hora, referencia) {
    if (typeof criarISO === 'function') return criarISO(data, hora, referencia);
    let d = new Date(data + 'T' + hora + ':00');
    if (referencia) {
      const ref = new Date(referencia);
      while (d <= ref) d.setDate(d.getDate() + 1);
    }
    return localISO(d);
  }

  function localISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + 'T' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':00';
  }

  function atualizarTextoJornada() {
    const p = document.querySelector('.escala p');
    if (!p) return;
    p.innerHTML = 'Segunda a sexta: <b>15:30 às 01:18 +1</b><br>Descanso padrão: <b>19:00 às 20:00</b><br>Carga oficial: <b>08h48</b><br>HE em dia útil: <b>após 01:18, considerando o ajuste RH de até 00h18</b><br>Adicional noturno: <b>50% das 22:00 às 05:00</b>';
  }

  function injetarCamposRH() {
    const gridHoje = $('ex100') && $('ex100').closest('.grid');
    if (gridHoje && !$('en60')) {
      gridHoje.insertAdjacentHTML('beforeend', '<div class="card"><p>HE Noturna 60%</p><b id="en60">00h00</b></div><div class="card"><p>HE Noturna 100%</p><b id="en100">00h00</b></div>');
      const ex60Label = $('ex60').parentElement.querySelector('p');
      const ex100Label = $('ex100').parentElement.querySelector('p');
      if (ex60Label) ex60Label.textContent = 'HE 60% diurna';
      if (ex100Label) ex100Label.textContent = 'HE 100% diurna';
    }

    const moneyBox = $('valorEx60') && $('valorEx60').closest('.box');
    if (moneyBox && !$('valorEn60')) {
      const alvo = $('valorEx100').closest('.valor');
      alvo.insertAdjacentHTML('afterend','<p class="valor"><span>HE Noturna 60%</span><b id="valorEn60">R$ 0,00</b></p><p class="valor"><span>HE Noturna 100%</span><b id="valorEn100">R$ 0,00</b></p>');
    }

    const gridMes = $('mesEx100') && $('mesEx100').closest('.grid');
    if (gridMes && !$('mesEn60')) {
      $('mesEx100').parentElement.insertAdjacentHTML('afterend','<div class="card"><p>HE Noturna 60%</p><b id="mesEn60">00:00</b></div><div class="card"><p>HE Noturna 100%</p><b id="mesEn100">00:00</b></div>');
      const p60 = $('mesEx60').parentElement.querySelector('p');
      const p100 = $('mesEx100').parentElement.querySelector('p');
      if (p60) p60.textContent = 'HE 60% diurna';
      if (p100) p100.textContent = 'HE 100% diurna';
    }

    const folgaCard = $('mesFolgas') && $('mesFolgas').parentElement;
    if (folgaCard && !$('mesFolgasGanhas')) {
      const label = folgaCard.querySelector('p');
      if (label) label.textContent = 'Saldo de folgas';
      folgaCard.insertAdjacentHTML('beforebegin','<div class="card"><p>Folgas ganhas</p><b id="mesFolgasGanhas">0</b></div><div class="card"><p>Folgas usadas</p><b id="mesFolgasUsadas">0</b></div>');
    }
  }

  function patchCalculo() {
    if (calcularAnterior) return;
    calcularAnterior = calcularDia;
    window.calcularDia = function (registro) { return calcularDiaRH(registro); };
  }

  function calcularDiaRH(registro) {
    const base = calcularAnterior(registro);
    if (!registro) return base;

    const ints = intervalos(registro);
    const trabalhado = ints.reduce((s,i)=>s+diff(i.inicio,i.fim),0);
    const descanso = registro.saidaDescanso && registro.voltaDescanso ? diff(new Date(registro.saidaDescanso),new Date(registro.voltaDescanso)) : 0;
    const carga = min(config.cargaDiaria || '08:48');
    const tipo = registro.tipoDia || 'normal';

    if (registro.rhTotais && registro.origemRegistro === 'espelho-rh-julho-2026') {
      return aplicarTotaisRH(base, registro, trabalhado, descanso, registro.rhTotais);
    }

    if ((tipo === 'atestado' || tipo === 'abonado') && trabalhado === 0) return base;
    if (tipo === 'folga' && trabalhado === 0) return Object.assign({}, base, {
      trabalhadoPonto:0, ajusteRH:0, totalConsiderado:0, descanso:0, saldo:0,
      ex60:0,en60:0,ex100:0,en100:0,noturno:0,
      valorEx60:0,valorEn60:0,valorEx100:0,valorEn100:0,valorNoturno:0
    });

    const fimExtra = limiteExtra(registro.data);
    const fimExtraMs = fimExtra.getTime();
    const fimJornada = limiteFimJornada(registro.data);
    const eh100 = !!registro.dia100 || ehFimSemana(registro.data) || tipo === 'feriado' || (tipo === 'folga' && trabalhado > 0);
    const nightRawTotal = ints.reduce((s,i)=>s+nightRaw(i.inicio,i.fim),0);

    let ex60 = 0, en60 = 0, ex100 = 0, en100 = 0, noturno = 0;
    let ajusteRH = base.ajusteRH || 0;
    let totalConsiderado = trabalhado + ajusteRH;
    let saldo = totalConsiderado - carga;

    if (eh100) {
      const nightRaw = nightRawTotal;
      en100 = creditoNoturno(nightRaw);
      const dayRaw = Math.max(0, trabalhado - nightRaw);
      const intervaloPago = registro.saidaDescanso && registro.voltaDescanso ? Math.min(60, descanso) : 0;
      ex100 = dayRaw + intervaloPago;
      noturno = 0;
      ajusteRH = 0;
      totalConsiderado = trabalhado;
      saldo = ex100 + en100;
    } else {
      let extraNightRaw = 0;
      let extraDayRaw = 0;
      ints.forEach(function (i) {
        const iniMs = Math.max(i.inicio.getTime(), fimExtraMs);
        if (i.fim.getTime() <= iniMs) return;
        const ini = new Date(iniMs);
        const dur = diff(ini, i.fim);
        const n = nightRaw(ini, i.fim);
        extraNightRaw += n;
        extraDayRaw += Math.max(0, dur - n);
      });
      en60 = creditoNoturno(extraNightRaw);
      ex60 = extraDayRaw;

      const regularNightRaw = Math.max(0, nightRawTotal - extraNightRaw);
      noturno = creditoNoturno(regularNightRaw);

      const falta = carga - trabalhado;
      if (registro.entrada && registro.saidaFinal && falta > 0 && falta <= AJUSTE_RH_MIN) ajusteRH = falta;
      else ajusteRH = Math.max(0, base.ajusteRH || 0);
      totalConsiderado = trabalhado + ajusteRH;
      saldo = totalConsiderado - carga;

      if (registro.saidaFinal && new Date(registro.saidaFinal) > fimJornada && new Date(registro.saidaFinal) <= fimExtra) {
        ex60 = 0; en60 = 0;
      }
    }

    return finalizarCalculo(base, { trabalhadoPonto: trabalhado, ajusteRH, totalConsiderado, descanso, saldo, ex60, en60, ex100, en100, noturno });
  }

  function aplicarTotaisRH(base, registro, trabalhado, descanso, rh) {
    const carga = min(config.cargaDiaria || '08:48');
    const normais = Number(rh.normais || 0);
    const ex60 = Number(rh.ex60 || 0), en60 = Number(rh.en60 || 0), ex100 = Number(rh.ex100 || 0), en100 = Number(rh.en100 || 0), noturno = Number(rh.noturno || 0);
    const ajusteRH = normais > 0 ? Math.max(0, carga - Math.min(carga,trabalhado)) : 0;
    const totalConsiderado = normais > 0 ? Math.max(trabalhado, carga) : trabalhado;
    const saldo = ex60 + en60 + ex100 + en100;
    return finalizarCalculo(base, {trabalhadoPonto:trabalhado,ajusteRH,totalConsiderado,descanso,saldo,ex60,en60,ex100,en100,noturno,normaisRH:normais});
  }

  function finalizarCalculo(base, c) {
    const sal = num(config.salarioBase,0), div = num(config.divisorMensal,220), per = sal*num(config.periculosidadePercentual,0)/100;
    const vh = config.valorHora ? num(config.valorHora,0) : sal/div;
    const vhp = config.valorHora ? num(config.valorHora,0) : (sal+per)/div;
    const p60 = num(config.percentualEx60,60), pNot = num(config.adicionalNoturnoPercentual,50);
    c.valorEx60 = refFolha(c.ex60)*vhp*(1+p60/100);
    c.valorEn60 = refFolha(c.en60)*vhp*2;
    c.valorEx100 = refFolha(c.ex100)*vhp*2;
    c.valorEn100 = refFolha(c.en100)*vhp*2;
    c.valorNoturno = refFolha(c.noturno)*vh*(pNot/100);
    return Object.assign({}, base, c);
  }

  function limiteFimJornada(data) {
    const hora = config.saidaFinal || FIM_JORNADA;
    const d = new Date(data + 'T' + hora + ':00');
    if (min(hora) <= 12*60) d.setDate(d.getDate()+1);
    return d;
  }

  function limiteExtra(data) {
    const d = limiteFimJornada(data);
    d.setMinutes(d.getMinutes() + AJUSTE_RH_MIN);
    return d;
  }

  function creditoNoturno(rawMinutes) {
    rawMinutes = Math.max(0, Math.round(rawMinutes || 0));
    if (!rawMinutes) return 0;
    return Math.floor(rawMinutes * 60 / MINUTOS_HORA_NOTURNA) + 1;
  }

  function nightRaw(inicio, fim) {
    const ini = min(config.inicioNoturno || '22:00'), end = min(config.fimNoturno || '05:00');
    let total = 0, base = new Date(inicio);
    base.setHours(0,0,0,0); base.setDate(base.getDate()-1);
    for (let i=0;i<4;i++) {
      const d = new Date(base); d.setDate(d.getDate()+i);
      const a = new Date(d); a.setHours(Math.floor(ini/60),ini%60,0,0);
      const b = new Date(d); if (end<=ini) b.setDate(b.getDate()+1); b.setHours(Math.floor(end/60),end%60,0,0);
      const x = Math.max(inicio.getTime(),a.getTime()), y = Math.min(fim.getTime(),b.getTime());
      if (y>x) total += Math.round((y-x)/60000);
    }
    return total;
  }

  function intervalos(r) {
    const arr=[]; if(!r || !r.entrada) return arr;
    if(r.saidaDescanso){
      arr.push({inicio:new Date(r.entrada),fim:new Date(r.saidaDescanso)});
      if(r.voltaDescanso&&r.saidaFinal) arr.push({inicio:new Date(r.voltaDescanso),fim:new Date(r.saidaFinal)});
    } else if(r.saidaFinal) arr.push({inicio:new Date(r.entrada),fim:new Date(r.saidaFinal)});
    return arr.filter(i=>i.fim>i.inicio);
  }

  function patchPreencherPadrao() {
    if (preencherAnterior) return;
    preencherAnterior = window.preencherJornadaPadrao || preencherJornadaPadrao;
    window.preencherJornadaPadrao = function () {
      const r = registroAtual();
      const data = dataSelecionada();
      if (r.entrada || r.saidaDescanso || r.voltaDescanso || r.saidaFinal) {
        if (!confirm('Este dia já tem marcações. Deseja substituir?')) return;
      }
      r.entrada = iso(data,'15:30',null);
      r.saidaDescanso = iso(data,'19:00',r.entrada);
      r.voltaDescanso = iso(data,'20:00',r.saidaDescanso);
      r.saidaFinal = iso(data,FIM_JORNADA,r.voltaDescanso);
      r.dia100 = ehFimSemana(data);
      r.tipoDia = 'normal';
      r.motivoDia = '';
      r.folgaUtilizada = false;
      delete r.rhTotais; delete r.origemRegistro;
      salvarRegistros(); renderizar();
    };

    const btn = $('btnPadrao');
    if (btn && !btn.dataset.rhPadrao) {
      btn.dataset.rhPadrao = '1';
      btn.addEventListener('click', function () {
        setTimeout(function () {
          const r = registroAtual();
          if (!r || !r.entrada || !r.saidaFinal) return;
          r.saidaFinal = iso(dataSelecionada(), FIM_JORNADA, r.voltaDescanso || r.saidaDescanso || r.entrada);
          r.tipoDia = 'normal'; r.motivoDia = ''; r.folgaUtilizada = false;
          delete r.rhTotais; delete r.origemRegistro;
          salvarRegistros(); renderizar();
        }, 25);
      });
    }
  }

  function patchRenderizacao() {
    if (!renderizarAnterior) {
      renderizarAnterior = renderizar;
      window.renderizar = function (atualizarHistorico) {
        const out = renderizarAnterior(atualizarHistorico);
        atualizarHojeRH();
        syncBotaoFolga();
        return out;
      };
    }

    if (!resumoAnterior) {
      resumoAnterior = renderizarResumoMensal;
      window.renderizarResumoMensal = function () {
        const out = resumoAnterior();
        atualizarResumoRH();
        return out;
      };
    }
  }

  function atualizarHojeRH() {
    if (typeof registroAtual !== 'function') return;
    const c = calcularDiaRH(registroAtual());
    set('ex60', hora(c.ex60)); set('en60', hora(c.en60)); set('ex100', hora(c.ex100)); set('en100', hora(c.en100)); set('adNoturno', hora(c.noturno));
    set('valorEx60', moeda(c.valorEx60)); set('valorEn60', moeda(c.valorEn60)); set('valorEx100', moeda(c.valorEx100)); set('valorEn100', moeda(c.valorEn100)); set('valorNoturno', moeda(c.valorNoturno));
  }

  function atualizarResumoRH() {
    const mes = ($('mesResumo') && $('mesResumo').value) || mesAtual();
    const t = resumoMes(mes);
    set('mesEx60', horaLonga(t.ex60)); set('mesEn60', horaLonga(t.en60)); set('mesEx100', horaLonga(t.ex100)); set('mesEn100', horaLonga(t.en100)); set('mesNoturno', horaLonga(t.noturno));
    const banco = bancoFolgasAteMes(mes);
    set('mesFolgasGanhas', banco.ganhas); set('mesFolgasUsadas', banco.usadas); set('mesFolgas', banco.saldo);
  }

  function resumoMes(mes) {
    const t={ex60:0,en60:0,ex100:0,en100:0,noturno:0,normais:0};
    datasMes(mes).forEach(function(d){ const r=registros[d]; if(!r)return; const c=calcularDiaRH(r); t.ex60+=c.ex60||0;t.en60+=c.en60||0;t.ex100+=c.ex100||0;t.en100+=c.en100||0;t.noturno+=c.noturno||0;t.normais+=c.normaisRH||0; });
    return t;
  }

  function bancoFolgasAteMes(mes) {
    const fim = ultimoDiaMes(mes), datas = Object.keys(registros).filter(d=>d<=fim).sort();
    if (!datas.length) return {ganhas:0,usadas:0,saldo:0};
    let sab = sabadoAnteriorOuIgual(datas[0]), ganhas=0, usadas=0;
    while(sab<=fim){ const dom=addDias(sab,1); if(dom<=fim&&foiTrabalhado(sab)&&foiTrabalhado(dom))ganhas++; sab=addDias(sab,7); }
    datas.forEach(d=>{ const r=registros[d]; if(r&&r.folgaUtilizada)usadas++; });
    return {ganhas,usadas,saldo:ganhas-usadas};
  }

  function prepararFolgaUtilizada() {
    const box = $('statusDiaBotoes');
    if (!box || $('btnFolgaUtilizada')) return;
    const btn=document.createElement('button'); btn.type='button';btn.id='btnFolgaUtilizada';btn.innerHTML='💳<br>Folga usada'; box.appendChild(btn);
    btn.addEventListener('click',function(){
      const r=registroAtual(); r.tipoDia='folga'; r.folgaUtilizada=true; r.dia100=false; r.motivoDia='Folga compensatória utilizada';
      if(!r.observacao)r.observacao='Folga compensatória utilizada do banco de folgas.';
      delete r.rhTotais; delete r.origemRegistro; salvarRegistros(); renderizar();
    });
    box.querySelectorAll('[data-tipo-dia]').forEach(function(b){ b.addEventListener('click',function(){ const r=registroAtual(); r.folgaUtilizada=false; salvarRegistros(); syncBotaoFolga(); }); });
    syncBotaoFolga();
  }

  function syncBotaoFolga() {
    const btn=$('btnFolgaUtilizada'); if(!btn||typeof registroAtual!=='function')return;
    const r=registroAtual(); btn.classList.toggle('ativo',!!r.folgaUtilizada);
  }

  function prepararHistoricoRH() {
    const btn = document.querySelector('.nav button[data-tab="Historico"]');
    if (btn && !btn.dataset.rhHist) {
      btn.dataset.rhHist = '1';
      btn.addEventListener('click', function(){ setTimeout(atualizarHistoricoRH, 80); });
    }
    setTimeout(atualizarHistoricoRH, 80);
  }

  function atualizarHistoricoRH() {
    const lista = $('listaHistorico'); if (!lista) return;
    lista.querySelectorAll('.item').forEach(function(item){
      if (item.querySelector('.rh-extra-hist')) return;
      const b = item.querySelector('b'); if (!b) return;
      const p = b.textContent.trim().split('/'); if (p.length !== 3) return;
      const data = p[2]+'-'+p[1]+'-'+p[0], r = registros[data]; if (!r) return;
      const c = calcularDiaRH(r);
      const linha = document.createElement('div'); linha.className='rh-extra-hist';
      linha.style.marginTop='4px'; linha.style.color='#a9b7d6'; linha.style.fontSize='12px';
      linha.textContent='HE noturna 60%: '+hora(c.en60)+' | HE noturna 100%: '+hora(c.en100)+(r.folgaUtilizada?' | Folga usada: sim':'');
      item.appendChild(linha);
    });
  }

  function substituirHoleriteRefinado() {
    window.gerarHoleriteRefinado = gerarHoleriteRH;
    const btn=$('btnHolerite');
    if(btn&&!btn.dataset.rhFinal){ btn.dataset.rhFinal='1'; btn.addEventListener('click',function(){setTimeout(gerarHoleriteRH,260);}); }
  }

  function gerarHoleriteRH() {
    const alvo=$('holeritePessoal'); if(!alvo)return;
    const mes=($('mesResumo')&&$('mesResumo').value)||mesAtual(), t=resumoMes(mes);
    const sal=num(config.salarioBase,0), div=num(config.divisorMensal,220), perP=num(config.periculosidadePercentual,30), notP=num(config.adicionalNoturnoPercentual,50), exP=num(config.percentualEx60,60);
    const per=sal*perP/100, vh=sal/div, vhp=(sal+per)/div;
    const v60=refFolha(t.ex60)*vhp*(1+exP/100), v60n=refFolha(t.en60)*vhp*2, v100=refFolha(t.ex100)*vhp*2, v100n=refFolha(t.en100)*vhp*2, vnot=refFolha(t.noturno)*vh*notP/100;
    const variaveis=v60+v60n+v100+v100n+vnot;
    const dsrF=dsrFator(mes), dsrP=dsrF*100, dsr=variaveis*dsrF;
    const bruto=sal+per+variaveis+dsr;
    alvo.classList.add('ativo');
    alvo.innerHTML='<h3>Holerite pessoal RH</h3><p class="aviso">Prévia de '+nomeMes(mes)+'. Referências no padrão HH,MM usado no holerite.</p>'+ '<div class="hlinha head"><span>Provento</span><span>Ref.</span><b>Valor</b></div>'+linha('Salário base','Mensal',sal)+linha('Periculosidade '+perP+'%',perP+'%',per)+linha('Horas extras '+exP+'%',refTxt(t.ex60),v60)+linha('Horas extras noturna '+exP+'%',refTxt(t.en60),v60n)+linha('Horas extras 100%',refTxt(t.ex100),v100)+linha('Horas extras noturna 100%',refTxt(t.en100),v100n)+linha('Adicional noturno '+notP+'%',refTxt(t.noturno),vnot)+linha('Reflexo DSR estimado',dsrP.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%',dsr)+ '<div class="hlinha head"><span>Total vencimentos estimado</span><span></span><b>'+moeda(bruto)+'</b></div><p class="aviso">Julho/2026 usa os totais oficiais importados do espelho. Para os meses seguintes o app calcula pela mesma lógica de jornada, HE noturna e hora noturna reduzida.</p>';
  }

  function dsrFator(mes){const dias=datasMes(mes);const domingos=dias.filter(d=>new Date(d+'T12:00:00').getDay()===0).length;const uteis=Math.max(1,dias.length-domingos);return domingos/uteis;}
  function foiTrabalhado(data){const r=registros[data];if(!r)return false;return intervalos(r).reduce((s,i)=>s+diff(i.inicio,i.fim),0)>0;}
  function ehFimSemana(data){const d=new Date(data+'T12:00:00').getDay();return d===0||d===6;}
  function sabadoAnteriorOuIgual(data){const d=new Date(data+'T12:00:00');while(d.getDay()!==6)d.setDate(d.getDate()-1);return dataISO(d);}
  function ultimoDiaMes(mes){const p=mes.split('-').map(Number),d=new Date(p[0],p[1],0,12);return dataISO(d);}
  function addDias(data,n){const d=new Date(data+'T12:00:00');d.setDate(d.getDate()+n);return dataISO(d);}
  function dataISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function datasMes(mes){const p=mes.split('-').map(Number),n=new Date(p[0],p[1],0).getDate(),a=[];for(let d=1;d<=n;d++)a.push(p[0]+'-'+String(p[1]).padStart(2,'0')+'-'+String(d).padStart(2,'0'));return a;}
  function mesAtual(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
  function diff(a,b){return Math.max(0,Math.round((b-a)/60000));}
  function min(h){const p=String(h||'00:00').split(':').map(Number);return p[0]*60+p[1];}
  function num(v,p){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:p;}
  function refFolha(m){m=Math.max(0,Math.round(m||0));return Number(Math.floor(m/60)+'.'+String(m%60).padStart(2,'0'));}
  function refTxt(m){return refFolha(m).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function hora(m){m=Math.max(0,Math.round(m||0));return String(Math.floor(m/60)).padStart(2,'0')+'h'+String(m%60).padStart(2,'0');}
  function horaLonga(m){m=Math.max(0,Math.round(m||0));return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}
  function moeda(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
  function set(id,v){const n=$(id);if(n)n.textContent=v;}
  function nomeMes(mes){const nomes=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'],p=mes.split('-');return nomes[Number(p[1])-1]+' de '+p[0];}
  function linha(n,r,v){return '<div class="hlinha"><span>'+n+'</span><span>'+r+'</span><b>'+moeda(v)+'</b></div>';}

  window.calcularBancoFolgasRH = bancoFolgasAteMes;
  window.resumoMesRH = resumoMes;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){setTimeout(init,40);});
  else setTimeout(init,40);
})();