(function () {
  'use strict';

  const STORAGE_PONTOS = 'app_ponto_pessoal_registros_v9';
  const LIMITE_MADRUGADA = 5;
  const CAMPOS = ['entrada', 'saidaDescanso', 'voltaDescanso', 'saidaFinal'];

  function $(id) {
    return document.getElementById(id);
  }

  function hojeISO() {
    const data = new Date();
    return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0') + '-' + String(data.getDate()).padStart(2, '0');
  }

  function addDias(dataISO, dias) {
    const data = new Date(dataISO + 'T12:00:00');
    data.setDate(data.getDate() + dias);
    return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0') + '-' + String(data.getDate()).padStart(2, '0');
  }

  function registrosAtuais() {
    if (typeof registros !== 'undefined') return registros;
    try { return JSON.parse(localStorage.getItem(STORAGE_PONTOS) || '{}'); } catch (e) { return {}; }
  }

  function temTurnoAberto(dataISO) {
    const r = registrosAtuais()[dataISO];
    return !!(r && r.entrada && !r.saidaFinal);
  }

  function proximoCampo(r) {
    if (!r) return 'entrada';
    return CAMPOS.find(function (campo) { return !r[campo]; }) || null;
  }

  function dataDoTurnoAtual() {
    const hoje = hojeISO();
    const ontem = addDias(hoje, -1);
    const hora = new Date().getHours();

    if (hora < LIMITE_MADRUGADA && temTurnoAberto(ontem)) return ontem;
    return hoje;
  }

  function setDataSelecionada(dataISO) {
    const input = $('dataSelecionada');
    if (!input || !dataISO) return;

    input.value = dataISO;

    try { if (typeof garantirRegistroDoDia === 'function') garantirRegistroDoDia(); } catch (e) {}
    try { if (typeof renderizar === 'function') renderizar(true); } catch (e) {}
    try { if (typeof renderizarResumoMensal === 'function') renderizarResumoMensal(); } catch (e) {}
    try { if (typeof renderizarHistorico === 'function') renderizarHistorico(); } catch (e) {}
  }

  function abrirCalendarioNativo() {
    const input = $('dataSelecionada');
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') input.showPicker();
      else input.focus();
    } catch (e) {
      input.focus();
    }
  }

  function prepararNavegacaoDeData() {
    const input = $('dataSelecionada');
    if (!input || input.dataset.turnoFixAtivo) return;
    input.dataset.turnoFixAtivo = '1';

    input.addEventListener('click', abrirCalendarioNativo);
    input.addEventListener('focus', function () {
      setTimeout(abrirCalendarioNativo, 50);
    });

    const alvo = input.closest('div') || input.parentElement;
    if (alvo && !$('turnoDataNav')) {
      const nav = document.createElement('div');
      nav.id = 'turnoDataNav';
      nav.className = 'turno-data-nav';
      nav.innerHTML = '<button type="button" id="btnDiaAnterior">◀ Dia anterior</button><button type="button" id="btnAbrirCalendario">📅 Calendário</button><button type="button" id="btnDiaSeguinte">Dia seguinte ▶</button>';
      alvo.appendChild(nav);

      $('btnDiaAnterior').addEventListener('click', function () {
        setDataSelecionada(addDias(input.value || hojeISO(), -1));
      });

      $('btnDiaSeguinte').addEventListener('click', function () {
        setDataSelecionada(addDias(input.value || hojeISO(), 1));
      });

      $('btnAbrirCalendario').addEventListener('click', abrirCalendarioNativo);
    }

    if (!$('turnoDataStyle')) {
      const style = document.createElement('style');
      style.id = 'turnoDataStyle';
      style.textContent = '.turno-data-nav{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px}.turno-data-nav button{padding:8px 6px;border-radius:11px;font-size:11px;background:#1d2b46;color:#dce8ff;border:1px solid #2d4168}.turno-alerta{margin:8px 0 0;color:#9fb5d8;font-size:11px;line-height:1.35}@media(max-width:380px){.turno-data-nav{grid-template-columns:1fr}.turno-data-nav button{font-size:12px}}';
      document.head.appendChild(style);
    }
  }

  function ajustarDataInicialDoTurno() {
    const input = $('dataSelecionada');
    if (!input) return;

    const hoje = hojeISO();
    const dataTurno = dataDoTurnoAtual();

    if ((input.value || hoje) === hoje && dataTurno !== hoje) {
      setDataSelecionada(dataTurno);
    }
  }

  function normalizarHoraDigitada(valor) {
    const limpo = String(valor || '').replace(/[^0-9:]/g, '');
    const numeros = limpo.replace(/:/g, '');

    if (numeros.length === 4) return numeros.slice(0, 2) + ':' + numeros.slice(2, 4);
    if (numeros.length === 3) return '0' + numeros.slice(0, 1) + ':' + numeros.slice(1, 3);
    return limpo;
  }

  function prepararInputsDeHora() {
    ['inputEdit', 'inputHoraEdicaoUnica'].forEach(function (id) {
      const input = $(id);
      if (!input || input.dataset.horaTextoAtivo) return;
      input.dataset.horaTextoAtivo = '1';
      try { input.type = 'text'; } catch (e) {}
      input.inputMode = 'numeric';
      input.pattern = '[0-9:]*';
      input.placeholder = '1530 ou 15:30';
      input.addEventListener('blur', function () {
        input.value = normalizarHoraDigitada(input.value);
      });
    });
  }

  function instalarOverrides() {
    if (window.__turnoNoturnoFixInstalado) return;
    window.__turnoNoturnoFixInstalado = true;

    const marcarOriginal = window.marcarPonto;
    if (typeof marcarOriginal === 'function') {
      window.marcarPonto = function (tipo) {
        const hoje = hojeISO();
        const ontem = addDias(hoje, -1);
        const input = $('dataSelecionada');
        const hora = new Date().getHours();

        if (hora < LIMITE_MADRUGADA && input && (input.value || hoje) === hoje && temTurnoAberto(ontem)) {
          const registroOntem = registrosAtuais()[ontem];
          const campoCorreto = proximoCampo(registroOntem) || tipo;
          setDataSelecionada(ontem);
          return marcarOriginal.call(this, campoCorreto);
        }

        return marcarOriginal.apply(this, arguments);
      };
    }

    window.irParaHoje = function () {
      setDataSelecionada(dataDoTurnoAtual());
    };

    const abrirDiaOriginal = window.abrirDia;
    if (typeof abrirDiaOriginal === 'function') {
      window.abrirDia = function (data) {
        setDataSelecionada(data);
        try { if (typeof trocarAba === 'function') trocarAba('Hoje', document.querySelector('.nav button')); } catch (e) {}
      };
    }
  }

  function initTurnoNoturnoFix() {
    prepararNavegacaoDeData();
    prepararInputsDeHora();
    instalarOverrides();
    ajustarDataInicialDoTurno();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(initTurnoNoturnoFix, 1200);
    });
  } else {
    setTimeout(initTurnoNoturnoFix, 1200);
  }

  setInterval(function () {
    prepararInputsDeHora();
    ajustarDataInicialDoTurno();
  }, 30000);
})();
