(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function initHoleriteRefinado() {
    const btn = $('btnHolerite');
    if (!btn || btn.dataset.refinado === '1') return;
    btn.dataset.refinado = '1';
    btn.addEventListener('click', function () {
      setTimeout(gerarHoleriteRefinado, 80);
    });
  }

  function gerarHoleriteRefinado() {
    if (!$('holeritePessoal')) return;
    if (typeof registros === 'undefined' || typeof config === 'undefined') return;

    const mes = ($('mesResumo') && $('mesResumo').value) || mesAtual();
    const resumo = calcularResumoRefinado(mes);

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
    const totalDescontos = numero(config.descontosFixos, 0) + numero(config.inssEstimado, 0) + numero(config.irrfEstimado, 0);
    const liquido = totalVencimentos - totalDescontos;

    const html = `
      <h3>Holerite pessoal refinado</h3>
      <p class="aviso">Prévia de ${nomeMes(mes)} separada igual espelho: extras normais, extras noturnas e noturno comum.</p>

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
      <div class="hlinha head desc"><span>Descontos</span><span>Ref.</span><b>Valor</b></div>
      ${linha('Descontos fixos', 'Manual', numero(config.descontosFixos, 0), 'desc')}
      ${linha('INSS estimado', 'Manual', numero(config.inssEstimado, 0), 'desc')}
      ${linha('IRRF estimado', 'Manual', numero(config.irrfEstimado, 0), 'desc')}
      <div class="hlinha head desc"><span>Total descontos</span><span></span><b>${moeda(totalDescontos)}</b></div>
      <div class="hlinha liq"><span>Líquido estimado</span><span></span><b>${moeda(liquido)}</b></div>

      <p class="aviso">Leitura do mês: EX60 normal ${hora(resumo.ex60Normal)}, EX60 noturna ${hora(resumo.ex60Noturna)}, EX100 normal ${hora(resumo.ex100Normal)}, EX100 noturna ${hora(resumo.ex100Noturna)}, noturno comum ${hora(resumo.noturnoComum)}.</p>
      <p class="aviso">A referência usa o padrão visual do seu holerite: 7h44 aparece como 7,44.</p>
    `;

    $('holeritePessoal').classList.add('ativo');
    $('holeritePessoal').innerHTML = html;
  }

  function calcularResumoRefinado(mes) {
    const total = {
      ex60Normal: 0,
      ex60Noturna: 0,
      ex100Normal: 0,
      ex100Noturna: 0,
      noturnoComum: 0
    };

    datasDoMes(mes).forEach(data => {
      const registro = registros[data];
      if (!registro) return;

      const calculo = calcularDia(registro);
      const intervalos = montarIntervalosLocal(registro);
      const noturnoTotal = minutosNoturnosLocal(intervalos);

      if (registro.dia100) {
        const ex100Noturna = Math.min(noturnoTotal, calculo.ex100 || 0);
        const ex100Normal = Math.max(0, (calculo.ex100 || 0) - ex100Noturna);
        total.ex100Noturna += ex100Noturna;
        total.ex100Normal += ex100Normal;
        return;
      }

      const ex60 = calculo.ex60 || 0;
      const ex60Noturna = calcularExtraNoFinalNoturna(intervalos, ex60);
      const ex60Normal = Math.max(0, ex60 - ex60Noturna);
      const noturnoComum = Math.max(0, noturnoTotal - ex60Noturna);

      total.ex60Noturna += ex60Noturna;
      total.ex60Normal += ex60Normal;
      total.noturnoComum += noturnoComum;
    });

    return total;
  }

  function montarIntervalosLocal(registro) {
    const intervalos = [];
    if (!registro || !registro.entrada) return intervalos;

    if (registro.saidaDescanso) {
      intervalos.push({ inicio: new Date(registro.entrada), fim: new Date(registro.saidaDescanso) });
      if (registro.voltaDescanso && registro.saidaFinal) {
        intervalos.push({ inicio: new Date(registro.voltaDescanso), fim: new Date(registro.saidaFinal) });
      }
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
    for (let dia = 1; dia <= ultimo; dia++) {
      out.push(`${ano}-${String(mesNumero).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
    }
    return out;
  }

  function mesAtual() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function minutos(hora) {
    const [h, m] = String(hora || '00:00').split(':').map(Number);
    return h * 60 + m;
  }

  function diferencaMinutosLocal(inicio, fim) {
    return Math.max(0, Math.round((fim - inicio) / 60000));
  }

  function referenciaEmpresa(minutos) {
    minutos = Math.max(0, Math.round(minutos || 0));
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return Number(`${h}.${String(m).padStart(2, '0')}`);
  }

  function hora(minutos) {
    minutos = Math.max(0, Math.round(minutos || 0));
    return `${String(Math.floor(minutos / 60)).padStart(2, '0')}h${String(minutos % 60).padStart(2, '0')}`;
  }

  function refTexto(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function moeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function numero(valor, fallback) {
    const n = Number(String(valor ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }

  function formatPercent(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
  }

  function nomeMes(mes) {
    const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const [ano, mesNumero] = mes.split('-');
    return `${nomes[Number(mesNumero) - 1]} de ${ano}`;
  }

  function linha(nome, ref, valor, classe = '') {
    return `<div class="hlinha ${classe}"><span>${nome}</span><span>${ref}</span><b>${moeda(valor)}</b></div>`;
  }

  window.gerarHoleriteRefinado = gerarHoleriteRefinado;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initHoleriteRefinado, 700));
  } else {
    setTimeout(initHoleriteRefinado, 700);
  }
})();
