(function () {
  const EXTRA_KEY = 'app_ponto_extras_v1';
  const REG_KEY = 'app_ponto_pessoal_registros_v9';
  const CFG_KEY = 'app_ponto_pessoal_config_v9';

  const defaults = {
    remindersEnabled: false,
    onlyWeekdays: true,
    vibrate: true,
    reminders: {
      entrada: '15:25',
      saidaDescanso: '18:58',
      voltaDescanso: '19:58',
      saidaFinal: '00:55'
    }
  };

  let extra = loadExtra();

  function $(id) {
    return document.getElementById(id);
  }

  function loadExtra() {
    try {
      return { ...defaults, ...(JSON.parse(localStorage.getItem(EXTRA_KEY) || '{}')) };
    } catch (e) {
      return { ...defaults };
    }
  }

  function saveExtra() {
    localStorage.setItem(EXTRA_KEY, JSON.stringify(extra));
  }

  function initExtras() {
    injectStyle();
    addMonthTools();
    addHistoryTools();
    addReminderTools();
    startReminderLoop();
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.textContent = `
      .extra-box{margin-top:14px}
      .extra-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
      .extra-actions button,.extra-box button{width:100%}
      .extra-note{color:#91a2c3;font-size:12px;line-height:1.45;margin:10px 0 0}
      .extra-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
      .extra-row label{color:#a9b7d6;font-size:13px}
      .extra-row input{margin-top:6px}
      .extra-check{display:flex;gap:10px;align-items:center;margin-top:10px;color:#dce5f7;font-size:14px}
      .extra-check input{width:auto}
      #graficoMensal{width:100%;height:230px;background:#101827;border:1px solid #25314b;border-radius:18px;margin-top:12px}
      .status-pill{display:inline-block;padding:6px 10px;border-radius:999px;background:#101827;border:1px solid #25314b;color:#b7c5e4;font-size:12px;margin-top:8px}
      @media print{
        body{background:#fff;color:#111}
        .topo,.nav,#telaHoje,#telaHistorico,#telaConfig,.extra-actions,#btnHolerite,#btnPDF,#btnGrafico{display:none!important}
        #telaMes{display:block!important}
        .app{max-width:none;padding:0}
        .box,.card,.valor,.holerite,.hlinha{box-shadow:none!important;background:#fff!important;color:#111!important;border-color:#bbb!important}
        .card p,.aviso,.valor span{color:#333!important}
      }
    `;
    document.head.appendChild(style);
  }

  function addMonthTools() {
    const holerite = $('holeritePessoal');
    if (!holerite || $('extrasMes')) return;

    const box = document.createElement('div');
    box.id = 'extrasMes';
    box.className = 'extra-box';
    box.innerHTML = `
      <div class="extra-actions">
        <button id="btnPDF" class="sec">Gerar PDF</button>
        <button id="btnGrafico" class="sec">Ver gráfico</button>
      </div>
      <canvas id="graficoMensal" width="460" height="230"></canvas>
      <p class="extra-note">O PDF usa a impressão do navegador: escolha “Salvar como PDF”. O gráfico usa os dados salvos no aparelho.</p>
    `;

    holerite.insertAdjacentElement('afterend', box);
    $('graficoMensal').style.display = 'none';

    $('btnPDF').addEventListener('click', () => {
      if (typeof gerarHoleritePessoal === 'function') gerarHoleritePessoal();
      setTimeout(() => window.print(), 250);
    });

    $('btnGrafico').addEventListener('click', () => {
      const canvas = $('graficoMensal');
      canvas.style.display = canvas.style.display === 'none' ? 'block' : 'none';
      if (canvas.style.display !== 'none') drawMonthlyChart();
    });
  }

  function addHistoryTools() {
    const tela = $('telaHistorico');
    if (!tela || $('backupBox')) return;

    const section = document.createElement('section');
    section.className = 'box extra-box';
    section.id = 'backupBox';
    section.innerHTML = `
      <h3>Backup dos dados</h3>
      <div class="extra-actions">
        <button id="btnBackup" class="ok">Exportar backup</button>
        <button id="btnImportar" class="sec">Importar backup</button>
      </div>
      <input id="inputBackup" type="file" accept="application/json" style="display:none">
      <p class="extra-note">O backup salva marcações, configurações e lembretes em um arquivo JSON.</p>
    `;

    tela.appendChild(section);
    $('btnBackup').addEventListener('click', exportBackup);
    $('btnImportar').addEventListener('click', () => $('inputBackup').click());
    $('inputBackup').addEventListener('change', importBackup);
  }

  function addReminderTools() {
    const tela = $('telaConfig');
    if (!tela || $('reminderBox')) return;

    const section = document.createElement('section');
    section.className = 'box extra-box';
    section.id = 'reminderBox';
    section.innerHTML = `
      <h3>Lembretes de ponto</h3>
      <span id="notifStatus" class="status-pill">Status: verificando...</span>
      <div class="extra-row">
        <label>Entrada<input type="time" id="remEntrada"></label>
        <label>Saída descanso<input type="time" id="remSaidaDescanso"></label>
        <label>Volta descanso<input type="time" id="remVoltaDescanso"></label>
        <label>Saída final<input type="time" id="remSaidaFinal"></label>
      </div>
      <label class="extra-check"><input type="checkbox" id="remWeekdays"> Apenas segunda a sexta</label>
      <label class="extra-check"><input type="checkbox" id="remVibrate"> Vibrar quando possível</label>
      <div class="extra-actions">
        <button id="btnAtivarNotif" class="ok">Ativar lembretes</button>
        <button id="btnTestarNotif" class="sec">Testar</button>
      </div>
      <p class="extra-note">No Android, os lembretes funcionam melhor com o app aberto ou recém-aberto. Sem servidor push, o navegador pode pausar alarmes em segundo plano.</p>
    `;

    tela.appendChild(section);

    $('remEntrada').value = extra.reminders.entrada;
    $('remSaidaDescanso').value = extra.reminders.saidaDescanso;
    $('remVoltaDescanso').value = extra.reminders.voltaDescanso;
    $('remSaidaFinal').value = extra.reminders.saidaFinal;
    $('remWeekdays').checked = !!extra.onlyWeekdays;
    $('remVibrate').checked = !!extra.vibrate;

    ['remEntrada', 'remSaidaDescanso', 'remVoltaDescanso', 'remSaidaFinal', 'remWeekdays', 'remVibrate'].forEach(id => {
      $(id).addEventListener('change', saveReminderForm);
    });

    $('btnAtivarNotif').addEventListener('click', enableNotifications);
    $('btnTestarNotif').addEventListener('click', () => showNotification('Teste do App Ponto', 'Se apareceu, os lembretes estão prontos.'));
    updateNotificationStatus();
  }

  function saveReminderForm() {
    extra.reminders.entrada = $('remEntrada').value || defaults.reminders.entrada;
    extra.reminders.saidaDescanso = $('remSaidaDescanso').value || defaults.reminders.saidaDescanso;
    extra.reminders.voltaDescanso = $('remVoltaDescanso').value || defaults.reminders.voltaDescanso;
    extra.reminders.saidaFinal = $('remSaidaFinal').value || defaults.reminders.saidaFinal;
    extra.onlyWeekdays = $('remWeekdays').checked;
    extra.vibrate = $('remVibrate').checked;
    saveExtra();
  }

  async function enableNotifications() {
    saveReminderForm();

    if (!('Notification' in window)) {
      alert('Este navegador não oferece notificações para este app.');
      return;
    }

    const permission = await Notification.requestPermission();
    extra.remindersEnabled = permission === 'granted';
    saveExtra();
    updateNotificationStatus();

    if (extra.remindersEnabled) {
      showNotification('Lembretes ativados', 'Vou avisar nos horários configurados enquanto o navegador permitir.');
    }
  }

  function updateNotificationStatus() {
    const status = $('notifStatus');
    if (!status) return;

    if (!('Notification' in window)) {
      status.textContent = 'Status: indisponível neste navegador';
      return;
    }

    status.textContent = `Status: ${Notification.permission}${extra.remindersEnabled ? ' / ligado' : ' / desligado'}`;
  }

  function startReminderLoop() {
    setInterval(checkReminders, 30000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkReminders();
    });
    setTimeout(checkReminders, 1500);
  }

  function checkReminders() {
    if (!extra.remindersEnabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const items = [
      ['entrada', 'Hora de bater entrada'],
      ['saidaDescanso', 'Hora de sair para descanso'],
      ['voltaDescanso', 'Hora de voltar do descanso'],
      ['saidaFinal', 'Hora de bater saída']
    ];

    items.forEach(([key, title]) => {
      if (extra.reminders[key] !== hhmm) return;
      if (!shouldNotifyToday(key, now)) return;

      const dayKey = reminderDayKey(key, now);
      const lastKey = `app_ponto_last_${dayKey}_${key}_${hhmm}`;
      if (localStorage.getItem(lastKey)) return;

      localStorage.setItem(lastKey, '1');
      showNotification(title, 'Abra o App Ponto e registre sua marcação.');
    });
  }

  function shouldNotifyToday(key, now) {
    if (!extra.onlyWeekdays) return true;

    const ref = new Date(now);
    const minutesNow = now.getHours() * 60 + now.getMinutes();

    if (key === 'saidaFinal' && minutesNow < 5 * 60) {
      ref.setDate(ref.getDate() - 1);
    }

    const day = ref.getDay();
    return day >= 1 && day <= 5;
  }

  function reminderDayKey(key, now) {
    const ref = new Date(now);
    const minutesNow = now.getHours() * 60 + now.getMinutes();

    if (key === 'saidaFinal' && minutesNow < 5 * 60) {
      ref.setDate(ref.getDate() - 1);
    }

    return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`;
  }

  async function showNotification(title, body) {
    if (!('Notification' in window)) return;

    if (Notification.permission !== 'granted') {
      await enableNotifications();
      if (Notification.permission !== 'granted') return;
    }

    const options = {
      body,
      icon: 'icon.svg',
      badge: 'icon.svg',
      tag: 'app-ponto-reminder',
      vibrate: extra.vibrate ? [200, 100, 200] : undefined
    };

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  }

  function exportBackup() {
    const payload = {
      app: 'App Ponto Pessoal',
      version: 1,
      exportedAt: new Date().toISOString(),
      registros: safeJSON(localStorage.getItem(REG_KEY), {}),
      config: safeJSON(localStorage.getItem(CFG_KEY), {}),
      extras: extra
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-app-ponto-${todayISO()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.registros) throw new Error('Backup inválido');
        if (!confirm('Importar backup e substituir os dados atuais?')) return;

        localStorage.setItem(REG_KEY, JSON.stringify(data.registros || {}));
        localStorage.setItem(CFG_KEY, JSON.stringify(data.config || {}));
        localStorage.setItem(EXTRA_KEY, JSON.stringify(data.extras || defaults));
        alert('Backup importado. O app será recarregado.');
        location.reload();
      } catch (e) {
        alert('Não consegui importar este arquivo de backup.');
      }
    };
    reader.readAsText(file);
  }

  function drawMonthlyChart() {
    const canvas = $('graficoMensal');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const registros = safeJSON(localStorage.getItem(REG_KEY), {});
    const mes = $('mesResumo')?.value || todayISO().slice(0, 7);
    const days = datesOfMonth(mes);

    const values = days.map(date => {
      const registro = registros[date];
      if (!registro || typeof calcularDia !== 'function') return 0;
      const calc = calcularDia(registro);
      return Math.round((calc.totalConsiderado || 0) / 60 * 100) / 100;
    });

    const max = Math.max(9, ...values);
    const pad = 32;
    const chartW = width - pad * 2;
    const chartH = height - pad * 2;
    const barW = chartW / values.length;

    ctx.fillStyle = '#101827';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#25314b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = pad + (chartH / 3) * i;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(width - pad, y);
      ctx.stroke();
    }

    values.forEach((value, index) => {
      const h = (value / max) * chartH;
      const x = pad + index * barW + 2;
      const y = height - pad - h;
      ctx.fillStyle = value >= 8.8 ? '#16a34a' : value > 0 ? '#2b6cff' : '#26334f';
      ctx.fillRect(x, y, Math.max(3, barW - 4), h);
    });

    ctx.fillStyle = '#b7c5e4';
    ctx.font = '12px Arial';
    ctx.fillText('Horas trabalhadas no mês', pad, 20);
    ctx.fillText(`${max.toFixed(0)}h`, 6, pad + 6);
    ctx.fillText('0h', 10, height - pad);
  }

  function safeJSON(text, fallback) {
    try {
      return JSON.parse(text || '');
    } catch (e) {
      return fallback;
    }
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function datesOfMonth(monthISO) {
    const [year, month] = monthISO.split('-').map(Number);
    const last = new Date(year, month, 0).getDate();
    const out = [];
    for (let day = 1; day <= last; day++) {
      out.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
    return out;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initExtras, 500));
  } else {
    setTimeout(initExtras, 500);
  }
})();
