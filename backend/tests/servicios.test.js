// tests/servicios.test.js
// Suite de pruebas — Módulo Servicios (catálogo + soft delete)

process.env.JWT_SECRET     = 'clave_test_rulltec';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV       = 'test';

const request = require('supertest');
const { createTestDb, closeDb } = require('../src/db');
const { crearAdminYObtenerToken, crearSuperAdminYObtenerToken } = require('./helpers');

let app;
let token;

beforeAll(async () => {
  await createTestDb();
  app = require('../server');

  token = await crearAdminYObtenerToken(app, {
    nombre: 'Admin Test', email: 'admin@servicios.cl', password: 'password123'
  });
});

afterAll(() => closeDb());

// ════════════════════════════════════════════════════════════════════════════
// Acceso protegido
// ════════════════════════════════════════════════════════════════════════════

describe('Servicios — Acceso protegido', () => {
  test('TC-S01 | GET /api/servicios sin token → 401', async () => {
    const res = await request(app).get('/api/servicios');
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CRUD servicios
// ════════════════════════════════════════════════════════════════════════════

describe('Servicios — CRUD', () => {
  let servicioId;
  let servicioConBoletaId;

  test('TC-S02 | POST con datos válidos → 201 + id', async () => {
    const res = await request(app)
      .post('/api/servicios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Formateo completo', costo: 25000 });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    servicioId = res.body.id;
  });

  test('TC-S03 | POST sin nombre → 400', async () => {
    const res = await request(app)
      .post('/api/servicios')
      .set('Authorization', `Bearer ${token}`)
      .send({ costo: 10000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('nombre');
  });

  test('TC-S04 | POST con costo negativo → 400', async () => {
    const res = await request(app)
      .post('/api/servicios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Diagnóstico', costo: -100 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('negativo');
  });

  test('TC-S05 | POST con costo 0 (gratuito) → 201', async () => {
    const res = await request(app)
      .post('/api/servicios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Revisión gratuita', costo: 0 });

    expect(res.status).toBe(201);
  });

  test('TC-S06 | GET /api/servicios → 200 + solo activos', async () => {
    const res = await request(app)
      .get('/api/servicios')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every(s => s.activo === 1)).toBe(true);
  });

  test('TC-S07 | GET /api/servicios/:id existente → 200', async () => {
    const res = await request(app)
      .get(`/api/servicios/${servicioId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Formateo completo');
    expect(res.body.costo).toBe(25000);
  });

  test('TC-S08 | GET /api/servicios/:id inexistente → 404', async () => {
    const res = await request(app)
      .get('/api/servicios/9999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('TC-S09 | PUT /api/servicios/:id → 200 + datos actualizados', async () => {
    const res = await request(app)
      .put(`/api/servicios/${servicioId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Formateo con instalación', costo: 30000 });

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBeDefined();

    const verificar = await request(app)
      .get(`/api/servicios/${servicioId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(verificar.body.costo).toBe(30000);
  });

  test('TC-S10 | DELETE sin boletas → 200 (soft delete activo=0)', async () => {
    const crear = await request(app)
      .post('/api/servicios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Servicio temporal', costo: 5000 });

    const res = await request(app)
      .delete(`/api/servicios/${crear.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toContain('desactivado');

    // El servicio NO aparece en el listado de activos
    const listado = await request(app)
      .get('/api/servicios')
      .set('Authorization', `Bearer ${token}`);
    expect(listado.body.find(s => s.id === crear.body.id)).toBeUndefined();
  });

  test('TC-S11 | DELETE servicio con boletas asociadas → 409', async () => {
    const crearServicio = await request(app)
      .post('/api/servicios')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Servicio con boleta', costo: 15000 });

    const crearCliente = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Cliente', apellido: 'Boleta', rut: '11.111.111-1' });

    const crearEquipo = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: crearCliente.body.id, tipo: 'notebook', requerimiento: 'Prueba de boleta' });

    await request(app).patch(`/api/equipos/${crearEquipo.body.id}/estado`)
      .set('Authorization', `Bearer ${token}`).send({ estado: 'en_revision' });
    await request(app).patch(`/api/equipos/${crearEquipo.body.id}/estado`)
      .set('Authorization', `Bearer ${token}`).send({ estado: 'en_reparacion' });
    await request(app).patch(`/api/equipos/${crearEquipo.body.id}/estado`)
      .set('Authorization', `Bearer ${token}`).send({ estado: 'listo' });

    await request(app)
      .post('/api/boletas')
      .set('Authorization', `Bearer ${token}`)
      .send({ equipo_id: crearEquipo.body.id, servicio_id: crearServicio.body.id, monto_pagado: 15000 });

    const res = await request(app)
      .delete(`/api/servicios/${crearServicio.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('boletas');

    servicioConBoletaId = crearServicio.body.id;
  });

  test('TC-S12 | DELETE servicio con boletas + ?forzar=true sin ser superadmin → sigue en 409', async () => {
    const res = await request(app)
      .delete(`/api/servicios/${servicioConBoletaId}?forzar=true`)
      .set('Authorization', `Bearer ${token}`); // token es 'admin', no 'superadmin'

    expect(res.status).toBe(409);
  });

  test('TC-S13 | DELETE servicio con boletas + ?forzar=true con superadmin → 200', async () => {
    const tokenSuper = await crearSuperAdminYObtenerToken(app);

    const res = await request(app)
      .delete(`/api/servicios/${servicioConBoletaId}?forzar=true`)
      .set('Authorization', `Bearer ${tokenSuper}`);

    expect(res.status).toBe(200);
  });
});
