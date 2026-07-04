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

  function initFolhaPonto() {
    injectStyle();
    addButton();
  }

  function injectStyle() {
    if ($('folhaPontoStyle')) return;

    const style = document.createElement('style');
    style.id = 'folhaPontoStyle';
    style.textContent = `
      #folhaPontoPreview{display:none;margin-top:12px;background:#0c1527;border:1px solid #24324f;border-radius:18px;padding:12px;overflow:auto}
      #folhaPontoPreview.ativo{display:block}
      .folha-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:10px}
      .folha-head h3{margin:0 0 5px}.folha-head p{margin:0;color:#94a3c7;font-size:12px;line-height:1.35}
      .folha-table{width:100%;border-collapse:collapse;min-width:980px;font-size:11px;color:#f6f8ff}
      .folha-table th,.folha-table td{border:1px solid #24324f;padding:7px 6px;text-align:left;white-space:nowrap}
      .folha-table th{background:#243453;color:#fff;font-weight:700}
      .folha-table td{background:#111a2d}.folha-table .neg{color:#ff9c9c}.folha-table .pos{color:#8cffb0}
      .folha-total{margin-top:10px;display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
      .folha-total div{background:#111a2d;border:1px solid #24324f;border-radius:12px;padding:9px;font-size:12px}.folha-total b{float:right}
      @media print{
        body.folha-print *{visibility:hidden!important}
        body.folha-print #folhaPontoPreview,body.folha-print #folhaPontoPreview *{visibility:visible!important}
        body.folha-print #folhaPontoPreview{display:block!important;position:absolute;left:0;top:0;width:100%;border:0;background:#fff;color:#111;padding:10mm;overflow:visible}
        body.folha-print .folha-head p,body.folha-print .folha-table,body.folha-print .folha-table td,body.folha-print .folha-table th,body.folha-print .folha-total div{color:#111!important;background:#fff!important;border-color:#333!important}
        body.folha-print .folha-table{font-size:9px;min-width:0}body.folha-print .folha-total{grid-template-columns:repeat(4,1fr)}
        body.folha-print #btnImprimirFolha{display:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function addButton() {
    if ($('btnFolhaPonto')) return;

    const btnHolerite = $('btnHolerite');
    if (!btnHolerite) return;

    const btn = document.createElement('button');
    btn.id = 'btnFolhaPonto';
    btn.className = 'sec full';
    btn.textContent = 'Gerar folha de ponto';
    btn.addEventListener('click', gerarFolhaPonto);

    btnHolerite.insertAdjacentElement('afterend', btn);

    const preview = document.createElement('div');
    preview.id = 'folhaPontoPreview';
    btn.insertAdjacentElement('afterend', preview);
  }

  function gerarFolhaPonto() {
    const mes = ($('mesResumo') && $('mesResumo').value) || hojeMesLocal();
    const dados = getRegistros();
    const datas = datasDoMes(mes);

    let totalPonto = 0;
    let totalAjuste = 0;
    let totalConsiderado = 0;
    let totalDescanso = 0;
    let totalSaldo = 0;
    let totalEx60 = 0;
    let totalEx100 = 0;
    let totalNoturno = 0;
    let diasTrabalhados = 0;

    const linhas = datas.map(function (data) {
      const registro = dados[data];
      const diaSemana = diaSemanaNome(data);

      if (!registro || typeof calcularDia !== 'function') {
        return linhaTabela({ data, diaSemana });
      }

      const c = calcularDia(registro);
      if (c.totalConsiderado > 0) diasTrabalhados++;

      totalPonto += c.trabalhadoPonto || 0;
      totalAjuste += c.ajusteRH || 0;
      totalConsiderado += c.totalConsiderado || 0;
      totalDescanso += c.descanso || 0;
      totalSaldo += c.saldo || 0;
      totalEx60 += c.ex60 || 0;
      totalEx100 += c.ex100 || 0;
      totalNoturno += c.noturno || 0;

      return linhaTabela({ data, diaSemana, registro, calculo: c });
    }).join('');

    const folgasAcumuladas = typeof window.calcularFolgasAcumuladas === 'function' ? window.calcularFolgasAcumuladas(mes) : '-';

    const preview = $('folhaPontoPreview');
    preview.classList.add('ativo');
    preview.innerHTML = `
      <div class="folha-head">
        <div>
          <h3>Folha de ponto pessoal</h3>
          <p>Período: ${nomeMes(mes)}<br>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        <button id="btnImprimirFolha" class="ok">Salvar PDF</button>
      </div>
      <table class="folha-table">
        <thead>
          <tr>
            <th>Data</th><th>Dia</th><th>Entrada</th><th>Saída descanso</th><th>Volta descanso</th><th>Saída final</th><th>Ponto</th><th>Ajuste RH</th><th>Total</th><th>Descanso</th><th>Saldo</th><th>EX60</th><th>EX100</th><th>Noturno</th><th>Folga/100%</th><th>Obs.</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      <div class="folha-total">
        ${totalBox('Dias trabalhados', diasTrabalhados)}
        ${totalBox('Folgas acumuladas', folgasAcumuladas)}
        ${totalBox('Ponto', hora(totalPonto))}
        ${totalBox('Ajuste RH', hora(totalAjuste))}
        ${totalBox('Total considerado', hora(totalConsiderado))}
        ${totalBox('Descanso', hora(totalDescanso))}
        ${totalBox('Saldo', saldo(totalSaldo))}
        ${totalBox('EX60', hora(totalEx60))}
        ${totalBox('EX100', hora(totalEx100))}
        ${totalBox('Noturno', hora(totalNoturno))}
      </div>
    `;

    $('btnImprimirFolha').addEventListener('click', function () {
      document.body.classList.add('folha-print');
      setTimeout(function () {
        window.print();
        setTimeout(function () { document.body.classList.remove('folha-print'); }, 500);
      }, 80);
    });

    preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function linhaTabela(info) {
    const r = info.registro;
    const c = info.calculo;
    const temRegistro = !!(r && c);

    const saldoValor = temRegistro ? c.saldo || 0 : 0;
    const saldoClasse = saldoValor > 0 ? 'pos' : saldoValor < 0 ? 'neg' : '';

    return `
      <tr>
        <td>${formatarData(info.data)}</td>
        <td>${info.diaSemana}</td>
        <td>${temRegistro ? formatarHoraLocal(r.entrada, r.data) : '--:--'}</td>
        <td>${temRegistro ? formatarHoraLocal(r.saidaDescanso, r.data) : '--:--'}</td>
        <td>${temRegistro ? formatarHoraLocal(r.voltaDescanso, r.data) : '--:--'}</td>
        <td>${temRegistro ? formatarHoraLocal(r.saidaFinal, r.data) : '--:--'}</td>
        <td>${temRegistro ? hora(c.trabalhadoPonto) : '00:00'}</td>
        <td>${temRegistro ? hora(c.ajusteRH) : '00:00'}</td>
        <td>${temRegistro ? hora(c.totalConsiderado) : '00:00'}</td>
        <td>${temRegistro ? hora(c.descanso) : '00:00'}</td>
        <td class="${saldoClasse}">${temRegistro ? saldo(c.saldo) : '+00:00'}</td>
        <td>${temRegistro ? hora(c.ex60) : '00:00'}</td>
        <td>${temRegistro ? hora(c.ex100) : '00:00'}</td>
        <td>${temRegistro ? hora(c.noturno) : '00:00'}</td>
        <td>${temRegistro && r.dia100 ? 'Sim' : 'Não'}</td>
        <td>${temRegistro ? esc(r.observacao || '') : ''}</td>
      </tr>
    `;
  }

  function totalBox(nome, valor) {
    return `<div><span>${nome}</span><b>${valor}</b></div>`;
  }

  function datasDoMes(mes) {
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

  function hojeMesLocal() {
    if (typeof hojeMesISO === 'function') return hojeMesISO();
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function formatarData(dataISO) {
    const p = dataISO.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function diaSemanaNome(dataISO) {
    const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return nomes[new Date(dataISO + 'T12:00:00').getDay()];
  }

  function hora(minutos) {
    minutos = Math.max(0, Math.round(minutos || 0));
    return String(Math.floor(minutos / 60)).padStart(2, '0') + ':' + String(minutos % 60).padStart(2, '0');
  }

  function saldo(minutos) {
    return (minutos >= 0 ? '+' : '-') + hora(Math.abs(minutos || 0));
  }

  function formatarHoraLocal(valor, dataBase) {
    if (!valor) return '--:--';
    if (typeof formatarHora === 'function') return formatarHora(valor, dataBase);

    const data = new Date(valor);
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function nomeMes(mes) {
    const nomes = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const p = mes.split('-');
    return nomes[Number(p[1]) - 1] + ' de ' + p[0];
  }

  function esc(texto) {
    return String(texto || '').replace(/[&<>"']/g, function (x) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[x];
    });
  }

  window.gerarFolhaPonto = gerarFolhaPonto;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(initFolhaPonto, 1000); });
  } else {
    setTimeout(initFolhaPonto, 1000);
  }
})();
