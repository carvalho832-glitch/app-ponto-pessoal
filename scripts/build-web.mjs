import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(projectRoot, 'www');
const webFiles = [
  'index.html',
  'style.css',
  'script.js',
  'folgas.js',
  'features.js',
  'folha-ponto.js',
  'holerite-refinado.js',
  'status-dia.js',
  'rh-ajustes.js',
  'rh-final.js',
  'folga-compensatoria.js',
  'restaura-agosto-2026.js',
  'month-tools.js',
  'cloud-sync.js',
  'manifest.json',
  'icon.svg',
  'sw.js'
];

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const file of webFiles) {
  copyFileSync(join(projectRoot, file), join(outputDir, file));
}

console.log(`Web Android preparado com ${readdirSync(outputDir).length} arquivos.`);
