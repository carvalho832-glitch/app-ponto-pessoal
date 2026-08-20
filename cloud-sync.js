(function () {
  'use strict';

  const APP_ID = 'br.com.juliocarvalho.pontoapp';
  const SCHEMA_VERSION = 1;
  const META_KEY = 'app_ponto_cloud_meta_v1';
  const DATA_KEYS = {
    registros: 'app_ponto_pessoal_registros_v9',
    config: 'app_ponto_pessoal_config_v9',
    extras: 'app_ponto_extras_v2',
    descontosAuto: 'app_ponto_descontos_auto_v1'
  };
  const SYNC_KEYS = Object.values(DATA_KEYS);
  const SYNC_DELAY_MS = 1800;

  let applyingRemote = false;
  let nativeBackup = null;
  let syncTimer = null;
  let syncing = false;
  let meta = readJSON(META_KEY, {});

  installStorageObserver();
  ensureMeta();

  function installStorageObserver() {
    if (window.__pontoCloudStorageObserver) return;
    window.__pontoCloudStorageObserver = true;

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      const isLocal = this === localStorage;
      const previous = isLocal ? this.getItem(key) : null;
      originalSetItem.call(this, key, value);

      if (
        isLocal &&
        !applyingRemote &&
        SYNC_KEYS.includes(key) &&
        previous !== String(value)
      ) {
        markLocalChange();
      }
    };
  }

  function ensureMeta() {
    if (!meta.deviceId) meta.deviceId = createDeviceId();
    if (!meta.localUpdatedAt) meta.localUpdatedAt = new Date().toISOString();
    if (typeof meta.dirty !== 'boolean') meta.dirty = hasMeaningfulLocalData();
    writeMeta();
  }

  function createDeviceId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'device-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function markLocalChange() {
    meta.localUpdatedAt = new Date().toISOString();
    meta.dirty = true;
    writeMeta();
    updateUI();
    scheduleSync();
  }

  function scheduleSync(delay) {
    if (!nativeBackup || syncing) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      synchronize({ manual: false });
    }, typeof delay === 'number' ? delay : SYNC_DELAY_MS);
  }

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '');
      return value == null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeMeta() {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  }

  function hasMeaningfulLocalData() {
    const registros = readJSON(DATA_KEYS.registros, {});
    return Object.keys(registros).some(function (date) {
      const item = registros[date] || {};
      return !!(
        item.entrada ||
        item.saidaDescanso ||
        item.voltaDescanso ||
        item.saidaFinal ||
        item.observacao ||
        (item.tipoDia && item.tipoDia !== 'normal')
      );
    });
  }

  function buildSnapshot() {
    return {
      app: 'Ponto App Pessoal',
      appId: APP_ID,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: meta.localUpdatedAt || new Date().toISOString(),
      deviceId: meta.deviceId,
      data: {
        registros: readJSON(DATA_KEYS.registros, {}),
        config: readJSON(DATA_KEYS.config, {}),
        extras: readJSON(DATA_KEYS.extras, {}),
        descontosAuto: readJSON(DATA_KEYS.descontosAuto, {})
      }
    };
  }

  function normalizeSnapshot(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('O arquivo de backup está vazio ou inválido.');
    }

    if (payload.data && payload.data.registros) {
      return {
        updatedAt: payload.updatedAt || payload.exportedAt || new Date(0).toISOString(),
        data: {
          registros: payload.data.registros || {},
          config: payload.data.config || {},
          extras: payload.data.extras || {},
          descontosAuto: payload.data.descontosAuto || {}
        }
      };
    }

    if (payload.registros) {
      return {
        updatedAt: payload.updatedAt || payload.exportedAt || new Date(0).toISOString(),
        data: {
          registros: payload.registros || {},
          config: payload.config || {},
          extras: payload.extras || {},
          descontosAuto: payload.descontosAuto || {}
        }
      };
    }

    throw new Error('O arquivo não pertence ao Ponto App Pessoal.');
  }

  function applyRemoteSnapshot(snapshot) {
    applyingRemote = true;
    try {
      localStorage.setItem(DATA_KEYS.registros, JSON.stringify(snapshot.data.registros || {}));
      localStorage.setItem(DATA_KEYS.config, JSON.stringify(snapshot.data.config || {}));
      localStorage.setItem(DATA_KEYS.extras, JSON.stringify(snapshot.data.extras || {}));
      localStorage.setItem(DATA_KEYS.descontosAuto, JSON.stringify(snapshot.data.descontosAuto || {}));

      meta.localUpdatedAt = snapshot.updatedAt;
      meta.lastSyncedAt = new Date().toISOString();
      meta.dirty = false;
      meta.lastError = '';
      writeMeta();
      sessionStorage.setItem('app_ponto_cloud_notice', 'Backup do Google Drive restaurado.');
    } finally {
      applyingRemote = false;
    }

    location.reload();
  }

  function getNativeBackup() {
    const capacitor = window.Capacitor;
    if (!capacitor || !capacitor.Plugins) return null;
    return capacitor.Plugins.DriveBackup || null;
  }

  async function connectFolder() {
    if (!nativeBackup) return;
    setBusy(true, 'Abrindo o Google Drive...');

    try {
      const result = await nativeBackup.selectFolder();
      meta.folderName = result.folderName || 'Ponto App Pessoal';
      meta.connected = true;
      meta.lastError = '';
      writeMeta();
      updateUI();
      await synchronize({ manual: true, firstConnection: true });
    } catch (error) {
      if (!isCancellation(error)) showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function synchronize(options) {
    if (!nativeBackup || syncing) return;
    syncing = true;
    setBusy(true, 'Sincronizando com o Google Drive...');

    try {
      const status = await nativeBackup.getStatus();
      if (!status.connected) {
        meta.connected = false;
        writeMeta();
        updateUI();
        return;
      }

      meta.connected = true;
      meta.folderName = status.folderName || meta.folderName || 'Ponto App Pessoal';

      const remoteResult = await nativeBackup.readBackup();
      if (!remoteResult.exists || !remoteResult.content) {
        await uploadLocalSnapshot();
        return;
      }

      const remote = normalizeSnapshot(JSON.parse(remoteResult.content));
      const remoteTime = timestamp(remote.updatedAt);
      const localTime = timestamp(meta.localUpdatedAt);
      const action = chooseSyncAction({
        remoteTime: remoteTime,
        localTime: localTime,
        firstConnection: !!options.firstConnection,
        hasLocalData: hasMeaningfulLocalData(),
        dirty: !!meta.dirty
      });

      if (action === 'restore') {
        applyRemoteSnapshot(remote);
        return;
      }

      if (action === 'upload') {
        await uploadLocalSnapshot();
        return;
      }

      meta.lastSyncedAt = new Date().toISOString();
      meta.lastError = '';
      writeMeta();
      updateUI('Tudo atualizado no Google Drive.');
    } catch (error) {
      showError(error);
      if (options.manual) alert('Não consegui sincronizar agora. Seus dados continuam salvos no aparelho.');
    } finally {
      syncing = false;
      setBusy(false);
    }
  }

  async function uploadLocalSnapshot() {
    const snapshot = buildSnapshot();
    await nativeBackup.writeBackup({ content: JSON.stringify(snapshot, null, 2) });
    meta.lastSyncedAt = new Date().toISOString();
    meta.dirty = false;
    meta.lastError = '';
    writeMeta();
    updateUI('Backup salvo no Google Drive.');
  }

  function timestamp(value) {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function chooseSyncAction(state) {
    if (state.firstConnection && !state.hasLocalData) return 'restore';
    if (state.remoteTime > state.localTime) return 'restore';
    if (state.dirty || state.localTime > state.remoteTime || state.firstConnection) return 'upload';
    return 'none';
  }

  function isCancellation(error) {
    const message = String(error && (error.message || error) || '').toLowerCase();
    return message.includes('cancel') || message.includes('cancelad');
  }

  function showError(error) {
    meta.lastError = String(error && (error.message || error) || 'Falha desconhecida');
    writeMeta();
    updateUI('Falha na nuvem. Os dados estão seguros no aparelho.');
  }

  function injectUI() {
    const screen = document.getElementById('telaConfig');
    if (!screen || document.getElementById('cloudBackupBox')) return;

    const section = document.createElement('section');
    section.className = 'box cloud-backup-box';
    section.id = 'cloudBackupBox';
    section.innerHTML = `
      <div class="cloud-backup-head">
        <div>
          <h3>Backup no Google Drive</h3>
          <p id="cloudBackupText">Verificando a pasta de backup...</p>
        </div>
        <span id="cloudBackupBadge" class="cloud-backup-badge">Verificando</span>
      </div>
      <div class="cloud-backup-actions">
        <button id="btnCloudConnect" class="ok">Escolher pasta no Drive</button>
        <button id="btnCloudSync" class="sec">Sincronizar agora</button>
      </div>
      <p id="cloudBackupLast" class="cloud-backup-last"></p>
    `;
    screen.insertBefore(section, screen.firstChild);

    const style = document.createElement('style');
    style.id = 'cloudBackupStyle';
    style.textContent = `
      .cloud-backup-box{background:linear-gradient(145deg,#10263b,#0d1b2d)}
      .cloud-backup-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .cloud-backup-head h3{margin-bottom:5px}.cloud-backup-head p{color:#a8b6d2;font-size:12px;line-height:1.4;margin:0}
      .cloud-backup-badge{border:1px solid #34506f;background:#14283d;color:#dcecff;border-radius:999px;padding:6px 9px;font-size:11px;white-space:nowrap}
      .cloud-backup-badge.ok{border-color:#287848;background:#123624;color:#bdf5ce}
      .cloud-backup-badge.warn{border-color:#7c5a27;background:#392b16;color:#ffe1a8}
      .cloud-backup-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
      .cloud-backup-actions button{width:100%}.cloud-backup-actions button:disabled{opacity:.55;cursor:default}
      .cloud-backup-last{color:#8fa2c2;font-size:11px;margin:9px 0 0;line-height:1.4}
      @media(max-width:350px){.cloud-backup-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    document.getElementById('btnCloudConnect').addEventListener('click', connectFolder);
    document.getElementById('btnCloudSync').addEventListener('click', function () {
      synchronize({ manual: true });
    });
  }

  function updateUI(message) {
    const text = document.getElementById('cloudBackupText');
    const badge = document.getElementById('cloudBackupBadge');
    const last = document.getElementById('cloudBackupLast');
    const connect = document.getElementById('btnCloudConnect');
    const sync = document.getElementById('btnCloudSync');
    if (!text || !badge || !last || !connect || !sync) return;

    if (!nativeBackup) {
      badge.textContent = 'No APK';
      badge.className = 'cloud-backup-badge';
      text.textContent = 'A sincronização automática estará disponível no aplicativo Android.';
      last.textContent = 'Nesta versão web, use Exportar backup na aba Histórico.';
      connect.disabled = true;
      sync.disabled = true;
      return;
    }

    if (!meta.connected) {
      badge.textContent = 'Não conectado';
      badge.className = 'cloud-backup-badge warn';
      text.textContent = 'Escolha a pasta “Ponto App Pessoal” dentro do Google Drive.';
      last.textContent = 'Você fará isso apenas na primeira configuração deste aparelho.';
      connect.textContent = 'Escolher pasta no Drive';
      connect.disabled = false;
      sync.disabled = true;
      return;
    }

    badge.textContent = meta.dirty ? 'Pendente' : 'Protegido';
    badge.className = 'cloud-backup-badge ' + (meta.dirty ? 'warn' : 'ok');
    text.textContent = message || (meta.dirty
      ? 'Há alterações aguardando envio para o Drive.'
      : 'Histórico e configurações protegidos no Google Drive.');
    connect.textContent = 'Trocar pasta';
    connect.disabled = false;
    sync.disabled = false;
    last.textContent = meta.lastSyncedAt
      ? 'Última sincronização: ' + formatDateTime(meta.lastSyncedAt) + ' • Pasta: ' + (meta.folderName || 'Ponto App Pessoal')
      : 'Ainda não houve sincronização nesta instalação.';
  }

  function setBusy(isBusy, message) {
    const connect = document.getElementById('btnCloudConnect');
    const sync = document.getElementById('btnCloudSync');
    const text = document.getElementById('cloudBackupText');
    if (connect) connect.disabled = isBusy;
    if (sync) sync.disabled = isBusy || !meta.connected;
    if (isBusy && text && message) text.textContent = message;
    if (!isBusy) updateUI();
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'não informada';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async function init() {
    injectUI();
    nativeBackup = getNativeBackup();

    const notice = sessionStorage.getItem('app_ponto_cloud_notice');
    if (notice) {
      sessionStorage.removeItem('app_ponto_cloud_notice');
      setTimeout(function () { alert(notice); }, 250);
    }

    if (!nativeBackup) {
      updateUI();
      return;
    }

    try {
      const status = await nativeBackup.getStatus();
      meta.connected = !!status.connected;
      meta.folderName = status.folderName || meta.folderName || '';
      writeMeta();
      updateUI();
      if (status.connected) await synchronize({ manual: false });
    } catch (error) {
      showError(error);
    }
  }

  window.PontoCloudSync = {
    buildSnapshot: buildSnapshot,
    normalizeSnapshot: normalizeSnapshot,
    chooseSyncAction: chooseSyncAction,
    synchronize: function () { return synchronize({ manual: true }); },
    connectFolder: connectFolder
  };

  window.addEventListener('online', function () { scheduleSync(300); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && meta.dirty) scheduleSync(300);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 850); });
  } else {
    setTimeout(init, 850);
  }
})();
