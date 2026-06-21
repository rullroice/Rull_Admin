// src/controllers/serviciosController.js
// CRUD catálogo de servicios con soft delete

const Joi = require('joi');
const { getDb, dbRun, dbGet, dbAll } = require('../db');

const schemaServicio = Joi.object({
  nombre: Joi.string().min(2).max(100).required().messages({
    'string.min':   'El nombre debe tener al menos 2 caracteres',
    'any.required': 'El nombre es obligatorio'
  }),
  costo: Joi.number().min(0).required().messages({
    'number.min':   'El costo no puede ser negativo',
    'number.base':  'El costo debe ser un número válido',
    'any.required': 'El costo es obligatorio'
  })
});

// ── GET /api/servicios ────────────────────────────────────────────────────────

async function listar(req, res) {
  await getDb();
  const servicios = dbAll(
    'SELECT * FROM servicios WHERE activo = 1 ORDER BY nombre ASC',
    []
  );
  return res.json(servicios);
}

// ── GET /api/servicios/:id ────────────────────────────────────────────────────

async function obtener(req, res) {
  await getDb();
  const servicio = dbGet('SELECT * FROM servicios WHERE id = ?', [req.params.id]);
  if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });
  return res.json(servicio);
}

// ── POST /api/servicios ───────────────────────────────────────────────────────

async function crear(req, res) {
  const { error, value } = schemaServicio.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: error.details[0].message });

  await getDb();
  const { lastInsertRowid } = dbRun(
    'INSERT INTO servicios (nombre, costo) VALUES (?, ?)',
    [value.nombre, value.costo]
  );
  return res.status(201).json({ mensaje: 'Servicio creado correctamente', id: lastInsertRowid });
}

// ── PUT /api/servicios/:id ────────────────────────────────────────────────────

async function actualizar(req, res) {
  const { error, value } = schemaServicio.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: error.details[0].message });

  await getDb();
  const servicio = dbGet('SELECT id FROM servicios WHERE id = ?', [req.params.id]);
  if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });

  dbRun(
    'UPDATE servicios SET nombre = ?, costo = ? WHERE id = ?',
    [value.nombre, value.costo, req.params.id]
  );
  return res.json({ mensaje: 'Servicio actualizado correctamente' });
}

// ── DELETE /api/servicios/:id — soft delete (activo = 0) ─────────────────────

async function eliminar(req, res) {
  await getDb();
  const servicio = dbGet('SELECT id FROM servicios WHERE id = ?', [req.params.id]);
  if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });

  // Solo el superadmin puede forzar la desactivación (?forzar=true) pasando
  // por encima de la regla de negocio que protege servicios con boletas.
  const forzar = req.query.forzar === 'true' && req.user?.rol === 'superadmin';

  const tieneBoletas = dbGet('SELECT id FROM boletas WHERE servicio_id = ?', [req.params.id]);
  if (tieneBoletas && !forzar) {
    return res.status(409).json({ error: 'No se puede desactivar un servicio que tiene boletas asociadas' });
  }

  dbRun('UPDATE servicios SET activo = 0 WHERE id = ?', [req.params.id]);
  return res.json({ mensaje: 'Servicio desactivado correctamente' });
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
