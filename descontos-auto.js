(function () {
  const AUTO_KEY = 'app_ponto_descontos_auto_v1';

  const DEFAULTS = {
    enabled: true,
    dependentes: 0,
    pensao: 0,
    outrosDescontos: 0,
    usarSimplificado: true
  };

  const INSS_TABLE = [
    { limit: 1518.00, rate: 0.075 },
    { limit: 2793.88, rate: 0.09 },
    { limit: 4190.83, rate: 0.12 },
    { limit: 8157.41, rate: 0.14 }
  ];

  const IRRF_TABLE = [
    { limit: 2428.80, rate: 0, deduction: 0 },
    { limit: 2826.65, rate: 0.075, deduction: 142.80 },
    { limit: 3751.05, rate: 0.15, deduction: 354.80 },
    { limit: 4664.68, rate: 0.225, deduction: 636.13 },
    { limit: Infinity, rate: 0.275, deduction: 869.36 }
  ];

  const DEPENDENTE_IR = 189.59;
  const DESCONTO_SIMPLIFICADO = 607.20;

  let autoConfig = loadAutoConfig();

  function $(id) {
    return document.getElementById(id);
  }

  function loadAutoConfig() {
    try {
      return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(AUTO_KEY) || '{}')) };
    } catch (e) {
      return { ...DEFAULTS };
    }
  }

  function saveAutoConfig() {
    localStorage.setItem(AUTO_KEY, JSON.stringify(autoConfig));
  }

  function initAutoDiscounts() {
    addAutoConfigUI();

    const btn = $('btnHolerite');
    if (btn && btn.dataset.autoDiscounts !== '1') {
      btn.dataset.autoDiscounts = '1';
      btn.addEventListener('click', function () {
        setTimeout(gerarHoleriteComDescontosAutomaticos, 180);
      });
    }

    document.addEventListener('click', function (event) {
      if (event.target && event.target.id === 'btnPDF') {
        setTimeout(gerarHoleriteComDescontosAutomaticos, 80);
      }
    });
  }

  function addAutoConfigUI() {
    const tela = $('telaConfig');
    if (!tela || $('descontosAutoBox')) return;

    const box = document.createElement('section');
    box.className = 'box extra-box';
    box.id = 'descontosAutoBox';
    box.innerHTML = `
      <h3>Descontos automáticos</h3>
      <label class="extra-check"><input type="checkbox" id="autoDescontosEnabled"> Calcular INSS e IRRF automaticamente</label>
      <div class="extra-row">
        <label>Dependentes IR<input id="autoDependentes" type="number" min="0" step="1"></label>
        <label>Pensão dedutível<input id="autoPensao" type="number" min="0" step="0.01"></label>
        <label>Outros descontos<input id="autoOutros" type="number" min="0" step="0.01"></label>
        <label>Desconto simplificado<input id="autoSimplificado" type="checkbox"></label>
      </div>
      <p class="extra-note">O cálculo automático usa INSS progressivo e IRRF mensal com dependentes, pensão e opção de desconto simplificado. Confira sempre com o holerite real.</p>
    `;

    tela.appendChild(box);

    $('autoDescontosEnabled').checked = !!autoConfig.enabled;
    $('autoDependentes').value = autoConfig.dependentes;
    $('autoPensao').value = autoConfig.pensao;
    $('autoOutros').value = autoConfig.outrosDescontos;
    $('autoSimplificado').checked = !!autoConfig.usarSimplificado;

    ['autoDescontosEnabled', 'autoDependentes', 'autoPensao', 'autoOutros', 'autoSimplificado'].forEach(id => {
      $(id).addEventListener('change', saveAutoForm);
    });
  }

  function saveAutoForm() {
    autoConfig.enabled = $('autoDescontosEnabled').checked;
    autoConfig.dependentes = Math.max(0, Math.floor(numero($('autoDependentes').value, 0)));
    autoConfig.pensao = Math.max(0, numero($('autoPensao').value, 0));
    autoConfig.outrosDescontos = Math.max(0, numero($('autoOutros').value, 0));
    autoConfig.usarSimplificado = $('autoSimplificado').checked;
    saveAutoConfig();
  }

  function gerarHoleriteComDescontosAutomaticos() {
    if (!autoConfig.enabled) return;
    if (!$('holeritePessoal')) return;
    if (typeof registros === 'undefined' || typeof config === 'undefined' || typeof calcularDia !== 'function') return;

    const mes = ($('mesResumo') && $('mesResumo').value) || mesAtual();
    const resumo = calcularResumoRefinadoLocal(mes);

    const salarioBase = numero(config.salarioBase, 0);
    const divisorMensal = numero(config.divisorMensal, 220);
    const periculosidadePercentual = numero(config.periculosidadePercentual, 0);
    const adicionalNoturnoPercentual = numero(config.adicionalNoturnoPercentual, 50);
    const dsrPercentual = numero(config.dsrPercentual, 0);
    const percentualEx60 = numero(config.percentualEx60, 60);

    const periculosidade = salarioBase * periculosidadePercentual / 100;
    const valorHoraBase = salarioBase / divisorMensal;
    const valorHoraComPericulosidade = (salarioBase + periculosidade) / divisorMensal;

    const refEx60Normal = referenciaEmpresa(resumo.ex60Normal);
    const refEx60Noturna = referenciaEmpresa(resumo.ex60Noturna);
    const refEx100Normal = referenciaEmpresa(resumo.ex100Normal);
    const refEx100Noturna = referenciaEmpresa(resumo.ex100Noturna);
    const refNoturnoComum = referenciaEmpresa(resumo.noturnoComum);

    const valorEx60Normal = refEx60Normal * valorHoraComPericulosidade * (1 + percentualEx60 / 100);
    const valorEx60Noturna = refEx60Noturna * valorHoraComPericulosidade * 2;
    const valorEx100Normal = refEx100Normal * valorHoraComPericulosidade * 2;
    const valorEx100Noturna = refEx100Noturna * valorHoraComPericulosidade * 2;
    const valorNoturnoComum = refNoturnoComum * valorHoraBase * (adicionalNoturnoPercentual / 100);

    const totalVariaveis = valorEx60Normal + valorEx60Noturna + valorEx100Normal + valorEx100Noturna + valorNoturnoComum;
    const reflexoDSR = totalVariaveis * dsrPercentual / 100;
    const totalVencimentos = salarioBase + periculosidade + totalVariaveis + reflexoDSR;

    const inss = calcularINSS(totalVencimentos);
    const irrfDetalhe = calcularIRRF(totalVencimentos, inss);
    const outros = numero(autoConfig.outrosDescontos, 0);
    const totalDescontos = inss + irrfDetalhe.valor + outros;
    const liquido = totalVencimentos - totalDescontos;

    $('holeritePessoal').classList.add('ativo');
    $('holeritePessoal').innerHTML = `
      <h3>Holerite pessoal refinado</h3>
      <p class="aviso">Prévia de ${nomeMes(mes)} com INSS e IRRF automáticos.</p>
      <div class="hlinha head"><span>Provento</span><span>Ref.</span><b>Valor</b></div>
      ${linha('Salário base', 'Mensal', salarioBase)}
      ${linha('Periculosidade ' + formatPercent(periculosidadePercentual), formatPercent(periculosidadePercentual), periculosidade)}
      ${linha('EX' + percentualEx60 + '% normal', refTexto(refEx60Normal), valorEx60Normal)}
      ${linha('EX' + percentualEx60 + '% noturna', refTexto(refEx60Noturna), valorEx60Noturna)}
      ${linha('EX100% normal', refTexto(refEx100Normal), valorEx100Normal)}
      ${linha('EX100% noturna', refTexto(refEx100Noturna), valorEx100Noturna)}
      ${linha('Adicional noturno comum ' + formatPercent(adicionalNoturnoPercentual), refTexto(refNoturnoComum), valorNoturnoComum)}
      ${linha('Reflexo DSR ' + formatPercent(dsrPercentual), formatPercent(dsrPercentual), reflexoDSR)}
      <div class="hlinha head"><span>Total vencimentos</span><span></span><b>${moeda(totalVencimentos)}</b></div>
      <div class="hlinha head desc"><span>Descontos automáticos</span><span>Ref.</span><b>Valor</b></div>
      ${linha('INSS automático', 'Progressivo', inss, 'desc')}
      ${linha('IRRF automático', 'Base ' + moeda(irrfDetalhe.base), irrfDetalhe.valor, 'desc')}
      ${outros > 0 ? linha('Outros descontos', 'Manual', outros, 'desc') : ''}
      <div class="hlinha head desc"><span>Total descontos</span><span></span><b>${moeda(totalDescontos)}</b></div>
      <div class="hlinha liq"><span>Líquido estimado</span><span></span><b>${moeda(liquido)}</b></div>
      <p class="aviso">IRRF: dependentes ${autoConfig.dependentes}, pensão ${moeda(autoConfig.pensao)}, dedução usada ${moeda(irrfDetalhe.deducaoUsada)}.</p>
      <p class="aviso">Leitura do mês: EX60 normal ${hora(resumo.ex60Normal)}, EX60 noturna ${hora(resumo.ex60Noturna)}, EX100 normal ${hora(resumo.ex100Normal)}, EX100 noturna ${hora(resumo.ex100Noturna)}, noturno comum ${hora(resumo.noturnoComum)}.</p>
    `;
  }

  function calcularINSS(base) {
    let anterior = 0;
    let total = 0;
    for (const faixa of INSS_TABLE) {
      if (base > anterior) {
        const tributavel = Math.min(base, faixa.limit) - anterior;
        total += Math.max(0, tributavel) * faixa.rate;
      }
      anterior = faixa.limit;
      if (base <= faixa.limit) break;
    }
    return arredondar(total);
  }

  function calcularIRRF(totalVencimentos, inss) {
    const deducoesLegais = inss + autoConfig.pensao + autoConfig.dependentes * DEPENDENTE_IR;
    const deducaoUsada = autoConfig.usarSimplificado ? Math.max(deducoesLegais, DESCONTO_SIMPLIFICADO) : deducoesLegais;
    const base = Math.max(0, totalVencimentos - deducaoUsada);
    const faixa = IRRF_TABLE.find(item => base <= item.limit) || IRRF_TABLE[IRRF_TABLE.length - 1];
    const valor = Math.max(0, base * faixa.rate - faixa.deduction);
    return { base: arredondar(base), valor: arredondar(valor), deducaoUsada: arredondar(deducaoUsada) };
  }

  function calcularResumoRefinadoLocal(mes) {
    const total = { ex60Normal: 0, ex60Noturna: 0, ex100Normal: 0, ex100Noturna: 0, noturnoComum: 0 };
    datasDoMes(mes).forEach(data => {
      const registro = registros[data];
      if (!registro) return;
      const calculo = calcularDia(registro);
      const intervalos = montarIntervalosLocal(registro);
      const noturnoTotal = minutosNoturnosLocal(intervalos);
      if (registro.dia100) {
        const ex100Noturna = Math.min(noturnoTotal, calculo.ex100 || 0);
        total.ex100Noturna += ex100Noturna;
        total.ex100Normal += Math.max(0, (calculo.ex100 || 0) - ex100Noturna);
        return;
      }
      const ex60 = calculo.ex60 || 0;
      const ex60Noturna = calcularExtraNoFinalNoturna(intervalos, ex60);
      total.ex60Noturna += ex60Noturna;
      total.ex60Normal += Math.max(0, ex60 - ex60Noturna);
      total.noturnoComum += Math.max(0, noturnoTotal - ex60Noturna);
    });
    return total;
  }

  function montarIntervalosLocal(registro) {
    const intervalos = [];
    if (!registro || !registro.entrada) return intervalos;
    if (registro.saidaDescanso) {
      intervalos.push({ inicio: new Date(registro.entrada), fim: new Date(registro.saidaDescanso) });
      if (registro.voltaDescanso && registro.saidaFinal) intervalos.push({ inicio: new Date(registro.voltaDescanso), fim: new Date(registro.saidaFinal) });
    } else if (registro.saidaFinal) {
      intervalos.push({ inicio: new Date(registro.entrada), fim: new Date(registro.saidaFinal) });
    }
    return intervalos.filter(i => i.fim > i.inicio);
  }

  function calcularExtraNoFinalNoturna(intervalos, minutosExtra) {
    let restante = Math.max(0, Math.round(minutosExtra || 0));
    let noturna = 0;
    for (let i = intervalos.length - 1; i >= 0 && restante > 0; i--) {
      const intervalo = intervalos[i];
      const duracao = diferencaMinutosLocal(intervalo.inicio, intervalo.fim);
      const pegar = Math.min(restante, duracao);
      const inicioExtra = new Date(intervalo.fim.getTime() - pegar * 60000);
      noturna += minutosNoturnosLocal([{ inicio: inicioExtra, fim: intervalo.fim }]);
      restante -= pegar;
    }
    return noturna;
  }

  function minutosNoturnosLocal(intervalos) {
    return intervalos.reduce((soma, intervalo) => soma + noturnoIntervalo(intervalo.inicio, intervalo.fim), 0);
  }

  function noturnoIntervalo(inicio, fim) {
    const ini = minutos(config.inicioNoturno || '22:00');
    const end = minutos(config.fimNoturno || '05:00');
    let total = 0;
    const base = new Date(inicio);
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() - 1);
    for (let i = 0; i < 4; i++) {
      const dia = new Date(base);
      dia.setDate(dia.getDate() + i);
      const janelaInicio = new Date(dia);
      janelaInicio.setHours(Math.floor(ini / 60), ini % 60, 0, 0);
      const janelaFim = new Date(dia);
      if (end <= ini) janelaFim.setDate(janelaFim.getDate() + 1);
      janelaFim.setHours(Math.floor(end / 60), end % 60, 0, 0);
      const a = Math.max(inicio.getTime(), janelaInicio.getTime());
      const b = Math.min(fim.getTime(), janelaFim.getTime());
      if (b > a) total += Math.round((b - a) / 60000);
    }
    return total;
  }

  function datasDoMes(mes) {
    const [ano, mesNumero] = mes.split('-').map(Number);
    const ultimo = new Date(ano, mesNumero, 0).getDate();
    const out = [];
    for (let dia = 1; dia <= ultimo; dia++) out.push(`${ano}-${String(mesNumero).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
    return out;
  }

  function mesAtual() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  function minutos(hora) { const [h, m] = String(hora || '00:00').split(':').map(Number); return h * 60 + m; }
  function diferencaMinutosLocal(inicio, fim) { return Math.max(0, Math.round((fim - inicio) / 60000)); }
  function referenciaEmpresa(minutos) { minutos = Math.max(0, Math.round(minutos || 0)); return Number(`${Math.floor(minutos / 60)}.${String(minutos % 60).padStart(2, '0')}`); }
  function hora(minutos) { minutos = Math.max(0, Math.round(minutos || 0)); return `${String(Math.floor(minutos / 60)).padStart(2, '0')}h${String(minutos % 60).padStart(2, '0')}`; }
  function refTexto(valor) { return Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function moeda(valor) { return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function numero(valor, fallback) { const n = Number(String(valor ?? '').replace(',', '.')); return Number.isFinite(n) ? n : fallback; }
  function arredondar(valor) { return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100; }
  function formatPercent(valor) { return Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%'; }
  function nomeMes(mes) { const nomes = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']; const [ano, mesNumero] = mes.split('-'); return `${nomes[Number(mesNumero) - 1]} de ${ano}`; }
  function linha(nome, ref, valor, classe = '') { return `<div class="hlinha ${classe}"><span>${nome}</span><span>${ref}</span><b>${moeda(valor)}</b></div>`; }

  window.gerarHoleriteComDescontosAutomaticos = gerarHoleriteComDescontosAutomaticos;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(initAutoDiscounts, 1000));
  else setTimeout(initAutoDiscounts, 1000);
})();
