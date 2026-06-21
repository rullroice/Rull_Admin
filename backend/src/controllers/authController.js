// src/controllers/authController.js
// RF-01: Login con JWT
// RF-02: Registro con validación Joi
// RF-03: Consulta de perfil (protegido por authMiddleware)

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const Joi    = require('joi');
const { getDb, dbRun, dbGet, dbAll } = require('../db');

// ── Esquemas de validación ───────────────────────────────────────────────────

const schemaLogin = Joi.object({
  email:    Joi.string().email().required().messages({
    'string.email': 'El correo electrónico no tiene un formato válido',
    'any.required': 'El correo es obligatorio'
  }),
  password: Joi.string().min(1).required().messages({
    'any.required': 'La contraseña es obligatoria'
  })
});

const schemaRegistro = Joi.object({
  nombre:   Joi.string().min(2).max(80).required().messages({
    'string.min': 'El nombre debe tener al menos 2 caracteres',
    'any.required': 'El nombre es obligatorio'
  }),
  email:    Joi.string().email().required().messages({
    'string.email': 'El correo electrónico no tiene un formato válido',
    'any.required': 'El correo es obligatorio'
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'La contraseña debe tener al menos 8 caracteres',
    'any.required': 'La contraseña es obligatoria'
  })
  // El rol NO se acepta desde el registro público: todo usuario nuevo entra
  // como 'cajero'. Solo el superadmin puede ascender a alguien a 'admin'
  // mediante PATCH /api/auth/usuarios/:id/rol.
});

const schemaAsignarRol = Joi.object({
  rol: Joi.string().valid('admin', 'cajero').required().messages({
    'any.only':     "El rol debe ser 'admin' o 'cajero'",
    'any.required': 'El rol es obligatorio'
  })
});

// ── RF-01: Login ─────────────────────────────────────────────────────────────

async function login(req, res) {
  const { error, value } = schemaLogin.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { email, password } = value;
  await getDb();

  const usuario = dbGet('SELECT * FROM usuarios WHERE email = ?', [email]);
  if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas' });

  const coincide = await bcrypt.compare(password, usuario.hash);
  if (!coincide) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = jwt.sign(
    { id: usuario.id, email: usuario.email, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return res.json({
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
  });
}

// ── RF-02: Registro ───────────────────────────────────────────────────────────

async function registro(req, res) {
  const { error, value } = schemaRegistro.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { nombre, email, password } = value;
  await getDb();

  const existe = dbGet('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (existe) return res.status(409).json({ error: 'El correo ya está registrado' });

  const hash = await bcrypt.hash(password, 10);
  const resultado = dbRun(
    'INSERT INTO usuarios (nombre, email, hash, rol) VALUES (?, ?, ?, ?)',
    [nombre, email, hash, 'cajero']
  );

  return res.status(201).json({ mensaje: 'Usuario registrado correctamente', id: resultado.lastInsertRowid });
}

// ── RF-03: Perfil ─────────────────────────────────────────────────────────────

async function perfil(req, res) {
  await getDb();
  const usuario = dbGet(
    'SELECT id, nombre, email, rol, creado_en FROM usuarios WHERE id = ?',
    [req.user.id]
  );
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  return res.json(usuario);
}

// ── Consola superadmin: gestión de roles ─────────────────────────────────────
// El superadmin es quien asigna qué usuario es el administrador del taller.

async function listarUsuarios(req, res) {
  await getDb();
  const usuarios = dbAll('SELECT id, nombre, email, rol, creado_en FROM usuarios ORDER BY id');
  return res.json(usuarios);
}

async function asignarRol(req, res) {
  const { error, value } = schemaAsignarRol.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: error.details[0].message });

  const id = Number(req.params.id);
  await getDb();

  const usuario = dbGet('SELECT id, rol FROM usuarios WHERE id = ?', [id]);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (usuario.rol === 'superadmin') {
    return res.status(403).json({ error: 'No se puede modificar el rol del superadministrador' });
  }

  dbRun('UPDATE usuarios SET rol = ? WHERE id = ?', [value.rol, id]);
  return res.json({ mensaje: `Rol actualizado a '${value.rol}' correctamente` });
}

async function eliminarUsuario(req, res) {
  const id = Number(req.params.id);
  await getDb();

  const usuario = dbGet('SELECT id, rol FROM usuarios WHERE id = ?', [id]);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (usuario.rol === 'superadmin') {
    return res.status(403).json({ error: 'No se puede eliminar al superadministrador' });
  }
  if (id === req.user.id) {
    return res.status(403).json({ error: 'No puedes eliminar tu propio usuario' });
  }

  dbRun('DELETE FROM usuarios WHERE id = ?', [id]);
  return res.json({ mensaje: 'Usuario eliminado correctamente' });
}

module.exports = { login, registro, perfil, listarUsuarios, asignarRol, eliminarUsuario };
