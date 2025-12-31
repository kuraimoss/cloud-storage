const crypto = require('crypto');
const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { env } = require('../config/env');
const { requireAuth } = require('../middlewares/requireAuth');
const { requireSuperAdmin } = require('../middlewares/requireSuperAdmin');
const { getUserUploadDir } = require('../utils/uploads');

const authController = require('../controllers/api/authController');
const dashboardController = require('../controllers/api/dashboardController');
const filesController = require('../controllers/api/filesController');
const sharesController = require('../controllers/api/sharesController');
const adminUsersController = require('../controllers/api/adminUsersController');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const dir = getUserUploadDir(req.session.userId);
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 16);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadBytes, files: 20 },
});

router.get('/health', (_req, res) => res.json({ ok: true }));

router.post('/auth/login', loginLimiter, authController.login);
router.post('/auth/logout', authController.logout);
router.get('/me', authController.me);

router.get('/dashboard', requireAuth, dashboardController.getDashboard);

router.get('/files', requireAuth, filesController.list);
router.post('/files', requireAuth, upload.array('files', 20), filesController.upload);
router.get('/files/:id/download', requireAuth, filesController.download);
router.get('/files/:id/preview', requireAuth, filesController.preview);
router.delete('/files/:id', requireAuth, filesController.remove);
router.post('/files/:id/rename', requireAuth, filesController.rename);
router.post('/files/:id/share', requireAuth, sharesController.toggle);

router.get('/shares', requireAuth, sharesController.list);

router.get('/admin/users', requireSuperAdmin, adminUsersController.listUsers);
router.post('/admin/users', requireSuperAdmin, adminUsersController.createUser);
router.post('/admin/users/:id/quota', requireSuperAdmin, adminUsersController.updateQuota);
router.delete('/admin/users/:id', requireSuperAdmin, adminUsersController.deleteUser);

module.exports = { apiRouter: router };
