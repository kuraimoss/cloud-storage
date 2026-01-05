const express = require('express');
const { requireWebAuth } = require('../middlewares/requireWebAuth');
const {
  downloadShared,
  legacyTokenRedirect,
  rawShared,
  viewShared,
} = require('../controllers/web/publicShareController');
const { rawOfficePreview } = require('../controllers/web/publicPreviewController');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session?.userId) return res.redirect('/dashboard');
  return res.redirect('/login');
});

router.get('/login', (req, res) => {
  if (req.session?.userId) return res.redirect('/dashboard');
  return res.render('pages/login', { title: 'Sign in' });
});

router.post('/logout', (req, res) => {
  if (!req.session) return res.redirect('/login');
  req.session.destroy(() => res.redirect('/login'));
});

router.get('/dashboard', requireWebAuth, (req, res) =>
  res.render('pages/dashboard', {
    title: 'Dashboard',
    activePage: 'dashboard',
    sessionUser: { username: req.session.username, role: req.session.role },
  }),
);
router.get('/upload', requireWebAuth, (req, res) =>
  res.render('pages/upload', {
    title: 'Upload',
    activePage: 'upload',
    sessionUser: { username: req.session.username, role: req.session.role },
  }),
);
router.get('/files', requireWebAuth, (req, res) =>
  res.render('pages/files', {
    title: 'My Files',
    activePage: 'files',
    sessionUser: { username: req.session.username, role: req.session.role },
  }),
);
router.get('/shared', requireWebAuth, (req, res) =>
  res.render('pages/shared', {
    title: 'Shared',
    activePage: 'shared',
    sessionUser: { username: req.session.username, role: req.session.role },
  }),
);
router.get('/account', requireWebAuth, (req, res) =>
  res.render('pages/account', {
    title: 'Account',
    activePage: 'account',
    sessionUser: { username: req.session.username, role: req.session.role },
  }),
);

router.get('/admin/users', requireWebAuth, (req, res) => {
  if (req.session?.role !== 'super_admin') return res.status(403).redirect('/dashboard');
  return res.render('pages/admin-users', {
    title: 'Admin · Users',
    activePage: 'admin',
    sessionUser: { username: req.session.username, role: req.session.role },
  });
});

router.get('/f/:code', viewShared);
router.get('/f/:code/raw', rawShared);
router.get('/f/:code/download', downloadShared);

router.get('/p/:token/raw', rawOfficePreview);

router.get('/s/:token', legacyTokenRedirect);

module.exports = { webRouter: router };
