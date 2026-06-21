// src/middlewares/authMiddleware.js
// Verifica el token JWT en cada ruta protegida.
// CORRECCIÓN del bug RF-03: distingue TokenExpiredError de JsonWebTokenError.

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = header.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, rol, iat, exp }
    next();
  } catch (e) {
    // ── CORRECCIÓN RF-03 ──────────────────────────────────────────
    // El bug original usaba un catch genérico y siempre retornaba
    // "No autorizado". Ahora distinguimos el tipo de error para que
    // el cliente sepa exactamente qué debe hacer.
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado, por favor inicie sesión nuevamente',
        code:  'TOKEN_EXPIRED'
      });
    }
    // JsonWebTokenError, NotBeforeError, etc.
    return res.status(401).json({
      error: 'Token inválido',
      code:  'TOKEN_INVALID'
    });
  }
}

// Middleware que solo permite acceso a administradores
function soloAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

// Middleware que solo permite acceso al superadministrador (consola).
// El superadmin es el único rol que puede asignar quién es el administrador del taller.
function soloSuperAdmin(req, res, next) {
  if (req.user?.rol !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso restringido al superadministrador' });
  }
  next();
}

module.exports = { authMiddleware, soloAdmin, soloSuperAdmin };
