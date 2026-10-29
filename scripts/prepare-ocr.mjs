// Reproducible, offline preparation after npm ci. No invoice or network access.
import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'public/ocr');
await mkdir(target, { recursive: true });
async function copy(source, name) {
  await copyFile(path.join(root, 'node_modules', source), path.join(target, name));
}
await copy('tesseract.js/dist/worker.min.js', 'worker.min.js');
for (const name of await readdir(path.join(root, 'node_modules/tesseract.js-core'))) {
  if (/^tesseract-core.*\.wasm(?:\.js)?$/.test(name)) await copy(`tesseract.js-core/${name}`, name);
}
for (const lang of ['tur', 'eng']) {
  await copy(`@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, `${lang}.traineddata.gz`);
}
await copy('tesseract.js/LICENSE.md', 'TESSERACT-LICENSE.txt');
await copy('tesseract.js-core/LICENSE', 'TESSERACT-CORE-LICENSE.txt');
await copy('pdfjs-dist/LICENSE', 'PDFJS-LICENSE.txt');
console.log('Yerel OCR dosyaları hazır: public/ocr');
