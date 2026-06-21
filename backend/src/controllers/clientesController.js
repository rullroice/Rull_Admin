// src/controllers/clientesController.js
// CRUD de clientes con validación de RUT chileno (módulo 11)

const Joi = require('joi');
const { getDb, dbRun, dbGet, dbAll } = require('../db');

// ── Helpers RUT ───────────────────────────────────────────────────────────────

function limpiarRut(rut) {
  return String(rut).replace(/[\.\-\s]/g, '').toUpperCase().trim();
}

function validarDigitoRut(rut) {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv     = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;

  let suma = 0;
  let mul  = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * mul;
    mul   = mul === 7 ? 2 : mul + 1;
  }
  const dvCalc     = 11 - (suma % 11);
  const dvEsperado = dvCalc === 11 ? '0' : dvCalc === 10 ? 'K' : String(dvCalc);
  return dv === dvEsperado;
}

function formatearRut(rut) {
  const limpio = limpiarRut(rut);
  const cuerpo = limpio.slice(0, -1);
  const dv     = limpio.slice(-1);
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
}

// ── Esquema Joi ───────────────────────────────────────────────────────────────

const schemaCliente = Joi.object({
  nombre:   Joi.string().min(2).max(80).required().messages({
    'string.min':   'El nombre debe tener al menos 2 caracteres',
    'any.required': 'El nombre es obligatorio'
  }),
  apellido: Joi.string().min(2).max(80).required().messages({
    'string.min':   'El apellido debe tener al menos 2 caracteres',
    'any.required': 'El apellido es obligatorio'
  }),
  rut:      Joi.string().required().messages({
    'any.required': 'El RUT es obligatorio'
  }),
  telefono: Joi.string().max(20).optional().allow('', null)
});

// ── GET /api/clientes ─────────────────────────────────────────────────────────

async function listar(req, res) {
  await getDb();
  const { q } = req.query;
  let clientes;
  if (q) {
    const like = `%${q}%`;
    clientes = dbAll(
      `SELECT * FROM clientes
       WHERE nombre LIKE ? OR apellido LIKE ? OR rut LIKE ?
       ORDER BY id DESC`,
      [like, like, like]
    );
  } else {
    clientes = dbAll('SELECT * FROM clientes ORDER BY id DESC', []);
  }
  return res.json(clientes);
}

// ── GET /api/clientes/:id ─────────────────────────────────────────────────────

async function obtener(req, res) {
  await getDb();
  const cliente = dbGet('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  return res.json(cliente);
}

// ── POST /api/clientes ────────────────────────────────────────────────────────

async function crear(req, res) {
  const { error, value } = schemaCliente.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: error.details[0].message });

  if (!validarDigitoRut(value.rut)) {
    return res.status(400).json({ error: 'El RUT ingresado no es válido (dígito verificador incorrecto)' });
  }

  const rutFormateado = formatearRut(value.rut);
  await getDb();

  const existe = dbGet('SELECT id FROM clientes WHERE rut = ?', [rutFormateado]);
  if (existe) return res.status(409).json({ error: 'Ya existe un cliente con ese RUT' });

  const { lastInsertRowid } = dbRun(
    'INSERT INTO clientes (nombre, apellido, rut, telefono) VALUES (?, ?, ?, ?)',
    [value.nombre, value.apellido, rutFormateado, value.telefono || null]
  );
  return res.status(201).json({ mensaje: 'Cliente registrado correctamente', id: lastInsertRowid });
}

// ── PUT /api/clientes/:id ─────────────────────────────────────────────────────

async function actualizar(req, res) {
  const { error, value } = schemaCliente.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: error.details[0].message });

  if (!validarDigitoRut(value.rut)) {
    return res.status(400).json({ error: 'El RUT ingresado no es válido (dígito verificador incorrecto)' });
  }

  const rutFormateado = formatearRut(value.rut);
  await getDb();

  const cliente = dbGet('SELECT id FROM clientes WHERE id = ?', [req.params.id]);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const duplicado = dbGet(
    'SELECT id FROM clientes WHERE rut = ? AND id != ?',
    [rutFormateado, req.params.id]
  );
  if (duplicado) return res.status(409).json({ error: 'Ya existe otro cliente con ese RUT' });

  dbRun(
    'UPDATE clientes SET nombre = ?, apellido = ?, rut = ?, telefono = ? WHERE id = ?',
    [value.nombre, value.apellido, rutFormateado, value.telefono || null, req.params.id]
  );
  return res.json({ mensaje: 'Cliente actualizado correctamente' });
}

// ── DELETE /api/clientes/:id ──────────────────────────────────────────────────

async function eliminar(req, res) {
  await getDb();
  const cliente = dbGet('SELECT id FROM clientes WHERE id = ?', [req.params.id]);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  // Solo el superadmin puede forzar el borrado (?forzar=true) pasando por
  // encima de la regla de negocio que protege a clientes con equipos.
  const forzar = req.query.forzar === 'true' && req.user?.rol === 'superadmin';

  const equiposCliente = dbAll('SELECT id FROM equipos WHERE cliente_id = ?', [req.params.id]);
  if (equiposCliente.length && !forzar) {
    return res.status(409).json({ error: 'No se puede eliminar un cliente que tiene equipos registrados' });
  }

  if (forzar) {
    for (const eq of equiposCliente) {
      dbRun('DELETE FROM boletas WHERE equipo_id = ?', [eq.id]);
    }
    dbRun('DELETE FROM equipos WHERE cliente_id = ?', [req.params.id]);
  }

  dbRun('DELETE FROM clientes WHERE id = ?', [req.params.id]);
  return res.json({ mensaje: 'Cliente eliminado correctamente' });
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
