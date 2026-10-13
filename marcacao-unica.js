(function () {
  const CAMPOS = [
    { key: 'entrada', label: 'Entrada' },
    { key: 'saidaDescanso', label: 'Saída descanso' },
    { key: 'voltaDescanso', label: 'Volta descanso' },
    { key: 'saidaFinal', label: 'Saída final' }
  ];

  function $(id) { return document.getElementById(id); }

  function initMarcacaoUnica() {
    addStyle();
    criarPainel();
    criarBotaoFlutuante();
    esconderBotoesIndividuais();
    atualizarPainel();

    document.addEventListener('click', function () {
      setTimeout(function () {
        esconderBotoesIndividuais();
        atualizarPainel();
      }, 120);
    });

    setInterval(function () {
      esconderBotoesIndividuais();
      atualizarPainel();
    }, 1500);
  }

  function addStyle() {
    if ($('marcacaoUnicaStyle')) return;
    const style = document.createElement('style');
    style.id = 'marcacaoUnicaStyle';
    style.textContent = `
      .marcacao-unica{margin-bottom:12px;background:linear-gradient(145deg,#13203a,#0d172a);border:1px solid #24324f;border-radius:18px;padding:13px;box-shadow:0 10px 26px #0002}
      .marcacao-unica h3{margin:0 0 6px;font-size:17px}
      .marcacao-unica p{margin:0;color:#94a3c7;font-size:12px;line-height:1.35}
      .marcacao-status{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:11px 0}
      .marcacao-step{background:#0b1324;border:1px solid #263653;border-radius:12px;padding:8px 5px;text-align:center;color:#91a2c3;font-size:11px}
      .marcacao-step.ok{background:#12351f;border-color:#1fa653;color:#dcffe8}
      .marcacao-step.next{background:#18315f;border-color:#3b74ff;color:#fff}
      .marcacao-actions{display:grid;grid-template-columns:1.35fr .85fr;gap:9px}
      .marcacao-actions button{width:100%;padding:12px 10px;border-radius:14px;font-size:14px}
      .marcacao-primary{background:#16a34a!important}
      .marcacao-edit{background:#24324f!important}
      .marcacao-unica select,.marcacao-unica input{margin-top:8px}
      .marcacao-unica-modal{position:fixed;inset:0;background:#000a;display:none;align-items:center;justify-content:center;padding:18px;z-index:10000}
      .marcacao-unica-modal.ativo{display:flex}
      .marcacao-unica-modal>div{width:100%;max-width:360px;background:#111a2d;border:1px solid #2b3854;border-radius:18px;padding:15px}
      .marcacao-unica-modal h3{margin:0 0 10px}.marcacao-unica-modal label{display:block;color:#a9b7d6;font-size:13px;margin-top:10px}.marcacao-unica-modal .linha-modal{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
      .marcacao-fab{position:fixed;left:18px;right:18px;bottom:calc(86px + env(safe-area-inset-bottom));z-index:9990;display:none;align-items:center;justify-content:center;gap:10px;border:0;border-radius:999px;padding:15px 18px;background:#16a34a;color:#fff;font-weight:800;font-size:16px;box-shadow:0 16px 38px #0008,0 0 0 1px #8ff5b766;transform:translateZ(0)}
      .marcacao-fab.ativo{display:flex}
      .marcacao-fab:disabled{background:#334155;color:#cbd5e1;box-shadow:0 10px 26px #0006;opacity:.92}
      .marcacao-fab small{display:block;font-weight:600;font-size:11px;opacity:.86;line-height:1;margin-top:2px}
      .marcacao-fab .fab-ico{font-size:19px;line-height:1}
      .ponto.marcacao-destaque{outline:2px solid #22c55e;box-shadow:0 0 0 6px #22c55e22,0 16px 34px #0005;transition:box-shadow .25s, outline .25s}
      @media(max-width:380px){.marcacao-status{grid-template-columns:repeat(2,1fr)}.marcacao-actions{grid-template-columns:1fr}.marcacao-fab{left:12px;right:12px;font-size:15px}}
      @media print{.marcacao-fab{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function criarPainel() {
    if ($('painelMarcacaoUnica')) return;
    const telaHoje = $('telaHoje');
    const referencia = telaHoje && telaHoje.querySelector('.grid.main');
    if (!telaHoje || !referencia) return;

    const box = document.createElement('section');
    box.id = 'painelMarcacaoUnica';
    box.className = 'marcacao-unica';
    box.innerHTML = `
      <h3>Marcação rápida</h3>
      <p id="textoProximaMarcacao">O app identifica a próxima batida automaticamente.</p>
      <div class="marcacao-status" id="statusMarcacaoUnica"></div>
      <div class="marcacao-actions">
        <button id="btnMarcarSequencia" class="marcacao-primary">Marcar agora</button>
        <button id="btnEditarSequencia" class="marcacao-edit">Editar horário</button>
      </div>
    `;
    referencia.insertAdjacentElement('beforebegin', box);

    $('btnMarcarSequencia').addEventListener('click', marcarProximaBatida);
    $('btnEditarSequencia').addEventListener('click', abrirModalEdicaoUnica);
    criarModalEdicaoUnica();
  }

  function criarBotaoFlutuante() {
    if ($('btnMarcarFlutuante')) return;
    const btn = document.createElement('button');
    btn.id = 'btnMarcarFlutuante';
    btn.className = 'marcacao-fab';
    btn.type = 'button';
    btn.innerHTML = '<span class="fab-ico">⏱️</span><span id="textoFabMarcacao">Marcar ponto<small>Batida rápida</small></span>';
    btn.addEventListener('click', marcarProximaBatida);
    document.body.appendChild(btn);
  }

  function criarModalEdicaoUnica() {
    if ($('modalMarcacaoUnica')) return;
    const modal = document.createElement('div');
    modal.id = 'modalMarcacaoUnica';
    modal.className = 'marcacao-unica-modal';
    modal.innerHTML = `
      <div>
        <h3>Editar marcação</h3>
        <label>Qual horário deseja editar?
          <select id="selectCampoEdicaoUnica">
            <option value="entrada">Entrada</option>
            <option value="saidaDescanso">Saída descanso</option>
            <option value="voltaDescanso">Volta descanso</option>
            <option value="saidaFinal">Saída final</option>
          </select>
        </label>
        <label>Novo horário
          <input type="time" id="inputHoraEdicaoUnica">
        </label>
        <div class="linha-modal">
          <button id="btnCancelarEdicaoUnica" class="ghost">Cancelar</button>
          <button id="btnSalvarEdicaoUnica">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    $('btnCancelarEdicaoUnica').addEventListener('click', fecharModalEdicaoUnica);
    $('btnSalvarEdicaoUnica').addEventListener('click', salvarEdicaoUnica);
    modal.addEventListener('click', function (e) { if (e.target === modal) fecharModalEdicaoUnica(); });
  }

  function esconderBotoesIndividuais() {
    const marcacoes = $('marcacoes');
    if (!marcacoes) return;
    marcacoes.querySelectorAll('button').forEach(function (btn) {
      const txt = (btn.textContent || '').trim().toLowerCase();
      if (txt === 'marcar' || txt === 'editar') btn.style.display = 'none';
    });
  }

  function getDataSelecionada() {
    const input = $('dataSelecionada');
    if (input && input.value) return input.value;
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function getRegistroAtual() {
    const data = getDataSelecionada();
    if (typeof registros === 'undefined') return { data: data };
    if (!registros[data]) {
      registros[data] = { data: data, entrada: null, saidaDescanso: null, voltaDescanso: null, saidaFinal: null, dia100: false, observacao: '', tipoDia: 'normal', motivoDia: '' };
    }
    return registros[data];
  }

  function proximoCampo(registro) {
    return CAMPOS.find(function (campo) { return !registro[campo.key]; }) || null;
  }

  function abaHojeAtiva() {
    return $('telaHoje') && $('telaHoje').classList.contains('ativa');
  }

  function atualizarPainel() {
    if (!$('painelMarcacaoUnica')) return;
    const registro = getRegistroAtual();
    const prox = proximoCampo(registro);
    const status = $('statusMarcacaoUnica');
    status.innerHTML = CAMPOS.map(function (campo) {
      const classe = registro[campo.key] ? 'ok' : prox && prox.key === campo.key ? 'next' : '';
      return `<div class="marcacao-step ${classe}">${registro[campo.key] ? '✅ ' : prox && prox.key === campo.key ? '➡️ ' : '• '}${campo.label}</div>`;
    }).join('');

    const btn = $('btnMarcarSequencia');
    const texto = $('textoProximaMarcacao');
    if (!prox) {
      btn.textContent = 'Dia completo';
      btn.disabled = true;
      texto.textContent = 'As quatro marcações deste dia já foram preenchidas.';
    } else {
      btn.disabled = false;
      btn.textContent = 'Marcar ' + prox.label.toLowerCase();
      texto.textContent = 'Próxima batida: ' + prox.label + '.';
    }

    atualizarBotaoFlutuante(prox);
  }

  function atualizarBotaoFlutuante(prox) {
    const btn = $('btnMarcarFlutuante');
    const texto = $('textoFabMarcacao');
    if (!btn || !texto) return;

    const mostrar = abaHojeAtiva();
    btn.classList.toggle('ativo', !!mostrar);

    if (!prox) {
      btn.disabled = true;
      texto.innerHTML = 'Dia completo<small>Batida rápida</small>';
      return;
    }

    btn.disabled = false;
    texto.innerHTML = 'Marcar ' + prox.label.toLowerCase() + '<small>Batida rápida</small>';
  }

  function criarDataHoraParaCampo(dataISO, campoKey) {
    const agora = new Date();
    const h = String(agora.getHours()).padStart(2, '0');
    const m = String(agora.getMinutes()).padStart(2, '0');
    return criarDataHoraManual(dataISO, h + ':' + m, campoKey);
  }

  function criarDataHoraManual(dataISO, hora, campoKey) {
    const partes = hora.split(':').map(Number);
    const d = new Date(dataISO + 'T00:00:00');
    d.setHours(partes[0], partes[1], 0, 0);
    if (campoKey === 'saidaFinal') {
      const entrada = getRegistroAtual().entrada ? new Date(getRegistroAtual().entrada) : null;
      if (entrada && d <= entrada) d.setDate(d.getDate() + 1);
    }
    return d.toISOString().slice(0, 19);
  }

  function marcarProximaBatida() {
    const registro = getRegistroAtual();
    const prox = proximoCampo(registro);
    if (!prox) return;
    registro[prox.key] = criarDataHoraParaCampo(registro.data || getDataSelecionada(), prox.key);
    salvarTudo();
    setTimeout(function () { rolarParaCampo(prox.key); }, 180);
  }

  function rolarParaCampo(campoKey) {
    const valor = $('h_' + campoKey);
    const alvo = valor && valor.closest ? valor.closest('.ponto') : valor;
    if (!alvo) return;

    alvo.classList.add('marcacao-destaque');
    try {
      alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      alvo.scrollIntoView(true);
    }

    setTimeout(function () {
      alvo.classList.remove('marcacao-destaque');
    }, 2200);
  }

  function abrirModalEdicaoUnica() {
    const modal = $('modalMarcacaoUnica');
    const registro = getRegistroAtual();
    const prox = proximoCampo(registro) || CAMPOS[0];
    $('selectCampoEdicaoUnica').value = prox.key;
    $('inputHoraEdicaoUnica').value = valorHoraCampo(registro[prox.key]);
    modal.classList.add('ativo');
  }

  function fecharModalEdicaoUnica() {
    $('modalMarcacaoUnica').classList.remove('ativo');
  }

  function salvarEdicaoUnica() {
    const campo = $('selectCampoEdicaoUnica').value;
    const hora = $('inputHoraEdicaoUnica').value;
    if (!hora) { alert('Escolha um horário.'); return; }
    const registro = getRegistroAtual();
    registro[campo] = criarDataHoraManual(registro.data || getDataSelecionada(), hora, campo);
    salvarTudo();
    fecharModalEdicaoUnica();
    setTimeout(function () { rolarParaCampo(campo); }, 180);
  }

  function valorHoraCampo(valor) {
    if (!valor) return '';
    const d = new Date(valor);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function salvarTudo() {
    try {
      if (typeof salvarRegistros === 'function') salvarRegistros();
      else localStorage.setItem('app_ponto_pessoal_registros_v9', JSON.stringify(registros || {}));
    } catch (e) {
      try { localStorage.setItem('app_ponto_pessoal_registros_v9', JSON.stringify(registros || {})); } catch (err) {}
    }

    try { if (typeof renderizarHoje === 'function') renderizarHoje(); } catch (e) {}
    try { if (typeof renderizarResumoMensal === 'function') renderizarResumoMensal(); } catch (e) {}
    setTimeout(function () { esconderBotoesIndividuais(); atualizarPainel(); }, 120);
  }

  window.__marcacaoUnicaMarcarProxima = marcarProximaBatida;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(initMarcacaoUnica, 900); });
  } else {
    setTimeout(initMarcacaoUnica, 900);
  }
})();
