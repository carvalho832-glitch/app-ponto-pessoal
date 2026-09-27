(function () {
  'use strict';

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyC491G5AvZitsgG0kOtFwsejxUEGcr-JwU',
    authDomain: 'app-ponto-pessoal.firebaseapp.com',
    projectId: 'app-ponto-pessoal',
    storageBucket: 'app-ponto-pessoal.firebasestorage.app',
    messagingSenderId: '310315470024',
    appId: '1:310315470024:web:a6f5867d4d6ac5202be9fd'
  };

  const META_KEY = 'app_ponto_firebase_meta_v1';
  const DATA_KEYS = {
    registros: 'app_ponto_pessoal_registros_v9',
    config: 'app_ponto_pessoal_config_v9',
    extras: 'app_ponto_extras_v2',
    descontosAuto: 'app_ponto_descontos_auto_v1'
  };
  const SYNC_KEYS = Object.values(DATA_KEYS);
  const SYNC_DELAY_MS = 1400;

  let applyingRemote = false;
  let syncTimer = null;
  let syncing = false;
  let currentUser = null;
  let auth = null;
  let db = null;
  let meta = readJSON(META_KEY, {});

  installStorageObserver();
  ensureMeta();

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

  function installStorageObserver() {
    if (window.__pontoFirebaseStorageObserver) return;
    window.__pontoFirebaseStorageObserver = true;

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

  function markLocalChange() {
    meta.localUpdatedAt = new Date().toISOString();
    meta.dirty = true;
    writeMeta();
    updateUI();
    scheduleSync();
  }

  function scheduleSync(delay) {
    if (!currentUser || syncing) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      synchronize({ manual: false });
    }, typeof delay === 'number' ? delay : SYNC_DELAY_MS);
  }

  function hasMeaningfulLocalData() {
    return SYNC_KEYS.some(function (key) {
      const value = readJSON(key, {});
      return value && typeof value === 'object' && Object.keys(value).length > 0;
    });
  }

  function buildSnapshot() {
    return {
      app: 'Ponto App Pessoal',
      schemaVersion: 2,
      clientUpdatedAt: meta.localUpdatedAt || new Date().toISOString(),
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
    if (!payload || typeof payload !== 'object' || !payload.data) {
      throw new Error('Backup do Firebase inválido.');
    }

    return {
      clientUpdatedAt: payload.clientUpdatedAt || payload.updatedAt || new Date(0).toISOString(),
      data: {
        registros: payload.data.registros || {},
        config: payload.data.config || {},
        extras: payload.data.extras || {},
        descontosAuto: payload.data.descontosAuto || {}
      }
    };
  }

  function timestamp(value) {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function chooseSyncAction(state) {
    if (!state.remoteExists) return 'upload';
    if (state.firstForUser) return 'restore';
    if (state.remoteTime > state.localTime) return 'restore';
    if (state.dirty || state.localTime > state.remoteTime) return 'upload';
    return 'none';
  }

  function snapshotRef(user) {
    return db.collection('users').doc(user.uid).collection('app').doc('state');
  }

  async function uploadLocalSnapshot() {
    if (!currentUser || !db) return;

    const snapshot = buildSnapshot();
    await snapshotRef(currentUser).set(Object.assign({}, snapshot, {
      email: currentUser.email || '',
      serverUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }));

    meta.lastSyncedAt = new Date().toISOString();
    meta.lastUid = currentUser.uid;
    meta.dirty = false;
    meta.lastError = '';
    writeMeta();
    updateUI('Backup atualizado no Firebase.');
  }

  function applyRemoteSnapshot(snapshot) {
    applyingRemote = true;
    try {
      localStorage.setItem(DATA_KEYS.registros, JSON.stringify(snapshot.data.registros || {}));
      localStorage.setItem(DATA_KEYS.config, JSON.stringify(snapshot.data.config || {}));
      localStorage.setItem(DATA_KEYS.extras, JSON.stringify(snapshot.data.extras || {}));
      localStorage.setItem(DATA_KEYS.descontosAuto, JSON.stringify(snapshot.data.descontosAuto || {}));

      meta.localUpdatedAt = snapshot.clientUpdatedAt;
      meta.lastSyncedAt = new Date().toISOString();
      meta.lastUid = currentUser ? currentUser.uid : meta.lastUid;
      meta.dirty = false;
      meta.lastError = '';
      writeMeta();
      sessionStorage.setItem('app_ponto_firebase_notice', 'Dados restaurados da sua conta Firebase.');
    } finally {
      applyingRemote = false;
    }

    location.reload();
  }

  async function synchronize(options) {
    options = options || {};
    if (!currentUser || !db || syncing) return;

    syncing = true;
    setBusy(true, 'Sincronizando seus pontos...');

    try {
      const previousUid = meta.lastUid || '';
      const firstForUser = previousUid !== currentUser.uid;
      const doc = await snapshotRef(currentUser).get();

      if (!doc.exists) {
        if (firstForUser && previousUid && previousUid !== currentUser.uid && hasMeaningfulLocalData()) {
          const importar = confirm('Esta conta ainda não tem backup. Deseja enviar os dados que já estão neste aparelho para ela?');
          if (!importar) {
            meta.lastUid = currentUser.uid;
            meta.lastError = 'Importação local não realizada.';
            writeMeta();
            updateUI('Conta conectada. Os dados locais ainda não foram enviados.');
            return;
          }
        }

        await uploadLocalSnapshot();
        return;
      }

      const remote = normalizeSnapshot(doc.data());
      const action = chooseSyncAction({
        remoteExists: true,
        firstForUser: firstForUser,
        remoteTime: timestamp(remote.clientUpdatedAt),
        localTime: timestamp(meta.localUpdatedAt),
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
      meta.lastUid = currentUser.uid;
      meta.dirty = false;
      meta.lastError = '';
      writeMeta();
      updateUI('Tudo atualizado no Firebase.');
    } catch (error) {
      showError(error);
      if (options.manual) {
        alert('Não consegui sincronizar agora. Seus pontos continuam salvos neste aparelho.');
      }
    } finally {
      syncing = false;
      setBusy(false);
    }
  }

  function showError(error) {
    meta.lastError = String(error && (error.message || error) || 'Falha desconhecida');
    writeMeta();
    updateUI('Sem sincronização agora. Os dados locais continuam seguros.');
  }

  function firebaseErrorMessage(error) {
    const code = String(error && error.code || '');
    const messages = {
      'auth/email-already-in-use': 'Este e-mail já possui uma conta. Use Entrar.',
      'auth/invalid-email': 'Digite um e-mail válido.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/user-not-found': 'Conta não encontrada.',
      'auth/wrong-password': 'E-mail ou senha incorretos.',
      'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
      'auth/network-request-failed': 'Sem conexão com a internet.'
    };
    return messages[code] || String(error && (error.message || error) || 'Não foi possível concluir.');
  }

  function getCredentials() {
    const email = document.getElementById('firebaseEmail');
    const password = document.getElementById('firebasePassword');
    return {
      email: email ? email.value.trim() : '',
      password: password ? password.value : ''
    };
  }

  async function createAccount() {
    if (!auth) return;
    const credentials = getCredentials();
    if (!credentials.email) {
      alert('Digite seu e-mail.');
      return;
    }
    if (credentials.password.length < 6) {
      alert('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setBusy(true, 'Criando sua conta...');
    try {
      await auth.createUserWithEmailAndPassword(credentials.email, credentials.password);
      meta.lastError = '';
      meta.lastEmail = credentials.email;
      writeMeta();
    } catch (error) {
      alert(firebaseErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    if (!auth) return;
    const credentials = getCredentials();
    if (!credentials.email || !credentials.password) {
      alert('Digite o e-mail e a senha.');
      return;
    }

    setBusy(true, 'Entrando na sua conta...');
    try {
      await auth.signInWithEmailAndPassword(credentials.email, credentials.password);
      meta.lastError = '';
      meta.lastEmail = credentials.email;
      writeMeta();
    } catch (error) {
      alert(firebaseErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!auth) return;
    const credentials = getCredentials();
    if (!credentials.email) {
      alert('Digite seu e-mail para receber a recuperação de senha.');
      return;
    }

    setBusy(true, 'Enviando recuperação de senha...');
    try {
      await auth.sendPasswordResetEmail(credentials.email);
      alert('E-mail de recuperação enviado.');
    } catch (error) {
      alert(firebaseErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!auth) return;
    await auth.signOut();
  }

  function injectUI() {
    const screen = document.getElementById('telaConfig');
    if (!screen || document.getElementById('firebaseBackupBox')) return;

    const section = document.createElement('section');
    section.className = 'box firebase-backup-box';
    section.id = 'firebaseBackupBox';
    section.innerHTML = [
      '<div class="firebase-backup-head">',
      '  <div><h3>Conta e backup</h3><p id="firebaseBackupText">Preparando o Firebase...</p></div>',
      '  <span id="firebaseBackupBadge" class="firebase-backup-badge">Verificando</span>',
      '</div>',
      '<div id="firebaseLoggedOut">',
      '  <label class="firebase-field">E-mail<input id="firebaseEmail" type="email" autocomplete="email" placeholder="seuemail@gmail.com"></label>',
      '  <label class="firebase-field">Senha<input id="firebasePassword" type="password" autocomplete="current-password" placeholder="Mínimo de 6 caracteres"></label>',
      '  <div class="firebase-actions">',
      '    <button id="btnFirebaseLogin" class="ok">Entrar</button>',
      '    <button id="btnFirebaseCreate" class="sec">Criar conta</button>',
      '  </div>',
      '  <button id="btnFirebaseReset" class="ghost full">Esqueci minha senha</button>',
      '</div>',
      '<div id="firebaseLoggedIn" style="display:none">',
      '  <p class="firebase-user" id="firebaseUser"></p>',
      '  <div class="firebase-actions">',
      '    <button id="btnFirebaseSync" class="ok">Sincronizar agora</button>',
      '    <button id="btnFirebaseLogout" class="sec">Sair da conta</button>',
      '  </div>',
      '</div>',
      '<p id="firebaseBackupLast" class="firebase-backup-last"></p>'
    ].join('');

    screen.insertBefore(section, screen.firstChild);

    const style = document.createElement('style');
    style.id = 'firebaseBackupStyle';
    style.textContent = [
      '.firebase-backup-box{background:linear-gradient(145deg,#10263b,#0d1b2d)}',
      '.firebase-backup-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}',
      '.firebase-backup-head h3{margin-bottom:5px}.firebase-backup-head p{color:#a8b6d2;font-size:12px;line-height:1.4;margin:0}',
      '.firebase-backup-badge{border:1px solid #34506f;background:#14283d;color:#dcecff;border-radius:999px;padding:6px 9px;font-size:11px;white-space:nowrap}',
      '.firebase-backup-badge.ok{border-color:#287848;background:#123624;color:#bdf5ce}',
      '.firebase-backup-badge.warn{border-color:#7c5a27;background:#392b16;color:#ffe1a8}',
      '.firebase-field{display:block;color:#b9c6dc;font-size:12px;margin-top:10px}.firebase-field input{width:100%;box-sizing:border-box;margin-top:5px}',
      '.firebase-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.firebase-actions button{width:100%}',
      '.firebase-user{color:#dcecff;font-weight:600;word-break:break-word;margin:12px 0 4px}',
      '.firebase-backup-last{color:#8fa2c2;font-size:11px;margin:9px 0 0;line-height:1.4}',
      '@media(max-width:350px){.firebase-actions{grid-template-columns:1fr}}'
    ].join('');

    document.head.appendChild(style);

    document.getElementById('btnFirebaseLogin').addEventListener('click', signIn);
    document.getElementById('btnFirebaseCreate').addEventListener('click', createAccount);
    document.getElementById('btnFirebaseReset').addEventListener('click', resetPassword);
    document.getElementById('btnFirebaseSync').addEventListener('click', function () {
      synchronize({ manual: true });
    });
    document.getElementById('btnFirebaseLogout').addEventListener('click', signOut);

    const email = document.getElementById('firebaseEmail');
    if (email && meta.lastEmail) email.value = meta.lastEmail;
  }

  function updateUI(message) {
    const text = document.getElementById('firebaseBackupText');
    const badge = document.getElementById('firebaseBackupBadge');
    const last = document.getElementById('firebaseBackupLast');
    const loggedOut = document.getElementById('firebaseLoggedOut');
    const loggedIn = document.getElementById('firebaseLoggedIn');
    const userText = document.getElementById('firebaseUser');
    if (!text || !badge || !last || !loggedOut || !loggedIn || !userText) return;

    if (!window.firebase || !auth || !db) {
      badge.textContent = 'Local';
      badge.className = 'firebase-backup-badge warn';
      text.textContent = 'Firebase indisponível. O app continua salvando no aparelho.';
      last.textContent = 'A sincronização será tentada quando houver conexão.';
      loggedOut.style.display = 'none';
      loggedIn.style.display = 'none';
      return;
    }

    if (!currentUser) {
      badge.textContent = 'Sem conta';
      badge.className = 'firebase-backup-badge warn';
      text.textContent = 'Entre ou crie uma conta para proteger seus registros na nuvem.';
      last.textContent = 'Seus pontos atuais permanecem salvos neste aparelho.';
      loggedOut.style.display = '';
      loggedIn.style.display = 'none';
      return;
    }

    loggedOut.style.display = 'none';
    loggedIn.style.display = '';
    userText.textContent = 'Conectado como ' + (currentUser.email || 'usuário Firebase');
    badge.textContent = meta.dirty ? 'Pendente' : 'Protegido';
    badge.className = 'firebase-backup-badge ' + (meta.dirty ? 'warn' : 'ok');
    text.textContent = message || (meta.dirty
      ? 'Há alterações aguardando envio para o Firebase.'
      : 'Seus registros estão protegidos na sua conta.');

    const parts = [];
    if (meta.lastSyncedAt) parts.push('Última sincronização: ' + formatDateTime(meta.lastSyncedAt));
    if (meta.lastError) parts.push('Último aviso: ' + meta.lastError);
    last.textContent = parts.join(' • ') || 'A primeira sincronização acontecerá automaticamente.';
  }

  function setBusy(isBusy, message) {
    ['btnFirebaseLogin','btnFirebaseCreate','btnFirebaseReset','btnFirebaseSync','btnFirebaseLogout'].forEach(function (id) {
      const button = document.getElementById(id);
      if (button) button.disabled = isBusy;
    });

    const text = document.getElementById('firebaseBackupText');
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

  function initUI() {
    injectUI();

    const notice = sessionStorage.getItem('app_ponto_firebase_notice');
    if (notice) {
      sessionStorage.removeItem('app_ponto_firebase_notice');
      setTimeout(function () { updateUI(notice); }, 100);
    } else {
      updateUI();
    }
  }

  window.PontoFirebaseSync = {
    buildSnapshot: buildSnapshot,
    normalizeSnapshot: normalizeSnapshot,
    chooseSyncAction: chooseSyncAction,
    synchronize: function () { return synchronize({ manual: true }); }
  };

  if (!window.firebase) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUI);
    } else {
      initUI();
    }
    return;
  }

  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();

    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});
    db.enablePersistence({ synchronizeTabs: true }).catch(function () {});

    auth.onAuthStateChanged(async function (user) {
      currentUser = user || null;
      updateUI();

      if (!currentUser) return;

      meta.lastEmail = currentUser.email || meta.lastEmail || '';
      writeMeta();
      await synchronize({ manual: false });
    });

    window.addEventListener('online', function () { scheduleSync(250); });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && meta.dirty) scheduleSync(250);
    });
  } catch (error) {
    meta.lastError = String(error && (error.message || error) || 'Falha ao iniciar Firebase');
    writeMeta();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();