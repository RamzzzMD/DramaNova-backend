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

app.get('/api/video', (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('Parameter URL wajib diisi');
    }

    const client = targetUrl.startsWith('https') ? https : http;
    
    // Teruskan header 'Range' agar fitur skip/seek (mempercepat) video bisa berfungsi
    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': targetUrl // Terkadang server butuh referer URL aslinya
        }
    };
    
    if (req.headers.range) {
        options.headers['Range'] = req.headers.range;
    }

    // Stream video secara langsung tanpa memuatnya ke memori (mencegah Vercel crash)
    client.get(targetUrl, options, (proxyRes) => {
        // Hapus header bawaan yang mungkin menyebabkan bentrok CORS
        delete proxyRes.headers['access-control-allow-origin'];
        delete proxyRes.headers['access-control-allow-methods'];
        
        // Tulis ulang header ke respons kita agar video bisa diputar di React
        res.writeHead(proxyRes.statusCode, {
            ...proxyRes.headers,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Cross-Origin-Resource-Policy': 'cross-origin'
        });
        
        // Alirkan (pipe) data video langsung ke browser
        proxyRes.pipe(res);
    }).on('error', (err) => {
        console.error('Video proxy error:', err);
        res.status(500).send('Gagal memproses streaming video');
    });
});

// Endpoint untuk mengecek apakah server aktif
app.get('/', (req, res) => {
    res.send('Subtitle Bypass API berjalan normal dan siap di Vercel.');
});

// Ekspor app untuk serverless Vercel (Jangan gunakan app.listen)
module.exports = app;
