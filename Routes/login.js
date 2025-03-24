const express = require('express');
const router = express.Router();
const path = require('path');

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const redirect = req.query.redirect || '/';

    if (username === 'root' && password === 'kura') {
        res.cookie('userToken', 'authenticated-user-token', { httpOnly: true });
        res.cookie('username', username, { httpOnly: true });
        res.json({ success: true, redirect: decodeURIComponent(redirect) });
    } else {
        res.status(401).json({ success: false, error: 'Invalid username or password' });
    }
});

module.exports = router;