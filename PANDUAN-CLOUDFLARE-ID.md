# Panduan Cloudflare untuk server multiplayer

Cloudflare baru disiapkan sebagai alternatif Render. Akun pada tangkapan layar sudah aktif dan belum memerlukan kartu. **Game belum online** sampai Worker berhasil di-deploy, Netlify tersambung ke alamat Worker, dan dua perangkat berbeda berhasil bermain.

## Berkas yang ditambahkan ke repository yang sama

Unggah dua berkas ini langsung ke bagian teratas repository `Timun-Mas-Game`:

- `worker.mjs`
- `wrangler.jsonc`

Jangan hapus berkas game atau Netlify yang sudah ada. Jangan membuat repository baru.

## Pengaturan Worker di Cloudflare

1. Di **Workers & Pages → Create application**, pilih repository `fllourensiusw/Timun-Mas-Game` yang sudah tersambung.
2. Pastikan root/build directory adalah bagian teratas repository. Biarkan **Build command** kosong.
3. Pada **Advanced settings**, biarkan perintah deploy bawaan `npx wrangler deploy` jika ditampilkan. Jangan isi rahasia, variabel, atau kartu.
4. Pilih **Save and Deploy**. Jika ada pesan kesalahan, jangan menebak pengaturan: salin teks kesalahan atau kirim tangkapan layar.
5. Setelah berhasil, alamat Worker biasanya berbentuk `https://timun-mas-game-server.fllourensiusw.workers.dev`. Endpoint realtime game adalah alamat itu ditambah `/ws`, dengan protokol `wss://`.

## Hubungkan halaman game di Netlify

Di pengaturan situs Netlify, tambahkan environment variable:

- Nama: `GAME_SERVER_URL`
- Nilai: `wss://timun-mas-game-server.fllourensiusw.workers.dev/ws`

Ganti hostname contoh dengan hostname Worker yang benar dari Cloudflare. Lalu deploy ulang situs Netlify. Jika Netlify belum dibuat, impor repository yang sama sebagai situs statis dan gunakan build command `node build-netlify.mjs` serta publish directory `dist`; set `GAME_SERVER_URL` sebelum deploy.

## Batasan demo

- Semua room dikoordinasikan oleh satu Durable Object agar server sederhana untuk game kecil. Jangan memakai susunan ini untuk beban besar atau banyak room aktif tanpa pengujian dan pemisahan actor per room.
- Batas gratis Cloudflare berlaku. Pesan WebSocket yang terlalu sering dapat menghabiskan jatah harian.
- Game server menyimpan room di storage Durable Object, tetapi tautan multiplayer baru dianggap siap setelah deploy sukses dan diuji dari komputer serta ponsel/jaringan berbeda.
- Render tetap ada di repository, tetapi Cloudflare Worker memakai `worker.mjs` dan `wrangler.jsonc`.
