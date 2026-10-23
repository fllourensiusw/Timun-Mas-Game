import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, 'dist');
const configured = String(process.env.GAME_SERVER_URL || '').trim();

if (!configured) {
  throw new Error('Set GAME_SERVER_URL to the public WebSocket URL (wss://your-server.example) before building the Netlify site.');
}

const endpoint = new URL(configured);
if (endpoint.protocol === 'https:') endpoint.protocol = 'wss:';
if (endpoint.protocol === 'http:') endpoint.protocol = 'ws:';
if (endpoint.protocol !== 'wss:') {
  throw new Error('A public Netlify site requires a secure WebSocket URL beginning with wss:// (or an https:// host, which is converted automatically).');
}
if (endpoint.username || endpoint.password) throw new Error('Do not include credentials in GAME_SERVER_URL.');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'style.css', 'client.js']) {
  await copyFile(join(root, file), join(output, file));
}
await writeFile(join(output, 'config.js'), `window.GAME_SERVER_URL = ${JSON.stringify(endpoint.toString().replace(/\/$/, ''))};\n`);
console.log(`Netlify files prepared in ${output}`);
