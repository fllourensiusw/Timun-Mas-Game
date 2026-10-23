# Panduan publikasi game

## Status sekarang

File game sudah disiapkan untuk dipasang sebagai dua layanan: halaman permainan di Netlify dan server room/WebSocket di Render. Game **belum online**. Saya belum dapat menguji URL publik dari dua perangkat/jaringan berbeda.

ChatGPT Sites tidak dapat saya operasikan dari sesi ini karena kontrol publikasinya tidak tersedia di sini. Jadi paket ini memakai Netlify untuk halaman game dan Render untuk multiplayer.

## Langkah publikasi

1. Unduh dan ekstrak `timun-mas-game-netlify.zip` ke satu folder.
2. Buat repository GitHub baru. Unggah semua isi folder langsung ke bagian teratas repository, termasuk `render.yaml`, `server.mjs`, dan `netlify.toml`.
3. Di Render, pilih **New → Blueprint**, sambungkan repository tadi, lalu terapkan `render.yaml`. Tunggu hingga layanan berhasil dibuat dan salin alamat `https://...onrender.com` yang diberikan.
4. Di Netlify, pilih **Add new project → Import an existing project** dan sambungkan repository yang sama. Tambahkan environment variable berikut sebelum deploy:

   - Nama: `GAME_SERVER_URL`
   - Nilai: `wss://alamat-server-render.onrender.com` (ganti dengan hostname Render dari langkah 3)

5. Deploy situs Netlify. Alamat production Netlify adalah link permainan untuk dibagikan. Di lobi, tombol **Copy invite** menyalin link publik beserta kode room.

GitHub, Render, dan Netlify memerlukan akun untuk pemilik yang menerbitkan. Pemain tidak perlu akun atau instalasi.

## Uji multiplayer lintas perangkat

Setelah kedua layanan berhasil deploy, buka link Netlify di komputer, buat room, lalu buka link undangan di ponsel memakai data seluler atau di perangkat lain pada jaringan berbeda. Pastikan dua pemain dapat menandai **Ready** dan memulai. Gerakkan masing-masing pemain, ambil item di satu perangkat, lalu pastikan perubahan terlihat di perangkat lain. Lanjutkan dengan mencoba menggunakan item dan menyelamatkan pemain yang tertangkap.

Jangan bagikan game sebagai multiplayer online terverifikasi sebelum uji tersebut berhasil. Uji sebelumnya hanya mengonfirmasi dua klien pada server lokal, bukan dua perangkat melalui internet.

## Catatan batasan

- Paket Netlify membangun halaman statis dan tersambung ke server Node terpisah; Netlify saja tidak menjalankan server room game ini.
- Paket ini menggunakan layanan gratis Render jika tersedia di akun. Layanan gratis dapat tidur setelah tidak aktif, jadi koneksi pertama mungkin perlu menunggu server bangun.
- Room berada di memori server dan hilang saat server dimulai ulang atau deploy ulang.
- Jangan menambah jumlah instance server sebelum arsitektur room bersama ditambahkan. Saat ini room hanya disimpan di satu proses server.
- Untuk deployment Git, tidak perlu memasang Node di komputer sendiri. Script `build-netlify.cmd` hanya diperlukan jika ingin membangun folder `dist` secara manual untuk unggahan Netlify Drop.
