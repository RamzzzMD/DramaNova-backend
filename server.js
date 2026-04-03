const express = require('express');
const cors = require('cors');
const { shannz: cf } = require('bycf');

const app = express();

// Mengizinkan akses dari frontend manapun
app.use(cors());
app.use(express.json());

// Endpoint utama untuk bypass subtitle
app.get('/api/subtitle', async (req, res) => {
    try {
        const targetUrl = req.query.url;
        
        if (!targetUrl) {
            return res.status(400).json({ error: 'Parameter "url" wajib diisi' });
        }

        console.log(`[GET] Mengambil subtitle dari: ${targetUrl}`);

        // Menggunakan library bycf untuk melakukan bypass
        const content = await cf.source(targetUrl);

        if (!content) {
             throw new Error("Konten tidak ditemukan atau kosong");
        }

        // Set header agar output berupa teks biasa
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(content);

    } catch (error) {
        console.error('Error saat bypass subtitle:', error);
        res.status(500).json({ 
            error: 'Gagal mengambil subtitle', 
            details: error.message 
        });
    }
});

// Endpoint untuk mengecek apakah server aktif
app.get('/', (req, res) => {
    res.send('Subtitle Bypass API berjalan normal dan siap di Vercel.');
});

// Ekspor app untuk serverless Vercel (Jangan gunakan app.listen)
module.exports = app;
