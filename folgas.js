(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function getRegistros() {
    try {
      if (typeof registros !== 'undefined') return registros;
    } catch (e) {}

    try {
      return JSON.parse(localStorage.getItem('app_ponto_pessoal_registros_v9') || '{}');
    } catch (e) {
      return {};
    }
  }

  function getConfig() {
    try {
      if (typeof config !== 'undefined') return config;
    } catch (e) {}
    return { cargaDiaria: '08:48' };
  }

  function initFolgas() {
    ajustarLabelFolgas();
    montarPainelBancoFolgas();
    ativarAtualizacao();
    setTimeout(atualizarResumoComFolgas, 300);
  }

  function ajustarLabelFolgas() {
    const campo = $('mesFolgas');
    if (!campo || !campo.parentElement) return;
    const label = campo.parentElement.querySelector('p');
    if (label) label.textContent = 'Folgas disponíveis';
    campo.parentElement.title = 'Banco acumulado: 1 crédito por sábado e domingo trabalhados no mesmo fim de semana, menos folgas compensatórias utilizadas.';
    if (!$('mesFolgasDetalhe')) {
      const detalhe = document.createElement('small');
      detalhe.id = 'mesFolgasDetalhe';
      detalhe.style.cssText = 'display:block;color:#91a2c3;font-size:10px;margin-top:5px';
      campo.parentElement.appendChild(detalhe);
    }
  }

  function ativarAtualizacao() {
    const mesEl = $('mesResumo');
    if (mesEl && mesEl.dataset.folgasListener !== '1') {
      mesEl.dataset.folgasListener = '1';
      mesEl.addEventListener('change', function () {
        setTimeout(atualizarResumoComFolgas, 90);
      });
    }

    document.addEventListener('click', function () {
      setTimeout(atualizarResumoComFolgas, 180);
    });
    document.addEventListener('change', function () {
      setTimeout(atualizarResumoComFolgas, 100);
    });

    setInterval(function () {
      const mesAtual = $('mesResumo') && $('mesResumo').value;
      const ultimoMes = document.body.dataset.folgasMes || '';
      if (mesAtual && mesAtual !== ultimoMes) atualizarResumoComFolgas();
    }, 1200);
  }

  function atualizarResumoComFolgas() {
    ajustarLabelFolgas();
    montarPainelBancoFolgas();

    const mesEl = $('mesResumo');
    const mes = (mesEl && mesEl.value) || hojeMesLocal();
    document.body.dataset.folgasMes = mes;

    const dados = getRegistros();
    const cfg = getConfig();
    const cargaDiaria = horarioParaMinutosLocal(cfg.cargaDiaria || '08:48');

    let normais = 0;
    let ajuste = 0;
    let ex60 = 0;
    let ex100 = 0;
    let noturno = 0;
    let descanso = 0;
    let saldo = 0;
    let dias = 0;

    datasDoMesLocal(mes).forEach(function (data) {
      const registro = dados[data];
      if (!registro) return;
      if (typeof calcularDia !== 'function') return;

      const calculo = calcularDia(registro);
      if (calculo.totalConsiderado > 0) dias++;

      if (!registro.dia100) {
        normais += Math.min(calculo.totalConsiderado, cargaDiaria);
      }

      ajuste += calculo.ajusteRH || 0;
      ex60 += calculo.ex60 || 0;
      ex100 += calculo.ex100 || 0;
      noturno += calculo.noturno || 0;
      descanso += calculo.descanso || 0;
      saldo += calculo.saldo || 0;
    });

    setText('mesNormais', minutosParaHoraLongaLocal(normais));
    setText('mesAjusteRH', minutosParaHoraLongaLocal(ajuste));
    setText('mesEx60', minutosParaHoraLongaLocal(ex60));
    setText('mesEx100', minutosParaHoraLongaLocal(ex100));
    setText('mesNoturno', minutosParaHoraLongaLocal(noturno));
    setText('mesDescanso', minutosParaHoraLongaLocal(descanso));
    setText('mesDiasTrabalhados', dias);
    const bancoMes = resumoBancoFolgas(ultimoDiaDoMes(mes));
    setText('mesFolgas', bancoMes.saldo);
    setText('mesFolgasDetalhe', bancoMes.ganhas + ' ganhas · ' + bancoMes.usadas + ' utilizadas');
    setText('mesSaldo', formatarSaldoLongoLocal(saldo));
    atualizarPainelBancoFolgas();
  }

  function temBatidas(registro) {
    return !!(registro && (registro.entrada || registro.saidaDescanso || registro.voltaDescanso || registro.saidaFinal));
  }

  function folgaUtilizada(registro) {
    if (!registro || registro.tipoDia !== 'folga' || temBatidas(registro)) return false;
    if (registro.folgaCompensatoriaUsada === true) return true;
    if (registro.folgaCompensatoriaUsada === false) return false;
    const motivo = String(registro.motivoDia || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return motivo.includes('folga compensatoria utilizada');
  }

  function resumoBancoFolgas(dataLimite) {
    const dados = getRegistros();
    const limite = dataLimite || ultimoDiaDoMes(hojeMesLocal());
    let ganhas = 0;
    let usadas = 0;

    Object.keys(dados).forEach(function (data) {
      if (data > limite) return;
      const dataObj = new Date(data + 'T12:00:00');
      if (folgaUtilizada(dados[data])) usadas++;
      if (dataObj.getDay() !== 0 || !diaTrabalhado(data)) return;
      const sabado = addDaysISO(data, -1);
      if (diaTrabalhado(sabado)) ganhas++;
    });

    return { ganhas: ganhas, usadas: usadas, saldo: ganhas - usadas };
  }

  function calcularFolgasAcumuladas(mesLimite) {
    return resumoBancoFolgas(ultimoDiaDoMes(mesLimite || hojeMesLocal())).saldo;
  }

  function calcularFolgasGanhas(mes) {
    let total = 0;
    datasDoMesLocal(mes).forEach(function (data) {
      const dia = new Date(data + 'T12:00:00');
      if (dia.getDay() !== 0) return;
      if (diaTrabalhado(data) && diaTrabalhado(addDaysISO(data, -1))) total++;
    });
    return total;
  }

  function montarPainelBancoFolgas() {
    if ($('bancoFolgasBox')) return;
    const status = $('statusDiaBox');
    const marcacoes = $('marcacoes');
    const referencia = status || marcacoes;
    if (!referencia || !referencia.parentNode) return;

    const box = document.createElement('section');
    box.id = 'bancoFolgasBox';
    box.className = 'banco-folgas-box';
    box.innerHTML =
      '<div class="banco-folgas-cabecalho"><h3>🏖️ Banco de folgas</h3><span id="bancoFolgasDisponiveis">0 disponíveis</span></div>' +
      '<p class="banco-folgas-explica">Sábado + domingo trabalhados no mesmo fim de semana = 1 folga. O crédito acumula até ser utilizado.</p>' +
      '<div class="banco-folgas-numeros">' +
      '<div><span>Conquistadas</span><strong id="bancoFolgasGanhas">0</strong></div>' +
      '<div><span>Utilizadas</span><strong id="bancoFolgasUsadas">0</strong></div>' +
      '<div><span>Saldo</span><strong id="bancoFolgasSaldo">0</strong></div></div>' +
      '<button type="button" id="btnUsarFolgaBanco" class="banco-folgas-usar">Usar 1 folga neste dia</button>' +
      '<button type="button" id="btnDesfazerFolgaBanco" class="banco-folgas-desfazer" hidden>Desfazer folga utilizada</button>' +
      '<p class="banco-folgas-aviso" id="bancoFolgasAviso"></p>';

    referencia.insertAdjacentElement('afterend', box);
    $('btnUsarFolgaBanco').addEventListener('click', usarFolgaBanco);
    $('btnDesfazerFolgaBanco').addEventListener('click', desfazerFolgaBanco);

    if (!$('bancoFolgasStyle')) {
      const style = document.createElement('style');
      style.id = 'bancoFolgasStyle';
      style.textContent =
        '.banco-folgas-box{margin:14px 0;padding:14px;border:1px solid #315077;background:#101f34;border-radius:18px;display:grid;gap:11px}' +
        '.banco-folgas-cabecalho{display:flex;justify-content:space-between;gap:8px;align-items:center}' +
        '.banco-folgas-cabecalho h3{margin:0;font-size:16px}' +
        '#bancoFolgasDisponiveis{border-radius:999px;padding:6px 9px;background:#133c2e;color:#b8ffcf;font-size:11px;white-space:nowrap}' +
        '.banco-folgas-explica,.banco-folgas-aviso{margin:0;color:#9fb4d6;font-size:12px;line-height:1.45}' +
        '.banco-folgas-numeros{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}' +
        '.banco-folgas-numeros div{padding:10px 5px;text-align:center;border-radius:12px;background:#0c172a;border:1px solid #273a5c}' +
        '.banco-folgas-numeros span{display:block;color:#9fb4d6;font-size:11px}' +
        '.banco-folgas-numeros strong{display:block;font-size:21px;color:#fff;margin-top:4px}' +
        '.banco-folgas-usar,.banco-folgas-desfazer{width:100%;padding:13px;border-radius:13px;font-size:14px;font-weight:700}' +
        '.banco-folgas-usar{background:#16a34a!important;color:white!important}' +
        '.banco-folgas-usar:disabled{opacity:.45}' +
        '.banco-folgas-desfazer{background:#344967!important;color:white!important}' +
        '[hidden]{display:none!important}' +
        '@media print{.banco-folgas-box{display:none!important}}';
      document.head.appendChild(style);
    }
  }

  function registroSelecionado() {
    const input = $('dataSelecionada');
    const data = input && input.value;
    const dados = getRegistros();
    return data ? { data: data, registro: dados[data] } : null;
  }

  function atualizarPainelBancoFolgas() {
    const selecionado = registroSelecionado();
    const painel = $('bancoFolgasBox');
    if (!selecionado || !painel) return;

    const r = selecionado.registro;
    const banco = resumoBancoFolgas(selecionado.data);
    const usado = folgaUtilizada(r);
    setText('bancoFolgasGanhas', banco.ganhas);
    setText('bancoFolgasUsadas', banco.usadas);
    setText('bancoFolgasSaldo', banco.saldo);
    setText('bancoFolgasDisponiveis', banco.saldo + (banco.saldo === 1 ? ' disponível' : ' disponíveis'));

    const usar = $('btnUsarFolgaBanco');
    const desfazer = $('btnDesfazerFolgaBanco');
    if (usar) {
      usar.hidden = usado;
      usar.disabled = banco.saldo <= 0 || temBatidas(r);
    }
    if (desfazer) desfazer.hidden = !usado;

    const aviso = $('bancoFolgasAviso');
    if (aviso) {
      aviso.textContent = usado
        ? 'Este dia consumiu 1 folga do banco. Desfaça para devolver o crédito.'
        : temBatidas(r)
          ? 'Há pontos neste dia. As horas continuam contabilizadas; escolha um dia sem batidas para usar a folga.'
          : banco.saldo <= 0
            ? 'Sem folgas disponíveis até esta data. Complete um sábado e domingo trabalhados para ganhar um crédito.'
            : 'Selecione a data da folga e toque em Usar 1 folga neste dia.';
    }
  }

  function atualizarDepoisDaFolga() {
    if (typeof salvarRegistros === 'function') salvarRegistros();
    else localStorage.setItem('app_ponto_pessoal_registros_v9', JSON.stringify(getRegistros()));
    if (typeof renderizar === 'function') renderizar();
    atualizarResumoComFolgas();
  }

  function usarFolgaBanco() {
    const sel = registroSelecionado();
    if (!sel) return;
    const r = sel.registro;
    if (!r) return;
    if (folgaUtilizada(r)) return;
    if (temBatidas(r)) {
      alert('Este dia tem marcações. Escolha um dia sem batidas para descontar uma folga.');
      return;
    }

    const banco = resumoBancoFolgas(sel.data);
    if (banco.saldo <= 0) {
      alert('Você não tem folgas acumuladas disponíveis até esta data.');
      return;
    }

    // Guarda o status anterior para permitir desfazer sem perder informações.
    r.folgaBancoStatusAnterior = r.tipoDia || 'normal';
    r.folgaBancoMotivoAnterior = r.motivoDia || '';
    r.folgaBancoDia100Anterior = !!r.dia100;
    r.tipoDia = 'folga';
    r.motivoDia = 'Folga compensatória utilizada';
    r.folgaCompensatoriaUsada = true;
    r.dia100 = true;
    atualizarDepoisDaFolga();
  }

  function desfazerFolgaBanco() {
    const sel = registroSelecionado();
    if (!sel || !folgaUtilizada(sel.registro)) return;
    const r = sel.registro;

    r.tipoDia = r.folgaBancoStatusAnterior || 'normal';
    r.motivoDia = r.folgaBancoMotivoAnterior || '';
    r.dia100 = Object.prototype.hasOwnProperty.call(r, 'folgaBancoDia100Anterior')
      ? !!r.folgaBancoDia100Anterior
      : new Date(sel.data + 'T12:00:00').getDay() % 6 === 0;
    r.folgaCompensatoriaUsada = false;
    delete r.folgaBancoStatusAnterior;
    delete r.folgaBancoMotivoAnterior;
    delete r.folgaBancoDia100Anterior;
    atualizarDepoisDaFolga();
  }

  function primeiroSabadoAntesOuIgual(dataISO) {
    const d = new Date(dataISO + 'T12:00:00');
    while (d.getDay() !== 6) d.setDate(d.getDate() - 1);
    return toISODate(d);
  }

  function ultimoDiaDoMes(mes) {
    const partes = mes.split('-').map(Number);
    const d = new Date(partes[0], partes[1], 0, 12, 0, 0);
    return toISODate(d);
  }

  function diaTrabalhado(data) {
    const dados = getRegistros();
    const registro = dados[data];
    if (!registro || typeof calcularDia !== 'function') return false;
    const calculo = calcularDia(registro);
    return !!(registro.entrada && registro.saidaFinal && calculo.trabalhadoPonto > 0);
  }

  function addDaysISO(dataISO, dias) {
    const d = new Date(dataISO + 'T12:00:00');
    d.setDate(d.getDate() + dias);
    return toISODate(d);
  }

  function toISODate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function datasDoMesLocal(mes) {
    if (typeof gerarDatasDoMes === 'function') return gerarDatasDoMes(mes);

    const partes = mes.split('-').map(Number);
    const ano = partes[0];
    const mesNumero = partes[1];
    const ultimo = new Date(ano, mesNumero, 0).getDate();
    const out = [];

    for (let dia = 1; dia <= ultimo; dia++) {
      out.push(ano + '-' + String(mesNumero).padStart(2, '0') + '-' + String(dia).padStart(2, '0'));
    }

    return out;
  }

  function horarioParaMinutosLocal(horario) {
    if (typeof horarioParaMinutos === 'function') return horarioParaMinutos(horario);
    const partes = String(horario || '00:00').split(':').map(Number);
    return partes[0] * 60 + partes[1];
  }

  function minutosParaHoraLongaLocal(minutos) {
    if (typeof minutosParaHoraLonga === 'function') return minutosParaHoraLonga(minutos);
    minutos = Math.max(0, Math.round(minutos));
    return String(Math.floor(minutos / 60)).padStart(2, '0') + ':' + String(minutos % 60).padStart(2, '0');
  }

  function formatarSaldoLongoLocal(minutos) {
    if (typeof formatarSaldoLongo === 'function') return formatarSaldoLongo(minutos);
    return (minutos >= 0 ? '+' : '-') + minutosParaHoraLongaLocal(Math.abs(minutos));
  }

  function hojeMesLocal() {
    if (typeof hojeMesISO === 'function') return hojeMesISO();
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function setText(id, valor) {
    const node = $(id);
    if (node) node.textContent = valor;
  }

  window.calcularFolgasGanhas = calcularFolgasGanhas;
  window.resumoBancoFolgas = resumoBancoFolgas;
  window.folgaBancoUtilizada = folgaUtilizada;
  window.calcularFolgasAcumuladas = calcularFolgasAcumuladas;
  window.atualizarResumoComFolgas = atualizarResumoComFolgas;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(initFolgas, 900);
    });
  } else {
    setTimeout(initFolgas, 900);
  }
})();
