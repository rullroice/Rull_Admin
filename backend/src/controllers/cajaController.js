// src/controllers/cajaController.js
// Vista de caja: equipos listos para cobro

const { getDb, dbAll } = require('../db');

// ── GET /api/caja ─────────────────────────────────────────────────────────────
// Retorna equipos en estado 'listo' (pendientes de cobro) con datos del cliente

async function equiposListos(req, res) {
  await getDb();
  const equipos = dbAll(
    `SELECT e.id, e.tipo, e.marca, e.requerimiento, e.ingresado_en, e.actualizado_en,
            c.id AS cliente_id,
            c.nombre || ' ' || c.apellido AS cliente_nombre,
            c.rut AS cliente_rut,
            c.telefono AS cliente_telefono
     FROM equipos e
     JOIN clientes c ON c.id = e.cliente_id
     WHERE e.estado = 'listo'
     ORDER BY e.actualizado_en ASC`,
    []
  );
  return res.json(equipos);
}

module.exports = { equiposListos };
