import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const resRoot = join(projectRoot, 'android', 'app', 'src', 'main', 'res');
const icon = await readFile(join(projectRoot, 'icon.svg'));
const foreground = await readFile(join(projectRoot, 'assets', 'android-icon-foreground.svg'));
const sizes = {
  mdpi: { launcher: 48, foreground: 108 },
  hdpi: { launcher: 72, foreground: 162 },
  xhdpi: { launcher: 96, foreground: 216 },
  xxhdpi: { launcher: 144, foreground: 324 },
  xxxhdpi: { launcher: 192, foreground: 432 }
};

for (const [density, size] of Object.entries(sizes)) {
  const directory = join(resRoot, `mipmap-${density}`);
  const launcher = sharp(icon).resize(size.launcher, size.launcher).png();
  await launcher.clone().toFile(join(directory, 'ic_launcher.png'));
  await launcher.clone().toFile(join(directory, 'ic_launcher_round.png'));
  await sharp(foreground)
    .resize(size.foreground, size.foreground)
    .png()
    .toFile(join(directory, 'ic_launcher_foreground.png'));
}

const splashSizes = [
  ['drawable/splash.png', 480, 320],
  ['drawable-land-mdpi/splash.png', 480, 320],
  ['drawable-land-hdpi/splash.png', 800, 480],
  ['drawable-land-xhdpi/splash.png', 1280, 720],
  ['drawable-land-xxhdpi/splash.png', 1600, 960],
  ['drawable-land-xxxhdpi/splash.png', 1920, 1280],
  ['drawable-port-mdpi/splash.png', 320, 480],
  ['drawable-port-hdpi/splash.png', 480, 800],
  ['drawable-port-xhdpi/splash.png', 720, 1280],
  ['drawable-port-xxhdpi/splash.png', 960, 1600],
  ['drawable-port-xxxhdpi/splash.png', 1280, 1920]
];

for (const [relativePath, width, height] of splashSizes) {
  const logoSize = Math.round(Math.min(width, height) * 0.34);
  const logo = await sharp(icon).resize(logoSize, logoSize).png().toBuffer();
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#0b1220'
    }
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(join(resRoot, relativePath));
}

console.log('Ícones e tela de abertura do Android atualizados.');
