const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/unifiedAuth');
const { validateRegister, validateLogin, validatePasswordChange } = require('../middleware/validation');

// パブリック（認証不要）ルート
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);

// プライベート（認証必須）ルート
router.get('/profile', requireAuth, authController.getProfile);
router.put('/profile', requireAuth, authController.updateProfile);
router.put('/password', requireAuth, validatePasswordChange, authController.changePassword);

// ログアウト（ブラックリスト処理）
router.post('/logout', requireAuth, authController.logout);

// トークンリフレッシュ
router.post('/refresh', authController.refreshToken);

module.exports = router;