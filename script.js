const STORAGE_PONTOS = "app_ponto_pessoal_registros_v9";
const STORAGE_CONFIG = "app_ponto_pessoal_config_v9";

const PADRAO = {
  entrada: "15:30",
  saidaDescanso: "19:00",
  voltaDescanso: "20:00",
  saidaFinal: "01:00",

  cargaDiaria: "08:48",
  ajusteRHMaximo: "00:18",
  inicioNoturno: "22:00",
  fimNoturno: "05:00",

  valorHora: "",
  percentualEx60: 60,

  salarioBase: 4473.00,
  divisorMensal: 220,
  periculosidadePercentual: 30,
  adicionalNoturnoPercentual: 50,
  dsrPercentual: 24,
  descontosFixos: 1680.78,
  inssEstimado: 988.07,
  irrfEstimado: 1433.86
};

let registros = JSON.parse(localStorage.getItem(STORAGE_PONTOS) || "{}");
let config = {
  ...PADRAO,
  ...(JSON.parse(localStorage.getItem(STORAGE_CONFIG) || "{}"))
};

let tipoEditando = null;

function el(id) {
  return document.getElementById(id);
}

function boot() {
  el("dataSelecionada").value = hojeISO();
  el("mesResumo").value = hojeMesISO();

  montarConfiguracoes();
  carregarConfigNaTela();
  montarMarcacoes();

  garantirRegistroDoDia();
  renderizar();

  el("dataSelecionada").addEventListener("change", () => {
    garantirRegistroDoDia();
    renderizar();
  });

  el("mesResumo").addEventListener("change", renderizarResumoMensal);

  el("btnHoje").addEventListener("click", irParaHoje);
  el("btnPadrao").addEventListener("click", preencherJornadaPadrao);
  el("btnApagar").addEventListener("click", apagarDia);
  el("btnCSV").addEventListener("click", exportarCSV);
  el("btnHolerite").addEventListener("click", gerarHoleritePessoal);

  el("dia100").addEventListener("change", () => {
    const registro = registroAtual();
    registro.dia100 = el("dia100").checked;
    salvarRegistros();
    renderizar();
  });

  el("observacao").addEventListener("input", () => {
    const registro = registroAtual();
    registro.observacao = el("observacao").value;
    salvarRegistros();
    renderizarHistorico();
    renderizarResumoMensal();
  });

  el("btnCancelar").addEventListener("click", fecharModal);
  el("btnSalvarEdit").addEventListener("click", salvarEdicao);

  el("modal").addEventListener("click", evento => {
    if (evento.target === el("modal")) fecharModal();
  });

  document.querySelectorAll(".nav button").forEach(botao => {
    botao.addEventListener("click", () => trocarAba(botao.dataset.tab, botao));
  });

  setInterval(() => {
    renderizar(false);
  }, 30000);
}

function montarConfiguracoes() {
  const campos = [
    ["cargaDiaria", "Carga diária oficial", "time"],
    ["ajusteRHMaximo", "Ajuste RH máximo", "time"],
    ["inicioNoturno", "Início adicional noturno", "time"],
    ["fimNoturno", "Fim adicional noturno", "time"],
    ["valorHora", "Valor da hora manual", "number"],
    ["percentualEx60", "Percentual EX60", "number"],
    ["salarioBase", "Salário base", "number"],
    ["divisorMensal", "Divisor mensal", "number"],
    ["periculosidadePercentual", "Periculosidade %", "number"],
    ["adicionalNoturnoPercentual", "Adicional noturno %", "number"],
    ["dsrPercentual", "DSR variáveis %", "number"],
    ["descontosFixos", "Descontos fixos", "number"],
    ["inssEstimado", "INSS estimado", "number"],
    ["irrfEstimado", "IRRF estimado", "number"]
  ];

  el("configForm").innerHTML = campos.map(([id, nome, tipo]) => `
    <label>
      ${nome}
      <input id="${id}" type="${tipo}" step="0.01">
    </label>
  `).join("");

  campos.forEach(([id]) => {
    el(id).addEventListener("change", salvarConfig);
  });
}

function carregarConfigNaTela() {
  Object.keys(PADRAO).forEach(chave => {
    if (el(chave)) el(chave).value = config[chave] ?? "";
  });

  salvarConfigLocal();
}

function salvarConfig() {
  Object.keys(PADRAO).forEach(chave => {
    const campo = el(chave);
    if (!campo) return;

    if (campo.type === "number") {
      config[chave] = numeroCampo(campo.value, PADRAO[chave]);
    } else {
      config[chave] = campo.value || PADRAO[chave];
    }
  });

  salvarConfigLocal();
  renderizar();
}

function salvarConfigLocal() {
  localStorage.setItem(STORAGE_CONFIG, JSON.stringify(config));
}

function montarMarcacoes() {
  const itens = [
    ["entrada", "Entrada"],
    ["saidaDescanso", "Saída descanso"],
    ["voltaDescanso", "Volta descanso"],
    ["saidaFinal", "Saída final"]
  ];

  el("marcacoes").innerHTML = itens.map(([tipo, nome]) => `
    <div class="ponto">
      <div>
        <small>${nome}</small><br>
        <b id="h_${tipo}">--:--</b>
      </div>

      <div class="acoes">
        <button onclick="marcarPonto('${tipo}')">Marcar</button>
        <button class="ghost" onclick="editarPonto('${tipo}')">Editar</button>
      </div>
    </div>
  `).join("");
}

function hojeISO() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function hojeMesISO() {
  return hojeISO().slice(0, 7);
}

function dataSelecionada() {
  return el("dataSelecionada").value || hojeISO();
}

function garantirRegistroDoDia() {
  const data = dataSelecionada();

  if (!registros[data]) {
    registros[data] = {
      data,
      entrada: null,
      saidaDescanso: null,
      voltaDescanso: null,
      saidaFinal: null,
      dia100: ehFimDeSemana(data),
      observacao: ""
    };
  }

  normalizarRegistro(registros[data]);
  salvarRegistros();
}

function registroAtual() {
  garantirRegistroDoDia();
  return registros[dataSelecionada()];
}

function salvarRegistros() {
  localStorage.setItem(STORAGE_PONTOS, JSON.stringify(registros));
}

function ehFimDeSemana(dataISO) {
  const dia = new Date(`${dataISO}T12:00:00`).getDay();
  return dia === 0 || dia === 6;
}

function criarISO(dataISO, hora, referenciaISO = null) {
  const novaData = new Date(`${dataISO}T${hora}:00`);

  if (referenciaISO) {
    const referencia = new Date(referenciaISO);

    while (novaData <= referencia) {
      novaData.setDate(novaData.getDate() + 1);
    }
  }

  return dataParaISO(novaData);
}

function dataParaISO(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}T${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}:00`;
}

function referenciaAnterior(registro, tipo) {
  if (tipo === "saidaDescanso") return registro.entrada;
  if (tipo === "voltaDescanso") return registro.saidaDescanso || registro.entrada;
  if (tipo === "saidaFinal") return registro.voltaDescanso || registro.saidaDescanso || registro.entrada;

  return null;
}

function normalizarRegistro(registro) {
  const ordem = ["entrada", "saidaDescanso", "voltaDescanso", "saidaFinal"];
  let anterior = null;

  ordem.forEach(tipo => {
    if (!registro[tipo]) return;

    const atual = new Date(registro[tipo]);

    if (anterior) {
      while (atual <= anterior) {
        atual.setDate(atual.getDate() + 1);
      }

      registro[tipo] = dataParaISO(atual);
    }

    anterior = new Date(registro[tipo]);
  });
}

function preencherJornadaPadrao() {
  const registro = registroAtual();
  const data = dataSelecionada();

  if (
    registro.entrada ||
    registro.saidaDescanso ||
    registro.voltaDescanso ||
    registro.saidaFinal
  ) {
    const confirmar = confirm("Este dia já tem marcações. Deseja substituir?");
    if (!confirmar) return;
  }

  registro.entrada = criarISO(data, PADRAO.entrada);
  registro.saidaDescanso = criarISO(data, PADRAO.saidaDescanso, registro.entrada);
  registro.voltaDescanso = criarISO(data, PADRAO.voltaDescanso, registro.saidaDescanso);
  registro.saidaFinal = criarISO(data, PADRAO.saidaFinal, registro.voltaDescanso);
  registro.dia100 = ehFimDeSemana(data);

  salvarRegistros();
  renderizar();
}

function marcarPonto(tipo) {
  const registro = registroAtual();

  if (registro[tipo]) {
    const confirmar = confirm("Essa marcação já existe. Deseja substituir pelo horário atual?");
    if (!confirmar) return;
  }

  const horaAtual = new Date().toTimeString().slice(0, 5);
  registro[tipo] = criarISO(dataSelecionada(), horaAtual, referenciaAnterior(registro, tipo));

  normalizarRegistro(registro);
  salvarRegistros();
  renderizar();
}

function editarPonto(tipo) {
  const registro = registroAtual();
  tipoEditando = tipo;

  const nomes = {
    entrada: "Entrada",
    saidaDescanso: "Saída descanso",
    voltaDescanso: "Volta descanso",
    saidaFinal: "Saída final"
  };

  el("tituloModal").textContent = `Editar ${nomes[tipo]}`;
  el("inputEdit").value = registro[tipo] ? horaParaInput(registro[tipo]) : "";
  el("modal").classList.add("ativo");
}

function salvarEdicao() {
  if (!tipoEditando) return;

  const novoHorario = el("inputEdit").value;

  if (!novoHorario) {
    alert("Escolha um horário válido.");
    return;
  }

  const registro = registroAtual();
  registro[tipoEditando] = criarISO(
    dataSelecionada(),
    novoHorario,
    referenciaAnterior(registro, tipoEditando)
  );

  normalizarRegistro(registro);
  salvarRegistros();
  fecharModal();
  renderizar();
}

function fecharModal() {
  el("modal").classList.remove("ativo");
  tipoEditando = null;
}

function horaParaInput(valor) {
  const data = new Date(valor);
  return `${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
}

function renderizar(atualizarHistorico = true) {
  const registro = registroAtual();
  normalizarRegistro(registro);

  ["entrada", "saidaDescanso", "voltaDescanso", "saidaFinal"].forEach(tipo => {
    el(`h_${tipo}`).textContent = formatarHora(registro[tipo], registro.data);
  });

  el("dia100").checked = !!registro.dia100;
  el("observacao").value = registro.observacao || "";

  const calculo = calcularDia(registro);

  el("totalPonto").textContent = minutosParaHora(calculo.trabalhadoPonto);
  el("ajusteRH").textContent = minutosParaHora(calculo.ajusteRH);
  el("totalConsiderado").textContent = minutosParaHora(calculo.totalConsiderado);
  el("totalDescanso").textContent = minutosParaHora(calculo.descanso);
  el("saldoDia").textContent = formatarSaldo(calculo.saldo);
  el("ex60").textContent = minutosParaHora(calculo.ex60);
  el("ex100").textContent = minutosParaHora(calculo.ex100);
  el("adNoturno").textContent = minutosParaHora(calculo.noturno);

  el("valorEx60").textContent = dinheiro(calculo.valorEx60);
  el("valorEx100").textContent = dinheiro(calculo.valorEx100);
  el("valorNoturno").textContent = dinheiro(calculo.valorNoturno);

  atualizarStatus(registro);
  renderizarResumoMensal();

  if (atualizarHistorico) renderizarHistorico();
}

function atualizarStatus(registro) {
  let texto = "Aguardando";
  let cor = "#f2c94c";

  if (registro.entrada && !registro.saidaDescanso && !registro.saidaFinal) {
    texto = "Trabalhando";
    cor = "#4ade80";
  }

  if (registro.saidaDescanso && !registro.voltaDescanso) {
    texto = "Em descanso";
    cor = "#f59e0b";
  }

  if (registro.voltaDescanso && !registro.saidaFinal) {
    texto = "Trabalhando";
    cor = "#4ade80";
  }

  if (registro.saidaFinal) {
    texto = "Encerrado";
    cor = "#60a5fa";
  }

  el("statusTexto").textContent = texto;
  el("statusBolinha").style.background = cor;
  el("statusBolinha").style.boxShadow = `0 0 12px ${cor}`;
}

function calcularDia(registro) {
  const cargaDiaria = horarioParaMinutos(config.cargaDiaria);
  const ajusteMaximo = horarioParaMinutos(config.ajusteRHMaximo);

  const intervalos = montarIntervalos(registro);

  const trabalhadoPonto = intervalos.reduce((total, intervalo) => {
    return total + diferencaMinutos(intervalo.inicio, intervalo.fim);
  }, 0);

  let descanso = 0;

  if (registro.saidaDescanso && registro.voltaDescanso) {
    descanso = diferencaMinutos(
      new Date(registro.saidaDescanso),
      new Date(registro.voltaDescanso)
    );
  }

  let ajusteRH = 0;
  const falta = cargaDiaria - trabalhadoPonto;

  if (
    registro.entrada &&
    registro.saidaDescanso &&
    registro.voltaDescanso &&
    registro.saidaFinal &&
    !registro.dia100 &&
    !ehFimDeSemana(registro.data) &&
    falta > 0 &&
    falta <= ajusteMaximo
  ) {
    ajusteRH = falta;
  }

  const totalConsiderado = trabalhadoPonto + ajusteRH;

  let saldo = 0;
  let ex60 = 0;
  let ex100 = 0;

  if (registro.dia100) {
    saldo = totalConsiderado;
    ex100 = totalConsiderado;
  } else {
    saldo = totalConsiderado - cargaDiaria;
    ex60 = Math.max(0, saldo);
  }

  const noturno = calcularNoturno(intervalos);

  const salarioBase = numeroCampo(config.salarioBase, 0);
  const divisorMensal = numeroCampo(config.divisorMensal, 220);
  const periculosidade = salarioBase * numeroCampo(config.periculosidadePercentual, 0) / 100;

  const valorHoraBase = config.valorHora
    ? numeroCampo(config.valorHora, 0)
    : salarioBase / divisorMensal;

  const valorHoraComPericulosidade = config.valorHora
    ? numeroCampo(config.valorHora, 0)
    : (salarioBase + periculosidade) / divisorMensal;

  const valorEx60 = (ex60 / 60) * valorHoraComPericulosidade * (1 + numeroCampo(config.percentualEx60, 60) / 100);
  const valorEx100 = (ex100 / 60) * valorHoraComPericulosidade * 2;
  const valorNoturno = (noturno / 60) * valorHoraBase * (numeroCampo(config.adicionalNoturnoPercentual, 50) / 100);

  return {
    trabalhadoPonto,
    ajusteRH,
    totalConsiderado,
    descanso,
    saldo,
    ex60,
    ex100,
    noturno,
    valorEx60,
    valorEx100,
    valorNoturno
  };
}

function montarIntervalos(registro) {
  const intervalos = [];

  if (!registro.entrada) return intervalos;

  if (registro.saidaDescanso) {
    intervalos.push({
      inicio: new Date(registro.entrada),
      fim: new Date(registro.saidaDescanso)
    });

    if (registro.voltaDescanso && registro.saidaFinal) {
      intervalos.push({
        inicio: new Date(registro.voltaDescanso),
        fim: new Date(registro.saidaFinal)
      });
    }
  } else if (registro.saidaFinal) {
    intervalos.push({
      inicio: new Date(registro.entrada),
      fim: new Date(registro.saidaFinal)
    });
  }

  return intervalos.filter(intervalo => intervalo.fim > intervalo.inicio);
}

function calcularNoturno(intervalos) {
  let total = 0;

  intervalos.forEach(intervalo => {
    total += minutosNoturnos(intervalo.inicio, intervalo.fim);
  });

  return total;
}

function minutosNoturnos(inicio, fim) {
  const inicioNoturno = horarioParaMinutos(config.inicioNoturno);
  const fimNoturno = horarioParaMinutos(config.fimNoturno);

  let total = 0;
  const base = new Date(inicio);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() - 1);

  for (let i = 0; i < 4; i++) {
    const diaBase = new Date(base);
    diaBase.setDate(diaBase.getDate() + i);

    const janelaInicio = new Date(diaBase);
    janelaInicio.setHours(Math.floor(inicioNoturno / 60), inicioNoturno % 60, 0, 0);

    const janelaFim = new Date(diaBase);

    if (fimNoturno <= inicioNoturno) {
      janelaFim.setDate(janelaFim.getDate() + 1);
    }

    janelaFim.setHours(Math.floor(fimNoturno / 60), fimNoturno % 60, 0, 0);

    const ini = Math.max(inicio.getTime(), janelaInicio.getTime());
    const fimCalc = Math.min(fim.getTime(), janelaFim.getTime());

    if (fimCalc > ini) {
      total += Math.round((fimCalc - ini) / 60000);
    }
  }

  return total;
}

function renderizarResumoMensal() {
  const mes = el("mesResumo").value || hojeMesISO();
  const cargaDiaria = horarioParaMinutos(config.cargaDiaria);

  let normais = 0;
  let ajuste = 0;
  let ex60 = 0;
  let ex100 = 0;
  let noturno = 0;
  let descanso = 0;
  let saldo = 0;
  let dias = 0;
  let folgas = 0;

  gerarDatasDoMes(mes).forEach(data => {
    const registro = registros[data];

    if (!registro) {
      if (ehFimDeSemana(data)) folgas++;
      return;
    }

    const calculo = calcularDia(registro);

    if (calculo.totalConsiderado > 0) dias++;
    if (ehFimDeSemana(data) && calculo.totalConsiderado === 0) folgas++;

    if (!registro.dia100) {
      normais += Math.min(calculo.totalConsiderado, cargaDiaria);
    }

    ajuste += calculo.ajusteRH;
    ex60 += calculo.ex60;
    ex100 += calculo.ex100;
    noturno += calculo.noturno;
    descanso += calculo.descanso;
    saldo += calculo.saldo;
  });

  el("mesNormais").textContent = minutosParaHoraLonga(normais);
  el("mesAjusteRH").textContent = minutosParaHoraLonga(ajuste);
  el("mesEx60").textContent = minutosParaHoraLonga(ex60);
  el("mesEx100").textContent = minutosParaHoraLonga(ex100);
  el("mesNoturno").textContent = minutosParaHoraLonga(noturno);
  el("mesDescanso").textContent = minutosParaHoraLonga(descanso);
  el("mesDiasTrabalhados").textContent = dias;
  el("mesFolgas").textContent = folgas;
  el("mesSaldo").textContent = formatarSaldoLongo(saldo);
}

function renderizarHistorico() {
  const datas = Object.keys(registros).sort().reverse();

  if (!datas.length) {
    el("listaHistorico").innerHTML = `<p class="aviso">Nenhum registro ainda.</p>`;
    return;
  }

  el("listaHistorico").innerHTML = datas.map(data => {
    const registro = registros[data];
    const calculo = calcularDia(registro);

    return `
      <div class="item">
        <b>${formatarData(data)}</b>
        <button onclick="abrirDia('${data}')">Abrir</button><br>
        Entrada: ${formatarHora(registro.entrada, registro.data)} |
        Descanso: ${formatarHora(registro.saidaDescanso, registro.data)} às ${formatarHora(registro.voltaDescanso, registro.data)} |
        Saída: ${formatarHora(registro.saidaFinal, registro.data)}<br>
        Ponto: ${minutosParaHora(calculo.trabalhadoPonto)} |
        Ajuste RH: ${minutosParaHora(calculo.ajusteRH)} |
        Total: ${minutosParaHora(calculo.totalConsiderado)} |
        Saldo: ${formatarSaldo(calculo.saldo)}<br>
        EX60%: ${minutosParaHora(calculo.ex60)} |
        EX100%: ${minutosParaHora(calculo.ex100)} |
        Noturno: ${minutosParaHora(calculo.noturno)}
        ${registro.observacao ? `<br>Obs: ${escaparHTML(registro.observacao)}` : ""}
      </div>
    `;
  }).join("");
}

function abrirDia(data) {
  el("dataSelecionada").value = data;
  garantirRegistroDoDia();
  renderizar();
  trocarAba("Hoje", document.querySelector(".nav button"));
}

function trocarAba(nome, botao) {
  document.querySelectorAll(".tela").forEach(tela => tela.classList.remove("ativa"));
  document.querySelectorAll(".nav button").forEach(btn => btn.classList.remove("ativo"));

  el(`tela${nome}`).classList.add("ativa");

  if (botao) botao.classList.add("ativo");

  if (nome === "Mes") renderizarResumoMensal();
  if (nome === "Historico") renderizarHistorico();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function gerarHoleritePessoal() {
  const mes = el("mesResumo").value || hojeMesISO();

  let totalEx60 = 0;
  let totalEx100 = 0;
  let totalNoturno = 0;

  gerarDatasDoMes(mes).forEach(data => {
    if (!registros[data]) return;

    const calculo = calcularDia(registros[data]);
    totalEx60 += calculo.ex60;
    totalEx100 += calculo.ex100;
    totalNoturno += calculo.noturno;
  });

  const salarioBase = numeroCampo(config.salarioBase, 0);
  const divisorMensal = numeroCampo(config.divisorMensal, 220);
  const periculosidadePercentual = numeroCampo(config.periculosidadePercentual, 0);
  const adicionalNoturnoPercentual = numeroCampo(config.adicionalNoturnoPercentual, 50);
  const dsrPercentual = numeroCampo(config.dsrPercentual, 0);

  const periculosidade = salarioBase * periculosidadePercentual / 100;
  const valorHoraBase = salarioBase / divisorMensal;
  const valorHoraComPericulosidade = (salarioBase + periculosidade) / divisorMensal;

  const valorEx60 = (totalEx60 / 60) * valorHoraComPericulosidade * (1 + numeroCampo(config.percentualEx60, 60) / 100);
  const valorEx100 = (totalEx100 / 60) * valorHoraComPericulosidade * 2;
  const valorNoturno = (totalNoturno / 60) * valorHoraBase * (adicionalNoturnoPercentual / 100);

  const variaveis = valorEx60 + valorEx100 + valorNoturno;
  const dsr = variaveis * dsrPercentual / 100;

  const totalVencimentos = salarioBase + periculosidade + valorEx60 + valorEx100 + valorNoturno + dsr;
  const totalDescontos =
    numeroCampo(config.descontosFixos, 0) +
    numeroCampo(config.inssEstimado, 0) +
    numeroCampo(config.irrfEstimado, 0);

  const liquido = totalVencimentos - totalDescontos;

  el("holeritePessoal").classList.add("ativo");

  el("holeritePessoal").innerHTML = `
    <h3>Holerite pessoal</h3>
    <p class="aviso">Prévia de ${formatarMesAno(mes)}</p>

    <div class="hlinha head"><span>Provento</span><span>Ref.</span><b>Valor</b></div>
    ${linhaHolerite("Salário base", "Mensal", salarioBase)}
    ${linhaHolerite(`Periculosidade ${periculosidadePercentual}%`, `${periculosidadePercentual}%`, periculosidade)}
    ${linhaHolerite(`EX${config.percentualEx60}%`, minutosParaHoraLonga(totalEx60), valorEx60)}
    ${linhaHolerite("EX100%", minutosParaHoraLonga(totalEx100), valorEx100)}
    ${linhaHolerite(`Adicional noturno ${adicionalNoturnoPercentual}%`, minutosParaHoraLonga(totalNoturno), valorNoturno)}
    ${linhaHolerite(`Reflexo DSR ${dsrPercentual}%`, `${dsrPercentual}%`, dsr)}

    <div class="hlinha head"><span>Total vencimentos</span><span></span><b>${dinheiro(totalVencimentos)}</b></div>

    <div class="hlinha head desc"><span>Descontos</span><span>Ref.</span><b>Valor</b></div>
    ${linhaHolerite("Descontos fixos", "Manual", config.descontosFixos, "desc")}
    ${linhaHolerite("INSS estimado", "Manual", config.inssEstimado, "desc")}
    ${linhaHolerite("IRRF estimado", "Manual", config.irrfEstimado, "desc")}

    <div class="hlinha head desc"><span>Total descontos</span><span></span><b>${dinheiro(totalDescontos)}</b></div>
    <div class="hlinha liq"><span>Líquido estimado</span><span></span><b>${dinheiro(liquido)}</b></div>
    <p class="aviso">Estimativa para controle pessoal.</p>
  `;
}

function linhaHolerite(nome, ref, valor, classe = "") {
  return `
    <div class="hlinha ${classe}">
      <span>${nome}</span>
      <span>${ref}</span>
      <b>${dinheiro(valor)}</b>
    </div>
  `;
}

function exportarCSV() {
  const linhas = [
    ["Data", "Entrada", "Saída descanso", "Volta descanso", "Saída final", "Ponto", "Ajuste RH", "Total", "Descanso", "Saldo", "EX60", "EX100", "Noturno", "Obs"]
  ];

  Object.keys(registros).sort().forEach(data => {
    const registro = registros[data];
    const calculo = calcularDia(registro);

    linhas.push([
      formatarData(data),
      formatarHora(registro.entrada, registro.data),
      formatarHora(registro.saidaDescanso, registro.data),
      formatarHora(registro.voltaDescanso, registro.data),
      formatarHora(registro.saidaFinal, registro.data),
      minutosParaHora(calculo.trabalhadoPonto),
      minutosParaHora(calculo.ajusteRH),
      minutosParaHora(calculo.totalConsiderado),
      minutosParaHora(calculo.descanso),
      formatarSaldo(calculo.saldo),
      minutosParaHora(calculo.ex60),
      minutosParaHora(calculo.ex100),
      minutosParaHora(calculo.noturno),
      registro.observacao || ""
    ]);
  });

  const csv = linhas
    .map(linha => linha.map(campo => `"${String(campo).replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "app-ponto-historico.csv";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function apagarDia() {
  const confirmar = confirm("Deseja apagar todas as marcações deste dia?");
  if (!confirmar) return;

  delete registros[dataSelecionada()];
  salvarRegistros();
  garantirRegistroDoDia();
  renderizar();
}

function irParaHoje() {
  el("dataSelecionada").value = hojeISO();
  garantirRegistroDoDia();
  renderizar();
}

function gerarDatasDoMes(mesISO) {
  const [ano, mes] = mesISO.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const datas = [];

  for (let dia = 1; dia <= ultimoDia; dia++) {
    datas.push(`${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
  }

  return datas;
}

function horarioParaMinutos(horario) {
  const [h, m] = String(horario || "00:00").split(":").map(Number);
  return h * 60 + m;
}

function diferencaMinutos(inicio, fim) {
  return Math.max(0, Math.round((fim - inicio) / 60000));
}

function minutosParaHora(minutos) {
  minutos = Math.max(0, Math.round(minutos));
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}h${String(minutos % 60).padStart(2, "0")}`;
}

function minutosParaHoraLonga(minutos) {
  minutos = Math.max(0, Math.round(minutos));
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

function formatarSaldo(minutos) {
  return `${minutos >= 0 ? "+" : "-"}${minutosParaHora(Math.abs(minutos))}`;
}

function formatarSaldoLongo(minutos) {
  return `${minutos >= 0 ? "+" : "-"}${minutosParaHoraLonga(Math.abs(minutos))}`;
}

function formatarHora(valor, dataBase = null) {
  if (!valor) return "--:--";

  const data = new Date(valor);

  let texto = data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });

  if (dataBase) {
    const base = new Date(`${dataBase}T00:00:00`);
    const copia = new Date(valor);

    base.setHours(0, 0, 0, 0);
    copia.setHours(0, 0, 0, 0);

    const dias = Math.round((copia - base) / 86400000);

    if (dias > 0) texto += ` +${dias}`;
  }

  return texto;
}

function formatarData(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarMesAno(mesISO) {
  const [ano, mes] = mesISO.split("-");
  const nomes = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];

  return `${nomes[Number(mes) - 1]} de ${ano}`;
}

function dinheiro(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function numeroCampo(valor, padrao) {
  const numero = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(numero) ? numero : padrao;
}

function escaparHTML(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

boot();