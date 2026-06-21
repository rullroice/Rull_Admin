// tests/boletas.test.js
// Suite de pruebas — Módulo Boletas (lógica de cobro según DRF)
// Partición de equivalencia: anticipo >= 0, anticipo <= total, descuento <= precio

process.env.JWT_SECRET     = 'clave_test_rulltec';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV       = 'test';

const request = require('supertest');
const { createTestDb, closeDb } = require('../src/db');
const { crearAdminYObtenerToken } = require('./helpers');

let app;
let token;
let equipoListoId;  // equipo en estado 'listo' listo para boleta
let equipoPendiente; // equipo en estado 'ingresado' (no listo)
let servicioId;

beforeAll(async () => {
  await createTestDb();
  app = require('../server');

  // Usuario
  token = await crearAdminYObtenerToken(app, {
    nombre: 'Admin', email: 'admin@boletas.cl', password: 'password123'
  });

  // Cliente
  const resCliente = await request(app)
    .post('/api/clientes')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Ana', apellido: 'Martínez', rut: '11.111.111-1' });
  const clienteId = resCliente.body.id;

  // Servicio
  const resServicio = await request(app)
    .post('/api/servicios')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Cambio de pantalla', costo: 50000 });
  servicioId = resServicio.body.id;

  // Equipo en estado 'listo' (avanzamos a través del ciclo)
  const resEquipo = await request(app)
    .post('/api/equipos')
    .set('Authorization', `Bearer ${token}`)
    .send({ cliente_id: clienteId, tipo: 'notebook', requerimiento: 'Pantalla rota' });
  equipoListoId = resEquipo.body.id;

  await request(app).patch(`/api/equipos/${equipoListoId}/estado`)
    .set('Authorization', `Bearer ${token}`).send({ estado: 'en_revision' });
  await request(app).patch(`/api/equipos/${equipoListoId}/estado`)
    .set('Authorization', `Bearer ${token}`).send({ estado: 'en_reparacion' });
  await request(app).patch(`/api/equipos/${equipoListoId}/estado`)
    .set('Authorization', `Bearer ${token}`).send({ estado: 'listo' });

  // Equipo en estado ingresado (para probar bloqueo)
  const resPendiente = await request(app)
    .post('/api/equipos')
    .set('Authorization', `Bearer ${token}`)
    .send({ cliente_id: clienteId, tipo: 'escritorio', requerimiento: 'No prende el monitor' });
  equipoPendiente = resPendiente.body.id;
});

afterAll(() => closeDb());

// ════════════════════════════════════════════════════════════════════════════
// Acceso protegido
// ════════════════════════════════════════════════════════════════════════════

describe('Boletas — Acceso protegido', () => {
  test('TC-B01 | GET /api/boletas sin token → 401', async () => {
    const res = await request(app).get('/api/boletas');
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Reglas de negocio — Tabla de Decisión DRF
// ════════════════════════════════════════════════════════════════════════════

describe('Boletas — Validaciones de negocio', () => {
  test('TC-B02 | POST con equipo NO en estado listo → 409', async () => {
    const res = await request(app)
      .post('/api/boletas')
      .set('Authorization', `Bearer ${token}`)
      .send({ equipo_id: equipoPendiente, servicio_id: servicioId, monto_pagado: 50000 });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('listo');
  });

  test('TC-B03 | POST con equipo inexistente → 404', async () => {
    const res = await request(app)
      .post('/api/boletas')
      .set('Authorization', `Bearer ${token}`)
      .send({ equipo_id: 9999, servicio_id: servicioId, monto_pagado: 50000 });

    expect(res.status).toBe(404);
  });

  test('TC-B04 | POST con servicio inexistente → 404', async () => {
    const res = await request(app)
      .post('/api/boletas')
      .set('Authorization', `Bearer ${token}`)
      .send({ equipo_id: equipoListoId, servicio_id: 9999, monto_pagado: 50000 });

    expect(res.status).toBe(404);
  });

  test('TC-B05 | CEI_04: anticipo negativo → 400', async () => {
    const res = await request(app)
      .post('/api/boletas')
      .set('Authorization', `Bearer ${token}`)
      .send({ equipo_id: equipoListoId, servicio_id: servicioId, anticipo: -1000, monto_pagado: 50000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('negativo');
  });

  test('TC-B06 | CEI_03: anticipo > total → 400', async () => {
    const res = await request(app)
      .post('/api/boletas')
      .set('Authorization', `Bearer ${token}`)
      // servicio.costo = 50000, total = 50000-0 = 50000, anticipo = 60000 > total
      .send({ equipo_id: equipoListoId, servicio_id: servicioId, anticipo: 60000, monto_pagado: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('anticipo');
  });

  test('TC-B07 | Descuento > precio → 400', async () => {
    const res = await request(app)
      .post('/api/boletas')
      .set('Authorization', `Bearer ${token}`)
      .send({ equipo_id: equipoListoId, servicio_id: servicioId, descuento: 99999, monto_pagado: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('descuento');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// R1: Reparación completada — sin anticipo (precio completo)
// ════════════════════════════════════════════════════════════════════════════

describe('Boletas — Emisión y cálculos', () => {
  let boletaId;

  test('TC-B08 | R1: emitir boleta válida (sin anticipo, sin descuento) → 201 + resumen correcto', async () => {
    const res = await request(app)
      .post('/api/boletas')
      .set('Authorization', `Bearer ${token}`)
      // precio=50000, descuento=0, total=50000, anticipo=0, saldo=50000, monto_pagado=60000 → vuelto=10000
      .send({ equipo_id: equipoListoId, servicio_id: servicioId, monto_pagado: 60000 });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.resumen.total).toBe(50000);
    expect(res.body.resumen.vuelto).toBe(10000);
    boletaId = res.body.id;
  });

  test('TC-B09 | Equipo cambia a estado entregado al emitir boleta', async () => {
    const res = await request(app)
      .get(`/api/equipos/${equipoListoId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('entregado');
  });

  test('TC-B10 | GET /api/boletas → 200 + lista con datos del cliente y servicio', async () => {
    const res = await request(app)
      .get('/api/boletas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].servicio_nombre).toBeDefined();
    expect(res.body[0].cliente_nombre).toBeDefined();
  });

  test('TC-B11 | GET /api/boletas/:id → 200 + datos completos', async () => {
    const res = await request(app)
      .get(`/api/boletas/${boletaId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.precio).toBe(50000);
    expect(res.body.total).toBe(50000);
  });

  test('TC-B12 | POST boleta con anticipo: total=precio-descuento, vuelto correcto', async () => {
    // Crear nuevo equipo y avanzarlo a listo
    const resCliente = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Luis', apellido: 'Vera', rut: '1.234.567-4' });

    const resEquipo = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: resCliente.body.id, tipo: 'notebook', requerimiento: 'Batería dañada' });
    const eqId = resEquipo.body.id;

    await request(app).patch(`/api/equipos/${eqId}/estado`)
      .set('Authorization', `Bearer ${token}`).send({ estado: 'en_revision' });
    await request(app).patch(`/api/equipos/${eqId}/estado`)
      .set('Authorization', `Bearer ${token}`).send({ estado: 'en_reparacion' });
    await request(app).patch(`/api/equipos/${eqId}/estado`)
      .set('Authorization', `Bearer ${token}`).send({ estado: 'listo' });

    // precio=50000, descuento=5000, total=45000, anticipo=10000, saldo=35000, monto_pagado=35000 → vuelto=0
    const res = await request(app)
      .post('/api/boletas')
      .set('Authorization', `Bearer ${token}`)
      .send({ equipo_id: eqId, servicio_id: servicioId, anticipo: 10000, descuento: 5000, monto_pagado: 35000 });

    expect(res.status).toBe(201);
    expect(res.body.resumen.total).toBe(45000);
    expect(res.body.resumen.saldo).toBe(35000);
    expect(res.body.resumen.vuelto).toBe(0);
  });
});
