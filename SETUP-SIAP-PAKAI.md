# Setup Siap Pakai (Tanpa Terminal Setiap Saat)

## 1) Deploy backend sekali (Render)
1. Push folder project ini ke GitHub.
2. Buka Render -> `New` -> `Blueprint`.
3. Pilih repo yang berisi file `render.yaml`.
4. Saat diminta env var, isi:
   - `OPENAI_API_KEY` = API key kamu
5. Tunggu deploy selesai.
6. Catat URL backend, contoh:
   - `https://midea-chat-proxy.onrender.com`

## 2) Sambungkan frontend ke backend (langsung dari aplikasi)
1. Buka website GitHub Pages kamu.
2. Masuk `Profil`.
3. Di bagian `Koneksi AI`, isi:
   - `https://midea-chat-proxy.onrender.com/api/chat`
4. Klik `Simpan URL`.
5. Coba chat lagi di `Tanya Kami`.

## 3) Cek cepat jika masih fallback
Tes endpoint backend:
- `https://midea-chat-proxy.onrender.com/api/health`

Harus muncul JSON seperti:
- `"ok": true`
- `"apiKeyConfigured": true`

Jika `apiKeyConfigured` false, berarti env `OPENAI_API_KEY` di Render belum benar.
