import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../cloud-sync.js', import.meta.url), 'utf8');

class FakeStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function createContext(initial = {}) {
  const localStorage = new FakeStorage();
  const sessionStorage = new FakeStorage();
  for (const [key, value] of Object.entries(initial)) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  const window = {
    crypto: { randomUUID: () => 'device-test' },
    addEventListener() {},
    Capacitor: null
  };
  const document = {
    readyState: 'loading',
    hidden: false,
    addEventListener() {},
    getElementById() { return null; }
  };

  const context = vm.createContext({
    window,
    document,
    localStorage,
    sessionStorage,
    Storage: FakeStorage,
    location: { reload() {} },
    navigator: { onLine: true },
    alert() {},
    clearTimeout() {},
    setTimeout() { return 1; },
    console,
    crypto: window.crypto
  });
  window.window = window;

  vm.runInContext(source, context, { filename: 'cloud-sync.js' });
  return { context, localStorage, api: window.PontoCloudSync };
}

test('gera snapshot com todos os grupos de dados locais', () => {
  const { api } = createContext({
    app_ponto_pessoal_registros_v9: { '2026-08-02': { entrada: '2026-08-02T15:30:00' } },
    app_ponto_pessoal_config_v9: { cargaDiaria: '08:48' },
    app_ponto_extras_v2: { remindersEnabled: true },
    app_ponto_descontos_auto_v1: { ativo: true }
  });

  const snapshot = api.buildSnapshot();
  assert.equal(snapshot.appId, 'br.com.juliocarvalho.pontoapp');
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.data.config.cargaDiaria, '08:48');
  assert.equal(snapshot.data.extras.remindersEnabled, true);
  assert.equal(snapshot.data.descontosAuto.ativo, true);
});

test('aceita o formato de backup manual já existente', () => {
  const { api } = createContext();
  const backup = api.normalizeSnapshot({
    version: 2,
    exportedAt: '2026-08-02T12:00:00.000Z',
    registros: { '2026-08-01': { observacao: 'Teste' } },
    config: { salarioBase: 4473 },
    extras: { onlyWeekdays: true }
  });

  assert.equal(backup.updatedAt, '2026-08-02T12:00:00.000Z');
  assert.equal(backup.data.registros['2026-08-01'].observacao, 'Teste');
  assert.equal(backup.data.config.salarioBase, 4473);
});

test('marca o backup como pendente quando um dado muda', () => {
  const { localStorage } = createContext();
  localStorage.setItem('app_ponto_pessoal_registros_v9', JSON.stringify({
    '2026-08-02': { entrada: '2026-08-02T15:30:00' }
  }));

  const meta = JSON.parse(localStorage.getItem('app_ponto_cloud_meta_v1'));
  assert.equal(meta.dirty, true);
  assert.equal(meta.deviceId, 'device-test');
});

test('rejeita arquivo que não contém registros de ponto', () => {
  const { api } = createContext();
  assert.throws(() => api.normalizeSnapshot({ qualquer: 'coisa' }), /não pertence/i);
});

test('restaura a nuvem na primeira conexão de uma instalação vazia', () => {
  const { api } = createContext();
  const action = api.chooseSyncAction({
    firstConnection: true,
    hasLocalData: false,
    remoteTime: 100,
    localTime: 200,
    dirty: true
  });
  assert.equal(action, 'restore');
});

test('envia a cópia local quando ela é a mais nova e contém dados', () => {
  const { api } = createContext();
  const action = api.chooseSyncAction({
    firstConnection: true,
    hasLocalData: true,
    remoteTime: 100,
    localTime: 200,
    dirty: true
  });
  assert.equal(action, 'upload');
});
