import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const assetsDir = path.resolve('dist/assets');
const entryRawLimit = Number(process.env.BUNDLE_ENTRY_RAW_LIMIT ?? 900_000);
const entryGzipLimit = Number(process.env.BUNDLE_ENTRY_GZIP_LIMIT ?? 300_000);

if (!fs.existsSync(assetsDir)) {
  console.error('Bundle budget check failed: dist/assets not found.');
  process.exit(1);
}

const jsAssets = fs
  .readdirSync(assetsDir)
  .filter((name) => name.endsWith('.js'))
  .sort();

const entryAsset = jsAssets.find((name) => /^index-.*\.js$/.test(name));

if (!entryAsset) {
  console.error('Bundle budget check failed: entry bundle not found.');
  process.exit(1);
}

const editorAssets = jsAssets.filter((name) => name.includes('editor-core'));

const fileSize = (file) => fs.readFileSync(path.join(assetsDir, file));
const toKb = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;

const entryBuffer = fileSize(entryAsset);
const entryRaw = entryBuffer.byteLength;
const entryGzip = zlib.gzipSync(entryBuffer).byteLength;
const editorRaw = editorAssets.reduce(
  (total, file) => total + fileSize(file).byteLength,
  0,
);

console.log(`Entry bundle: ${entryAsset}`);
console.log(`- raw: ${toKb(entryRaw)}`);
console.log(`- gzip: ${toKb(entryGzip)}`);
console.log(
  `Editor async bundle(s): ${editorAssets.length} file(s), raw total ${toKb(editorRaw)}`,
);

if (entryRaw > entryRawLimit || entryGzip > entryGzipLimit) {
  console.error(
    `Bundle budget check failed: entry exceeds limits (raw <= ${toKb(entryRawLimit)}, gzip <= ${toKb(entryGzipLimit)}).`,
  );
  process.exit(1);
}
