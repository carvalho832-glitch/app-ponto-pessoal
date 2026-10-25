const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const script = fs.readFileSync('folgas.js', 'utf8');

function dia(data, opcoes = {}) {
  return Object.assign({
    data,
    entrada: data + 'T15:30:00',
    saidaFinal: data + 'T23:30:00',
    tipoDia: 'normal',
    motivoDia: ''
  }, opcoes);
}

function iniciar(registros) {
  const janela = {};
  const contexto = {
    window: janela,
    registros,
    document: {
      readyState: 'loading',
      addEventListener() {},
      getElementById() { return null; }
    },
    localStorage: { getItem() { return '{}'; } },
    calcularDia(registro) {
      return { trabalhadoPonto: registro.entrada && registro.saidaFinal ? 480 : 0, totalConsiderado: 480 };
    }
  };
  vm.runInNewContext(script, contexto, { filename: 'folgas.js' });
  return janela;
}

test('fim de semana completo gera 1 folga, sábado isolado não gera', () => {
  const app = iniciar({
    '2026-10-17': dia('2026-10-17'),
    '2026-10-18': dia('2026-10-18'),
    '2026-10-24': dia('2026-10-24')
  });
  assert.equal(app.calcularFolgasGanhas('2026-10'), 1);
  assert.equal(app.calcularFolgasAcumuladas('2026-10'), 1);
});

test('dois fins de semana acumulam e uso reduz saldo uma vez', () => {
  const app = iniciar({
    '2026-10-17': dia('2026-10-17'),
    '2026-10-18': dia('2026-10-18'),
    '2026-10-24': dia('2026-10-24'),
    '2026-10-25': dia('2026-10-25'),
    '2026-10-26': dia('2026-10-26', {
      entrada: null, saidaFinal: null, tipoDia: 'folga',
      folgaCompensatoriaUsada: true,
      motivoDia: 'Folga compensatória utilizada'
    })
  });
  const total = app.resumoBancoFolgas('2026-10-31');
  assert.equal(total.ganhas, 2);
  assert.equal(total.usadas, 1);
  assert.equal(total.saldo, 1);
  assert.equal(app.calcularFolgasAcumuladas('2026-10'), 1);
  assert.equal(app.calcularFolgasAcumuladas('2026-10'), 1);
});

test('reconhece folga compensatória antiga sem campo de marcador', () => {
  const app = iniciar({
    '2026-10-17': dia('2026-10-17'),
    '2026-10-18': dia('2026-10-18'),
    '2026-10-19': dia('2026-10-19', {
      entrada: null, saidaFinal: null, tipoDia: 'folga',
      motivoDia: 'Folga compensatória utilizada'
    })
  });
  assert.equal(app.calcularFolgasAcumuladas('2026-10'), 0);
});

test('folga comum, jornada trabalhada e marcador cancelado não descontam', () => {
  const app = iniciar({
    '2026-10-17': dia('2026-10-17'),
    '2026-10-18': dia('2026-10-18'),
    '2026-10-19': dia('2026-10-19', { entrada: null, saidaFinal: null, tipoDia: 'folga', motivoDia: 'Folga comum' }),
    '2026-10-20': dia('2026-10-20', { tipoDia: 'folga', motivoDia: 'Folga compensatória utilizada' }),
    '2026-10-21': dia('2026-10-21', { entrada: null, saidaFinal: null, tipoDia: 'folga', folgaCompensatoriaUsada: false, motivoDia: 'Folga compensatória utilizada' }),
    '2026-10-22': dia('2026-10-22', { entrada: null, saidaFinal: null, tipoDia: 'normal', folgaCompensatoriaUsada: true })
  });
  assert.equal(app.resumoBancoFolgas('2026-10-31').usadas, 0);
});

test('sábado de outubro e domingo de novembro geram crédito em novembro', () => {
  const app = iniciar({
    '2026-10-31': dia('2026-10-31'),
    '2026-11-01': dia('2026-11-01')
  });
  assert.equal(app.calcularFolgasGanhas('2026-10'), 0);
  assert.equal(app.calcularFolgasGanhas('2026-11'), 1);
  assert.equal(app.calcularFolgasAcumuladas('2026-10'), 0);
  assert.equal(app.calcularFolgasAcumuladas('2026-11'), 1);
});

test('sem saída final não credita fim de semana incompleto', () => {
  const app = iniciar({
    '2026-10-17': dia('2026-10-17'),
    '2026-10-18': dia('2026-10-18', { saidaFinal: null })
  });
  assert.equal(app.calcularFolgasGanhas('2026-10'), 0);
});
