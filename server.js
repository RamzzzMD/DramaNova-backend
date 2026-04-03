const express = require('express');
const cors = require('cors');
const { shannz: cf } = require('bycf');
const https = require('https');
const http = require('http');

const app = express();

// Mengizinkan akses dari frontend manapun
app.use(cors());
app.use(express.json());

// Endpoint utama untuk bypass subtitle (tetap dipertahankan)
app.get('/api/subtitle', async (req, res) => {
    try {
        const targetUrl = req.query.url;
        
        if (!targetUrl) {
            return res.status(400).json({ error: 'Parameter "url" wajib diisi' });
        }

        console.log(`[GET] Mengambil subtitle dari: ${targetUrl}`);
        const content = await cf.source(targetUrl);

        if (!content) {
             throw new Error("Konten tidak ditemukan atau kosong");
        }

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

// === ENDPOINT PROXY VIDEO DENGAN WAF SESSION BYPASS ===
app.get('/api/video', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('Parameter URL wajib diisi');
    }

    try {
        console.log(`[GET] Memulai bypass WAF untuk video: ${targetUrl}`);
        
        // 1. Dapatkan WAF session (cookies & headers) menggunakan bycf
        const session = await cf.wafSession(targetUrl);
        console.log("WAF Session berhasil didapatkan.");

        // 2. Siapkan opsi request streaming video dengan sesi valid yang ditembus
        const client = targetUrl.startsWith('https') ? https : http;
        const options = {
            headers: {
                ...session.headers,
                'Cookie': session.cookies,
                'Referer': targetUrl // Terkadang server meminta referer yang sesuai
            }
        };
        
        // Teruskan header Range agar penonton bisa mempercepat/memundurkan (skip/seek) video
        if (req.headers.range) {
            options.headers['Range'] = req.headers.range;
        }

        // 3. Streaming video secara langsung tanpa menumpuknya di memori server Vercel
        client.get(targetUrl, options, (proxyRes) => {
            // Hapus header bawaan yang berisiko memicu bentrok CORS di browser
            delete proxyRes.headers['access-control-allow-origin'];
            delete proxyRes.headers['access-control-allow-methods'];
            
            // Tulis ulang header respons dengan menambahkan izin CORS penuh
            res.writeHead(proxyRes.statusCode, {
                ...proxyRes.headers,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Cross-Origin-Resource-Policy': 'cross-origin'
            });
            
            // Alirkan (pipe) data video mentah langsung ke frontend React
            proxyRes.pipe(res);
        }).on('error', (err) => {
            console.error('Video proxy streaming error:', err);
            res.status(500).send('Gagal memproses streaming video setelah bypass');
        });

    } catch (error) {
        console.error("Gagal mendapatkan WAF Session:", error.message);
        res.status(500).send('Gagal menembus proteksi video (WAF Error)');
    }
});

// Endpoint untuk mengecek apakah server aktif
app.get('/', (req, res) => {
    res.send('Subtitle & Video Bypass API berjalan normal dan siap di Vercel.');
});

// Ekspor app untuk serverless Vercel (Jangan gunakan app.listen)
module.exports = app;
