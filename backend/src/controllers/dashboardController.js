// src/controllers/dashboardController.js
// Métricas diarias del panel de control

const { getDb, dbGet, dbAll } = require('../db');

// ── GET /api/dashboard ────────────────────────────────────────────────────────

async function resumen(req, res) {
  await getDb();

  const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const boletasHoy    = dbAll(
    `SELECT total FROM boletas WHERE date(emitida_en) = date('now','localtime')`,
    []
  );
  const atenciones_hoy   = boletasHoy.length;
  const recaudacion_hoy  = boletasHoy.reduce((sum, b) => sum + b.total, 0);

  const estados          = ['ingresado', 'en_revision', 'en_reparacion', 'listo', 'entregado'];
  const equipos_por_estado = {};
  for (const estado of estados) {
    const row = dbGet('SELECT COUNT(*) AS total FROM equipos WHERE estado = ?', [estado]);
    equipos_por_estado[estado] = row ? row.total : 0;
  }

  return res.json({
    fecha: hoy,
    atenciones_hoy,
    recaudacion_hoy,
    equipos_por_estado
  });
}

module.exports = { resumen };
