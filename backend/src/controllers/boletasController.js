// src/controllers/boletasController.js
// Emisión de boletas — lógica de cobro según DRF
// total = precio - descuento
// saldo = total - anticipo
// vuelto = max(0, monto_pagado - saldo)
// Solo se emite si equipo.estado === 'listo'; al emitir → estado 'entregado'

const Joi = require('joi');
const { getDb, dbRun, dbGet, dbAll } = require('../db');

const schemaBoleta = Joi.object({
  equipo_id:    Joi.number().integer().positive().required().messages({
    'any.required': 'El equipo es obligatorio'
  }),
  servicio_id:  Joi.number().integer().positive().required().messages({
    'any.required': 'El servicio es obligatorio'
  }),
  anticipo:     Joi.number().min(0).default(0).messages({
    'number.min': 'El anticipo no puede ser negativo'
  }),
  descuento:    Joi.number().min(0).default(0).messages({
    'number.min': 'El descuento no puede ser negativo'
  }),
  monto_pagado: Joi.number().min(0).required().messages({
    'number.min':   'El monto pagado no puede ser negativo',
    'any.required': 'El monto pagado es obligatorio'
  })
});

// ── GET /api/boletas ──────────────────────────────────────────────────────────

async function listar(req, res) {
  await getDb();
  const boletas = dbAll(
    `SELECT b.*,
            s.nombre AS servicio_nombre,
            c.nombre || ' ' || c.apellido AS cliente_nombre,
            c.rut AS cliente_rut
     FROM boletas b
     JOIN servicios s ON s.id = b.servicio_id
     JOIN equipos  e ON e.id = b.equipo_id
     JOIN clientes c ON c.id = e.cliente_id
     ORDER BY b.id DESC`,
    []
  );
  return res.json(boletas);
}

// ── GET /api/boletas/:id ──────────────────────────────────────────────────────

async function obtener(req, res) {
  await getDb();
  const boleta = dbGet(
    `SELECT b.*,
            s.nombre AS servicio_nombre,
            c.nombre || ' ' || c.apellido AS cliente_nombre,
            c.rut AS cliente_rut
     FROM boletas b
     JOIN servicios s ON s.id = b.servicio_id
     JOIN equipos  e ON e.id = b.equipo_id
     JOIN clientes c ON c.id = e.cliente_id
     WHERE b.id = ?`,
    [req.params.id]
  );
  if (!boleta) return res.status(404).json({ error: 'Boleta no encontrada' });
  return res.json(boleta);
}

// ── POST /api/boletas ─────────────────────────────────────────────────────────

async function emitir(req, res) {
  const { error, value } = schemaBoleta.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { equipo_id, servicio_id, anticipo, descuento, monto_pagado } = value;
  await getDb();

  const equipo = dbGet('SELECT id, estado FROM equipos WHERE id = ?', [equipo_id]);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });
  if (equipo.estado !== 'listo') {
    return res.status(409).json({
      error: `Solo se puede emitir boleta para equipos en estado 'listo'. Estado actual: '${equipo.estado}'`
    });
  }

  const servicio = dbGet('SELECT id, costo FROM servicios WHERE id = ? AND activo = 1', [servicio_id]);
  if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado o inactivo' });

  const precio = servicio.costo;

  if (descuento > precio) {
    return res.status(400).json({ error: 'El descuento no puede superar el precio del servicio' });
  }

  const total = precio - descuento;

  // CEI_03: anticipo no puede superar el total
  if (anticipo > total) {
    return res.status(400).json({ error: 'El anticipo no puede superar el total a pagar' });
  }

  const saldo  = total - anticipo;
  const vuelto = Math.max(0, monto_pagado - saldo);

  const { lastInsertRowid } = dbRun(
    `INSERT INTO boletas (equipo_id, servicio_id, precio, anticipo, descuento, total, vuelto)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [equipo_id, servicio_id, precio, anticipo, descuento, total, vuelto]
  );

  // Cambiar equipo a entregado automáticamente al emitir boleta
  dbRun(
    `UPDATE equipos SET estado = 'entregado', actualizado_en = datetime('now','localtime') WHERE id = ?`,
    [equipo_id]
  );

  return res.status(201).json({
    mensaje: 'Boleta emitida correctamente',
    id:      lastInsertRowid,
    resumen: { precio, descuento, total, anticipo, saldo, vuelto }
  });
}

module.exports = { listar, obtener, emitir };
