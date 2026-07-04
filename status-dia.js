(function () {
  const STATUS_KEY = 'tipoDia';
  const MOTIVO_KEY = 'motivoDia';

  const TIPOS = {
    normal: {
      label: 'Normal',
      hint: 'Calcula pelas batidas do dia.',
      badge: '✅'
    },
    abonado: {
      label: 'Abonado',
      hint: 'Completa até a carga oficial e não gera falta. Use para saída antecipada autorizada.',
      badge: '🟢'
    },
    atestado: {
      label: 'Atestado',
      hint: 'Conta a carga oficial como justificada e não gera saldo negativo.',
      badge: '🏥'
    },
    feriado: {
      label: 'Feriado',
      hint: 'Não gera falta. Sem batidas, considera a carga oficial como abonada.',
      badge: '🎉'
    },
    folga: {
      label: 'Folga',
      hint: 'Não gera falta. Se houver batidas, conta como EX100%.',
      badge: '🏖️'
    },
    ajuste: {
      label: 'Ajuste RH',
      hint: 'Para batida esquecida ou conferência manual. O cálculo segue as marcações.',
      badge: '🛠️'
    }
  };

  let calcularDiaOriginal = null;
  let renderizarOriginal = null;
  let atualizarStatusOriginal = null;
  let garantirRegistroOriginal = null;
  let preencherPadraoOriginal = null;
  let gerarFolhaPontoOriginal = null;

  function $(id) {
    return document.getElementById(id);
  }

  function initStatusDia() {
    if (typeof calcularDia !== 'function' || typeof renderizar !== 'function') {
      setTimeout(initStatusDia, 200);
      return;
    }

    injectStyle();
    patchGarantirRegistro();
    patchCalcularDia();
    patchRenderizar();
    patchAtualizarStatus();
    patchPreencherPadrao();
    patchGerarFolhaPonto();
    montarPainelStatusDia();

    if (typeof garantirRegistroDoDia === 'function') garantirRegistroDoDia();
    if (typeof renderizar === 'function') renderizar();
  }

  function injectStyle() {
    if ($('statusDiaStyle')) return;

    const style = document.createElement('style');
    style.id = 'statusDiaStyle';
    style.textContent = `
      .status-dia-box{border:1px solid #25314b;background:#101827;border-radius:18px;padding:12px;margin:12px 0;display:grid;gap:10px}
      .status-dia-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .status-dia-head h3{margin:0;font-size:15px}.status-dia-head p{margin:4px 0 0;color:#91a2c3;font-size:12px;line-height:1.35}
      .status-dia-badge{display:inline-flex;align-items:center;gap:6px;background:#172033;border:1px solid #2a3957;border-radius:999px;padding:7px 10px;font-size:12px;color:#dce7ff;white-space:nowrap}
      .status-dia-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      .status-dia-grid button{padding:10px 8px;border-radius:14px;font-size:12px;line-height:1.15}
      .status-dia-grid button.ativo{outline:2px solid #60a5fa;background:#1e3a5f;color:#fff}
      .status-dia-motivo label{display:block;color:#a9b7d6;font-size:13px}
      .status-dia-motivo input{width:100%;margin-top:6px}
      .status-dia-hint{margin:0;color:#91a2c3;font-size:12px;line-height:1.35}
      .status-dia-alerta{margin:0;color:#ffcf87;font-size:12px;line-height:1.35}
      @media(max-width:430px){.status-dia-grid{grid-template-columns:repeat(2,1fr)}}
      @media print{.status-dia-box{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function patchGarantirRegistro() {
    if (garantirRegistroOriginal || typeof garantirRegistroDoDia !== 'function') return;

    garantirRegistroOriginal = garantirRegistroDoDia;
    window.garantirRegistroDoDia = function () {
      garantirRegistroOriginal();
      const data = typeof dataSelecionada === 'function' ? dataSelecionada() : null;
      const registro = data && typeof registros !== 'undefined' ? registros[data] : null;
      normalizarStatus(registro, data);
      if (typeof salvarRegistros === 'function') salvarRegistros();
    };
  }

  function patchCalcularDia() {
    if (calcularDiaOriginal || typeof calcularDia !== 'function') return;

    calcularDiaOriginal = calcularDia;
    window.calcularDia = function (registro) {
      normalizarStatus(registro, registro && registro.data);
      const base = calcularDiaOriginal(registro);
      return aplicarStatusAoCalculo(registro, base);
    };
  }

  function patchRenderizar() {
    if (renderizarOriginal || typeof renderizar !== 'function') return;

    renderizarOriginal = renderizar;
    window.renderizar = function (atualizarHistorico) {
      const retorno = renderizarOriginal(atualizarHistorico);
      sincronizarPainelStatus();
      marcarIncompletoVisualmente();
      return retorno;
    };
  }

  function patchAtualizarStatus() {
    if (atualizarStatusOriginal || typeof atualizarStatus !== 'function') return;

    atualizarStatusOriginal = atualizarStatus;
    window.atualizarStatus = function (registro) {
      atualizarStatusOriginal(registro);
      const tipo = getTipo(registro);
      if (tipo !== 'normal' && TIPOS[tipo] && $('statusTexto')) {
        $('statusTexto').textContent = TIPOS[tipo].label;
        if ($('statusBolinha')) {
          $('statusBolinha').style.background = '#60a5fa';
          $('statusBolinha').style.boxShadow = '0 0 12px #60a5fa';
        }
      }
    };
  }

  function patchPreencherPadrao() {
    if (preencherPadraoOriginal || typeof preencherJornadaPadrao !== 'function') return;

    preencherPadraoOriginal = preencherJornadaPadrao;
    window.preencherJornadaPadrao = function () {
      preencherPadraoOriginal();
      const r = registroAtualSeguro();
      if (r) {
        r[STATUS_KEY] = 'normal';
        r[MOTIVO_KEY] = '';
        if (typeof salvarRegistros === 'function') salvarRegistros();
      }
      sincronizarPainelStatus();
      if (typeof renderizar === 'function') renderizar();
    };
  }

  function patchGerarFolhaPonto() {
    if (gerarFolhaPontoOriginal || typeof window.gerarFolhaPonto !== 'function') return;

    gerarFolhaPontoOriginal = window.gerarFolhaPonto;
    window.gerarFolhaPonto = function () {
      const backup = [];

      try {
        Object.keys(registros || {}).forEach(function (data) {
          const r = registros[data];
          const tipo = getTipo(r);
          if (tipo === 'normal') return;
          const label = statusLabel(r);
          const motivo = (r[MOTIVO_KEY] || '').trim();
          const texto = motivo ? label + ': ' + motivo : label;
          backup.push([r, r.observacao || '']);
          r.observacao = r.observacao ? r.observacao + ' | ' + texto : texto;
        });

        return gerarFolhaPontoOriginal();
      } finally {
        backup.forEach(function (item) {
          item[0].observacao = item[1];
        });
      }
    };
  }

  function montarPainelStatusDia() {
    if ($('statusDiaBox')) return;

    const secaoMarcacoes = $('marcacoes') && $('marcacoes').closest('.box');
    if (!secaoMarcacoes) return;

    const box = document.createElement('div');
    box.id = 'statusDiaBox';
    box.className = 'status-dia-box';
    box.innerHTML = `
      <div class="status-dia-head">
        <div>
          <h3>Status do dia</h3>
          <p>Use quando o RH abonar, quando tiver atestado, feriado, folga ou batida esquecida.</p>
        </div>
        <span id="statusDiaBadge" class="status-dia-badge">✅ Normal</span>
      </div>
      <div class="status-dia-grid" id="statusDiaBotoes">
        ${Object.keys(TIPOS).map(function (tipo) {
          return '<button type="button" data-tipo-dia="' + tipo + '">' + TIPOS[tipo].badge + '<br>' + TIPOS[tipo].label + '</button>';
        }).join('')}
      </div>
      <div class="status-dia-motivo">
        <label>Motivo do ajuste
          <input id="motivoDia" type="text" placeholder="Ex.: saída antecipada autorizada - jogo do Brasil">
        </label>
      </div>
      <p id="statusDiaHint" class="status-dia-hint"></p>
      <p id="statusDiaAlerta" class="status-dia-alerta"></p>
    `;

    secaoMarcacoes.insertBefore(box, $('marcacoes'));

    box.querySelectorAll('[data-tipo-dia]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        aplicarTipoDia(btn.dataset.tipoDia);
      });
    });

    $('motivoDia').addEventListener('input', function () {
      const r = registroAtualSeguro();
      if (!r) return;
      r[MOTIVO_KEY] = $('motivoDia').value;
      if (typeof salvarRegistros === 'function') salvarRegistros();
      if (typeof renderizarHistorico === 'function') renderizarHistorico();
    });

    sincronizarPainelStatus();
  }

  function aplicarTipoDia(tipo) {
    const r = registroAtualSeguro();
    if (!r || !TIPOS[tipo]) return;

    r[STATUS_KEY] = tipo;

    if (tipo === 'normal') {
      r[MOTIVO_KEY] = '';
      r.dia100 = typeof ehFimDeSemana === 'function' ? ehFimDeSemana(r.data) : false;
    }

    if (tipo === 'abonado') {
      r.dia100 = false;
      if (!r[MOTIVO_KEY]) r[MOTIVO_KEY] = 'Saída antecipada autorizada';
    }

    if (tipo === 'atestado') {
      r.dia100 = false;
      if (!r[MOTIVO_KEY]) r[MOTIVO_KEY] = 'Atestado médico';
    }

    if (tipo === 'feriado') {
      r.dia100 = false;
      if (!r[MOTIVO_KEY]) r[MOTIVO_KEY] = 'Feriado';
    }

    if (tipo === 'folga') {
      r.dia100 = true;
      if (!r[MOTIVO_KEY]) r[MOTIVO_KEY] = 'Folga';
    }

    if (tipo === 'ajuste' && !r[MOTIVO_KEY]) {
      r[MOTIVO_KEY] = 'Batida esquecida / ajuste RH';
    }

    if (typeof salvarRegistros === 'function') salvarRegistros();
    if (typeof renderizar === 'function') renderizar();
  }

  function aplicarStatusAoCalculo(registro, base) {
    if (!registro || !base) return base;

    const tipo = getTipo(registro);
    if (tipo === 'normal' || tipo === 'ajuste') return base;

    const carga = typeof horarioParaMinutos === 'function'
      ? horarioParaMinutos(config.cargaDiaria)
      : 528;

    const trabalhado = Math.max(0, base.trabalhadoPonto || 0);
    const calculo = Object.assign({}, base);

    if (tipo === 'folga') {
      calculo.ajusteRH = 0;
      calculo.totalConsiderado = trabalhado;
      calculo.descanso = base.descanso || 0;
      calculo.saldo = trabalhado;
      calculo.ex60 = 0;
      calculo.ex100 = trabalhado;
      recalcularValores(calculo);
      return calculo;
    }

    const totalConsiderado = Math.max(carga, base.totalConsiderado || 0);
    const complemento = Math.max(0, totalConsiderado - trabalhado);
    const saldo = Math.max(0, totalConsiderado - carga);

    calculo.ajusteRH = complemento;
    calculo.totalConsiderado = totalConsiderado;
    calculo.saldo = saldo;

    if (registro.dia100) {
      calculo.ex60 = 0;
      calculo.ex100 = totalConsiderado;
    } else {
      calculo.ex60 = saldo;
      calculo.ex100 = 0;
    }

    if (tipo === 'atestado' && trabalhado === 0) {
      calculo.noturno = 0;
      calculo.descanso = 0;
    }

    recalcularValores(calculo);
    return calculo;
  }

  function recalcularValores(calculo) {
    const salarioBase = numeroSeguro(config && config.salarioBase, 0);
    const divisorMensal = numeroSeguro(config && config.divisorMensal, 220);
    const periculosidade = salarioBase * numeroSeguro(config && config.periculosidadePercentual, 0) / 100;
    const valorHoraBase = config && config.valorHora
      ? numeroSeguro(config.valorHora, 0)
      : salarioBase / divisorMensal;
    const valorHoraComPericulosidade = config && config.valorHora
      ? numeroSeguro(config.valorHora, 0)
      : (salarioBase + periculosidade) / divisorMensal;

    calculo.valorEx60 = (calculo.ex60 / 60) * valorHoraComPericulosidade * (1 + numeroSeguro(config && config.percentualEx60, 60) / 100);
    calculo.valorEx100 = (calculo.ex100 / 60) * valorHoraComPericulosidade * 2;
    calculo.valorNoturno = (calculo.noturno / 60) * valorHoraBase * (numeroSeguro(config && config.adicionalNoturnoPercentual, 50) / 100);
  }

  function sincronizarPainelStatus() {
    const r = registroAtualSeguro();
    if (!r || !$('statusDiaBox')) return;

    normalizarStatus(r, r.data);
    const tipo = getTipo(r);
    const info = TIPOS[tipo] || TIPOS.normal;

    $('statusDiaBadge').textContent = info.badge + ' ' + info.label;
    $('statusDiaHint').textContent = info.hint;
    $('motivoDia').value = r[MOTIVO_KEY] || '';

    document.querySelectorAll('[data-tipo-dia]').forEach(function (btn) {
      btn.classList.toggle('ativo', btn.dataset.tipoDia === tipo);
    });
  }

  function marcarIncompletoVisualmente() {
    const r = registroAtualSeguro();
    const alvo = $('statusDiaAlerta');
    if (!r || !alvo) return;

    const tipo = getTipo(r);
    const temEntrada = !!r.entrada;
    const temSaida = !!r.saidaFinal;
    const incompleto = temEntrada && !temSaida && tipo === 'normal';

    if (incompleto) {
      alvo.textContent = '⚠️ Tem entrada sem saída final. Corrija a batida ou marque como Abonado/Ajuste RH para não virar falta indevida.';
    } else if (tipo === 'abonado') {
      alvo.textContent = 'Este dia será fechado até a carga oficial, sem saldo negativo.';
    } else if (tipo === 'atestado') {
      alvo.textContent = 'Atestado conta como jornada justificada e não entra como falta.';
    } else if (tipo === 'feriado') {
      alvo.textContent = 'Feriado sem batida não gera falta. Se trabalhar, use Folga/EX100% quando for o caso.';
    } else if (tipo === 'folga') {
      alvo.textContent = 'Folga sem batida fica zerada. Folga trabalhada entra como EX100%.';
    } else {
      alvo.textContent = '';
    }
  }

  function normalizarStatus(registro, data) {
    if (!registro) return;
    if (!registro.data && data) registro.data = data;
    if (!registro[STATUS_KEY]) registro[STATUS_KEY] = 'normal';
    if (!TIPOS[registro[STATUS_KEY]]) registro[STATUS_KEY] = 'normal';
    if (registro[MOTIVO_KEY] == null) registro[MOTIVO_KEY] = '';
  }

  function getTipo(registro) {
    if (!registro) return 'normal';
    return TIPOS[registro[STATUS_KEY]] ? registro[STATUS_KEY] : 'normal';
  }

  function statusLabel(registro) {
    const tipo = getTipo(registro);
    const info = TIPOS[tipo] || TIPOS.normal;
    return info.badge + ' ' + info.label;
  }

  function registroAtualSeguro() {
    try {
      if (typeof registroAtual === 'function') return registroAtual();
    } catch (e) {}

    try {
      const data = typeof dataSelecionada === 'function' ? dataSelecionada() : null;
      return data && typeof registros !== 'undefined' ? registros[data] : null;
    } catch (e) {
      return null;
    }
  }

  function numeroSeguro(valor, padrao) {
    if (typeof numeroCampo === 'function') return numeroCampo(valor, padrao);
    const numero = Number(String(valor ?? '').replace(',', '.'));
    return Number.isFinite(numero) ? numero : padrao;
  }

  window.getTipoDiaPonto = getTipo;
  window.statusLabelPonto = statusLabel;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStatusDia);
  } else {
    setTimeout(initStatusDia, 0);
  }
})();
