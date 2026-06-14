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
    ativarAtualizacao();
    setTimeout(atualizarResumoComFolgas, 300);
  }

  function ajustarLabelFolgas() {
    const campo = $('mesFolgas');
    if (!campo || !campo.parentElement) return;
    const label = campo.parentElement.querySelector('p');
    if (label) label.textContent = 'Folgas acumuladas';
    campo.parentElement.title = 'Banco cumulativo: soma 1 folga quando sábado e domingo do mesmo final de semana foram trabalhados.';
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

    setInterval(function () {
      const mesAtual = $('mesResumo') && $('mesResumo').value;
      const ultimoMes = document.body.dataset.folgasMes || '';
      if (mesAtual && mesAtual !== ultimoMes) atualizarResumoComFolgas();
    }, 1200);
  }

  function atualizarResumoComFolgas() {
    ajustarLabelFolgas();

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
    setText('mesFolgas', calcularFolgasAcumuladas(mes));
    setText('mesSaldo', formatarSaldoLongoLocal(saldo));
  }

  function calcularFolgasAcumuladas(mesLimite) {
    const dados = getRegistros();
    const chaves = Object.keys(dados).sort();
    if (!chaves.length) return 0;

    let inicio = primeiroSabadoAntesOuIgual(chaves[0]);
    const fim = ultimoDiaDoMes(mesLimite);
    let total = 0;

    while (inicio <= fim) {
      const domingo = addDaysISO(inicio, 1);
      if (domingo <= fim && diaTrabalhado(inicio) && diaTrabalhado(domingo)) {
        total++;
      }
      inicio = addDaysISO(inicio, 7);
    }

    return total;
  }

  function calcularFolgasGanhas(mes) {
    let total = 0;
    datasDoMesLocal(mes).forEach(function (data) {
      const d = new Date(data + 'T12:00:00');
      if (d.getDay() !== 6) return;
      const domingo = addDaysISO(data, 1);
      if (domingo.slice(0, 7) !== mes) return;
      if (diaTrabalhado(data) && diaTrabalhado(domingo)) total++;
    });
    return total;
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
    return calculo.totalConsiderado > 0;
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
