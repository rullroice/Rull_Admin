// src/controllers/equiposController.js
// CRUD de equipos con ciclo de estados validado (TE_01..TE_05)

const Joi = require('joi');
const { getDb, dbRun, dbGet, dbAll } = require('../db');

const TRANSICIONES = {
  ingresado:     ['en_revision'],
  en_revision:   ['en_reparacion', 'ingresado'],
  en_reparacion: ['listo', 'ingresado'],
  listo:         ['entregado'],
  entregado:     []
};

const ESTADOS_VALIDOS = Object.keys(TRANSICIONES);

const schemaEquipo = Joi.object({
  cliente_id:    Joi.number().integer().positive().required().messages({
    'any.required': 'El cliente es obligatorio',
    'number.base':  'El cliente debe ser un número válido'
  }),
  tipo:          Joi.string().valid('notebook', 'escritorio').required().messages({
    'any.only':     'El tipo debe ser notebook o escritorio',
    'any.required': 'El tipo es obligatorio'
  }),
  marca:         Joi.string().max(80).optional().allow('', null),
  requerimiento: Joi.string().min(5).required().messages({
    'string.min':   'El requerimiento debe tener al menos 5 caracteres',
    'any.required': 'El requerimiento es obligatorio'
  })
});

// ── GET /api/equipos ──────────────────────────────────────────────────────────

async function listar(req, res) {
  await getDb();
  const { estado, cliente_id } = req.query;
  const params      = [];
  const condiciones = [];

  if (estado) {
    condiciones.push('e.estado = ?');
    params.push(estado);
  }
  if (cliente_id) {
    condiciones.push('e.cliente_id = ?');
    params.push(cliente_id);
  }

  const where  = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';
  const equipos = dbAll(
    `SELECT e.*, c.nombre || ' ' || c.apellido AS cliente_nombre, c.rut AS cliente_rut
     FROM equipos e
     JOIN clientes c ON c.id = e.cliente_id
     ${where}
     ORDER BY e.id DESC`,
    params
  );
  return res.json(equipos);
}

// ── GET /api/equipos/:id ──────────────────────────────────────────────────────

async function obtener(req, res) {
  await getDb();
  const equipo = dbGet(
    `SELECT e.*, c.nombre || ' ' || c.apellido AS cliente_nombre, c.rut AS cliente_rut
     FROM equipos e
     JOIN clientes c ON c.id = e.cliente_id
     WHERE e.id = ?`,
    [req.params.id]
  );
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });
  return res.json(equipo);
}

// ── POST /api/equipos ─────────────────────────────────────────────────────────

async function crear(req, res) {
  const { error, value } = schemaEquipo.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: error.details[0].message });

  await getDb();
  const cliente = dbGet('SELECT id FROM clientes WHERE id = ?', [value.cliente_id]);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const { lastInsertRowid } = dbRun(
    'INSERT INTO equipos (cliente_id, tipo, marca, requerimiento) VALUES (?, ?, ?, ?)',
    [value.cliente_id, value.tipo, value.marca || null, value.requerimiento]
  );
  return res.status(201).json({ mensaje: 'Equipo registrado correctamente', id: lastInsertRowid });
}

// ── PUT /api/equipos/:id ──────────────────────────────────────────────────────

async function actualizar(req, res) {
  const { error, value } = schemaEquipo.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: error.details[0].message });

  await getDb();
  const equipo = dbGet('SELECT id, estado FROM equipos WHERE id = ?', [req.params.id]);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  if (equipo.estado === 'entregado') {
    return res.status(409).json({ error: 'No se puede modificar un equipo que ya fue entregado' });
  }

  const cliente = dbGet('SELECT id FROM clientes WHERE id = ?', [value.cliente_id]);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  dbRun(
    `UPDATE equipos
     SET cliente_id = ?, tipo = ?, marca = ?, requerimiento = ?,
         actualizado_en = datetime('now','localtime')
     WHERE id = ?`,
    [value.cliente_id, value.tipo, value.marca || null, value.requerimiento, req.params.id]
  );
  return res.json({ mensaje: 'Equipo actualizado correctamente' });
}

// ── PATCH /api/equipos/:id/estado ────────────────────────────────────────────

async function cambiarEstado(req, res) {
  const { estado } = req.body;

  if (!estado) return res.status(400).json({ error: 'El campo estado es obligatorio' });
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}` });
  }

  await getDb();
  const equipo = dbGet('SELECT id, estado FROM equipos WHERE id = ?', [req.params.id]);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  const transicionesValidas = TRANSICIONES[equipo.estado] || [];
  if (!transicionesValidas.includes(estado)) {
    return res.status(409).json({
      error:               `Transición inválida: '${equipo.estado}' → '${estado}'`,
      transiciones_validas: transicionesValidas
    });
  }

  dbRun(
    `UPDATE equipos SET estado = ?, actualizado_en = datetime('now','localtime') WHERE id = ?`,
    [estado, req.params.id]
  );
  return res.json({
    mensaje:         'Estado actualizado correctamente',
    estado_anterior: equipo.estado,
    estado_nuevo:    estado
  });
}

// ── DELETE /api/equipos/:id ───────────────────────────────────────────────────

async function eliminar(req, res) {
  await getDb();
  const equipo = dbGet('SELECT id, estado FROM equipos WHERE id = ?', [req.params.id]);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  if (['listo', 'entregado'].includes(equipo.estado)) {
    return res.status(409).json({ error: 'No se puede eliminar un equipo en estado listo o entregado' });
  }

  const tieneBoletas = dbGet('SELECT id FROM boletas WHERE equipo_id = ?', [req.params.id]);
  if (tieneBoletas) {
    return res.status(409).json({ error: 'No se puede eliminar un equipo que tiene boletas asociadas' });
  }

  dbRun('DELETE FROM equipos WHERE id = ?', [req.params.id]);
  return res.json({ mensaje: 'Equipo eliminado correctamente' });
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, eliminar };
