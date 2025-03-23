const express = require('express');
const router = express.Router();
const path = require('path');

// Halaman login
router.get('/login', (req, res) => {
    // Jika sudah ada userToken, arahkan ke halaman utama
    if (req.cookies.userToken) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

// Proses login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Contoh autentikasi sederhana (ganti dengan logika autentikasi Anda)
    if (username === 'root' && password === 'kura') {
        // Set cookie userToken dan username
        res.cookie('userToken', 'authenticated-user-token', { httpOnly: true });
        res.cookie('username', username, { httpOnly: true }); // Simpan username di cookie
        res.json({ success: true, redirect: '/' });
    } else {
        res.status(401).json({ success: false, error: 'Invalid username or password' });
    }
});

module.exports = router;