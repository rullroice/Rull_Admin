// src/routes/authRoutes.js

const express = require('express');
const router  = express.Router();
const { login, registro, perfil, listarUsuarios, asignarRol, eliminarUsuario } = require('../controllers/authController');
const { authMiddleware, soloSuperAdmin }                                       = require('../middlewares/authMiddleware');

// POST /api/auth/login    → RF-01
router.post('/login',    login);

// POST /api/auth/register → RF-02
router.post('/register', registro);

// GET  /api/auth/me       → RF-03 (requiere token)
router.get('/me', authMiddleware, perfil);

// ── Consola superadmin: asignar quién es el administrador del taller ────────
// GET    /api/auth/usuarios          → lista usuarios y sus roles
// PATCH  /api/auth/usuarios/:id/rol  → asigna rol 'admin' o 'cajero' a un usuario
// DELETE /api/auth/usuarios/:id      → elimina la cuenta de un usuario
router.get('/usuarios',           authMiddleware, soloSuperAdmin, listarUsuarios);
router.patch('/usuarios/:id/rol', authMiddleware, soloSuperAdmin, asignarRol);
router.delete('/usuarios/:id',    authMiddleware, soloSuperAdmin, eliminarUsuario);

module.exports = router;
