(function () {
  const REG_KEY = 'app_ponto_pessoal_registros_v9';
  const CFG_KEY = 'app_ponto_pessoal_config_v9';
  const EXTRA_KEY = 'app_ponto_extras_v2';

  function $(id) {
    return document.getElementById(id);
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
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function montarBackup() {
    return {
      app: 'App Ponto Pessoal',
      version: 3,
      exportedAt: new Date().toISOString(),
      registros: safeJSON(localStorage.getItem(REG_KEY), {}),
      config: safeJSON(localStorage.getItem(CFG_KEY), {}),
      extras: safeJSON(localStorage.getItem(EXTRA_KEY), {})
    };
  }

  async function exportarBackupCorrigido(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    const nome = 'backup-app-ponto-' + todayISO() + '.json';
    const texto = JSON.stringify(montarBackup(), null, 2);
    const blob = new Blob([texto], { type: 'application/json;charset=utf-8' });
    const file = new File([blob], nome, { type: 'application/json' });

    try {
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: 'Backup App Ponto', text: 'Backup dos dados do App Ponto.' });
        return;
      }
    } catch (e) {}

    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nome;
      link.rel = 'noopener';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
        link.remove();
      }, 1200);
      mostrarMensagemBackup('Backup gerado. Confira a pasta Downloads do celular.');
      return;
    } catch (e) {}

    mostrarBackupManual(texto, nome);
  }

  function mostrarMensagemBackup(msg) {
    let box = $('backupMsg');
    if (!box) {
      box = document.createElement('p');
      box.id = 'backupMsg';
      box.className = 'extra-note';
      const backupBox = $('backupBox');
      if (backupBox) backupBox.appendChild(box);
    }
    box.textContent = msg;
  }

  function mostrarBackupManual(texto, nome) {
    let box = $('backupManualBox');
    if (!box) {
      box = document.createElement('section');
      box.id = 'backupManualBox';
      box.className = 'box extra-box';
      box.innerHTML = '<h3>Backup manual</h3><p class="extra-note">Se o Android bloquear o download, copie o texto abaixo e salve em um arquivo chamado ' + nome + '.</p><textarea id="backupManualText" style="min-height:220px;font-family:monospace;font-size:12px"></textarea><button id="btnCopiarBackup" class="ok full">Copiar backup</button>';
      const tela = $('telaHistorico');
      if (tela) tela.appendChild(box);
      $('btnCopiarBackup').addEventListener('click', function () {
        const txt = $('backupManualText');
        txt.select();
        document.execCommand('copy');
        mostrarMensagemBackup('Backup copiado para a área de transferência.');
      });
    }
    $('backupManualText').value = texto;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function ativarBackupCorrigido() {
    const btn = $('btnBackup');
    if (!btn) return;
    if (btn.dataset.backupFix === '1') return;
    btn.dataset.backupFix = '1';
    btn.addEventListener('click', exportarBackupCorrigido, true);
  }

  document.addEventListener('click', function (event) {
    if (event.target && event.target.id === 'btnBackup') {
      exportarBackupCorrigido(event);
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(ativarBackupCorrigido, 900); });
  } else {
    setTimeout(ativarBackupCorrigido, 900);
  }
})();
