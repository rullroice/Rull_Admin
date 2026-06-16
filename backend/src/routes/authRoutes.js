// src/routes/authRoutes.js

const express = require('express');
const router  = express.Router();
const { login, registro, perfil } = require('../controllers/authController');
const { authMiddleware }           = require('../middlewares/authMiddleware');

// POST /api/auth/login    → RF-01
router.post('/login',    login);

// POST /api/auth/register → RF-02
router.post('/register', registro);

// GET  /api/auth/me       → RF-03 (requiere token)
router.get('/me', authMiddleware, perfil);

module.exports = router;
