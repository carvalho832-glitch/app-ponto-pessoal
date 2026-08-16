(function () {
  const LIMITE_FOLGA_MINUTOS = 8 * 60;

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
    ajustarCardFolgas();
    ativarAtualizacao();
    criarModalFolgas();
    setTimeout(atualizarResumoComFolgas, 300);
  }

  function ajustarCardFolgas() {
    const campo = $('mesFolgas');
    if (!campo) return;

    const card = campo.closest('.card');
    if (!card) return;

    card.classList.add('folga-card');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', 'Ver detalhes das folgas acumuladas');
    card.title = 'Toque para ver as datas dos domingos que geraram suas folgas';

    const label = card.querySelector('p');
    if (label) label.textContent = 'Folgas acumuladas';

    if (card.dataset.folgasAtivo !== '1') {
      card.dataset.folgasAtivo = '1';
      card.addEventListener('click', abrirModalFolgas);
      card.addEventListener('keydown', function (evento) {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          abrirModalFolgas();
        }
      });
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

    document.addEventListener('click', function (evento) {
      if (evento.target && evento.target.closest && evento.target.closest('#folgasModal')) return;
      setTimeout(atualizarResumoComFolgas, 180);
    });

    setInterval(function () {
      const mesAtual = $('mesResumo') && $('mesResumo').value;
      const ultimoMes = document.body.dataset.folgasMes || '';
      if (mesAtual && mesAtual !== ultimoMes) atualizarResumoComFolgas();
    }, 1200);
  }

  function atualizarResumoComFolgas() {
    ajustarCardFolgas();

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

  function obterFolgasQualificadasAte(mesLimite) {
    const dados = getRegistros();
    const fim = ultimoDiaDoMes(mesLimite);

    return Object.keys(dados)
      .filter(function (data) {
        return data <= fim && ehDomingo(data);
      })
      .sort()
      .map(function (data) {
        const registro = dados[data];
        if (!registro || typeof calcularDia !== 'function') return null;

        const calculo = calcularDia(registro);
        const horas = calculo.totalConsiderado || 0;

        if (horas < LIMITE_FOLGA_MINUTOS) return null;

        return {
          data,
          minutos: horas,
          registro,
          calculo,
          mes: data.slice(0, 7)
        };
      })
      .filter(Boolean);
  }

  function calcularFolgasAcumuladas(mesLimite) {
    return obterFolgasQualificadasAte(mesLimite).length;
  }

  function calcularFolgasGanhas(mes) {
    return obterFolgasQualificadasAte(mes).filter(function (item) {
      return item.mes === mes;
    }).length;
  }

  function abrirModalFolgas() {
    const modal = $('folgasModal');
    if (!modal) return;

    const mes = ($('mesResumo') && $('mesResumo').value) || hojeMesLocal();
    renderizarModalFolgas(mes);
    modal.classList.add('ativo');
    document.body.classList.add('folgas-modal-aberto');
  }

  function fecharModalFolgas() {
    const modal = $('folgasModal');
    if (!modal) return;
    modal.classList.remove('ativo');
    document.body.classList.remove('folgas-modal-aberto');
  }

  function criarModalFolgas() {
    if ($('folgasModal')) return;

    const modal = document.createElement('div');
    modal.id = 'folgasModal';
    modal.className = 'folgas-modal';
    modal.innerHTML = `
      <div class="folgas-modal-box" role="dialog" aria-modal="true" aria-labelledby="folgasModalTitulo">
        <div class="folgas-modal-head">
          <div>
            <p class="folgas-kicker">Banco de folgas</p>
            <h3 id="folgasModalTitulo">Folgas acumuladas</h3>
          </div>
          <button type="button" id="btnFecharFolgas" class="ghost folgas-fechar" aria-label="Fechar">×</button>
        </div>
        <div id="folgasModalResumo"></div>
        <div id="folgasModalLista" class="folgas-lista"></div>
      </div>
    `;

    document.body.appendChild(modal);

    $('btnFecharFolgas').addEventListener('click', fecharModalFolgas);
    modal.addEventListener('click', function (evento) {
      if (evento.target === modal) fecharModalFolgas();
    });

    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape') fecharModalFolgas();
    });
  }

  function renderizarModalFolgas(mes) {
    const resumo = $('folgasModalResumo');
    const lista = $('folgasModalLista');
    if (!resumo || !lista) return;

    const todas = obterFolgasQualificadasAte(mes);
    const doMes = todas.filter(function (item) { return item.mes === mes; });
    const anteriores = todas.length - doMes.length;

    resumo.innerHTML = `
      <div class="folgas-resumo-grid">
        <div><span>Acumuladas até ${nomeMesCurto(mes)}</span><b>${todas.length}</b></div>
        <div><span>Geradas neste mês</span><b>${doMes.length}</b></div>
      </div>
      <div class="folgas-regra"><b>Regra:</b> domingo trabalhado com <strong>08:00 ou mais</strong> gera 1 folga. Abaixo de 08:00 não gera.</div>
    `;

    if (!todas.length) {
      lista.innerHTML = `
        <div class="folgas-vazio">
          <b>Nenhuma folga gerada ainda.</b>
          <span>Quando um domingo atingir 08:00 de trabalho no espelho de ponto, ele aparecerá aqui.</span>
        </div>
      `;
      return;
    }

    lista.innerHTML = `
      <div class="folgas-lista-titulo">Domingos que geraram folga</div>
      ${todas.slice().reverse().map(function (item) {
        const destaque = item.mes === mes ? ' destaque' : '';
        return `
          <div class="folga-item${destaque}">
            <div>
              <b>${formatarDataLocal(item.data)}</b>
              <small>${diaSemanaNome(item.data)} · ${item.mes === mes ? 'Este mês' : nomeMesCurto(item.mes)}</small>
            </div>
            <div class="folga-horas">
              <strong>${minutosParaHoraLongaLocal(item.minutos)}</strong>
              <small>trabalhadas</small>
            </div>
            <span class="folga-badge">+1 folga</span>
          </div>
        `;
      }).join('')}
      ${anteriores > 0 ? `<p class="folgas-observacao">O total acima inclui as folgas acumuladas dos meses anteriores.</p>` : ''}
    `;
  }

  function ehDomingo(dataISO) {
    return new Date(dataISO + 'T12:00:00').getDay() === 0;
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

  function ultimoDiaDoMes(mes) {
    const partes = mes.split('-').map(Number);
    return toISODate(new Date(partes[0], partes[1], 0, 12, 0, 0));
  }

  function toISODate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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

  function formatarDataLocal(dataISO) {
    const partes = dataISO.split('-');
    return partes[2] + '/' + partes[1] + '/' + partes[0];
  }

  function diaSemanaNome(dataISO) {
    const nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return nomes[new Date(dataISO + 'T12:00:00').getDay()];
  }

  function nomeMesCurto(mes) {
    const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const partes = mes.split('-');
    return nomes[Number(partes[1]) - 1] + '/' + partes[0];
  }

  function setText(id, valor) {
    const node = $(id);
    if (node) node.textContent = valor;
  }

  window.calcularFolgasGanhas = calcularFolgasGanhas;
  window.calcularFolgasAcumuladas = calcularFolgasAcumuladas;
  window.atualizarResumoComFolgas = atualizarResumoComFolgas;
  window.abrirModalFolgas = abrirModalFolgas;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(initFolgas, 900);
    });
  } else {
    setTimeout(initFolgas, 900);
  }
})();
