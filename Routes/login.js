// Routes/login.js

const express = require('express');
const router = express.Router();
const path = require('path');

// GET: Halaman Login
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// POST: Proses Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Simulasi autentikasi
  if (username === 'kura' && password === 'kura') {
    // Set cookie token sederhana
    res.cookie('userToken', 'authenticated', { httpOnly: true });
    return res.redirect('/dashboard');
  } else {
    return res.status(401).send('Ups, kredensial salah!');
  }
});

// Meng-ekspor router
module.exports = router;
