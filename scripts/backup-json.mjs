import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

// JSON snapshot only. Media files require a separate filesystem backup.
const source = path.resolve(process.env.MARKETINGPILOT_DATA_DIR || 'data', 'marketingpilot.json');
const bytes = await readFile(source);
const data = JSON.parse(bytes.toString('utf8'));
if (!Array.isArray(data.users) || !Array.isArray(data.workspaces)) throw new Error('Invalid store; backup aborted.');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const folder = path.resolve('private-backups', `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`);
await mkdir(folder, { recursive: true });
const target = path.join(folder, 'marketingpilot.json');
await writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
if (sha256(await readFile(target)) !== sha256(bytes)) throw new Error('Backup verification failed.');
const sourceUnchanged = sha256(await readFile(source)) === sha256(bytes);
await writeFile(path.join(folder, 'manifest.json'), JSON.stringify({
  createdAt: new Date().toISOString(), sha256: sha256(bytes), sourceUnchanged,
  counts: Object.fromEntries(Object.entries(data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])),
}, null, 2), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ backup: folder, verified: true, sourceUnchanged }));
if (!sourceUnchanged) process.exitCode = 1;
