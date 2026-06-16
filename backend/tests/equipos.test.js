// tests/equipos.test.js
// 15 casos de prueba — Módulo Equipos (ciclo de estados TE_01..TE_05)

process.env.JWT_SECRET     = 'clave_test_rulltec';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV       = 'test';

const request = require('supertest');
const { createTestDb, closeDb } = require('../src/db');

let app;
let token;
let clienteId;

beforeAll(async () => {
  await createTestDb();
  app = require('../server');

  await request(app).post('/api/auth/register').send({
    nombre: 'Admin Test', email: 'admin@equipos.cl', password: 'password123', rol: 'admin'
  });
  const resLogin = await request(app).post('/api/auth/login').send({
    email: 'admin@equipos.cl', password: 'password123'
  });
  token = resLogin.body.token;

  // Crear cliente base para los tests de equipos
  const resCliente = await request(app)
    .post('/api/clientes')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Pedro', apellido: 'Soto', rut: '11.111.111-1' });
  clienteId = resCliente.body.id;
});

afterAll(() => closeDb());

// ════════════════════════════════════════════════════════════════════════════
// Acceso protegido
// ════════════════════════════════════════════════════════════════════════════

describe('Equipos — Acceso protegido', () => {
  test('TC-E01 | GET /api/equipos sin token → 401', async () => {
    const res = await request(app).get('/api/equipos');
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Creación de equipos
// ════════════════════════════════════════════════════════════════════════════

describe('Equipos — Creación', () => {
  test('TC-E02 | POST con datos válidos → 201 + id', async () => {
    const res = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: clienteId, tipo: 'notebook', marca: 'HP', requerimiento: 'Pantalla rota' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  test('TC-E03 | POST con cliente_id inexistente → 404', async () => {
    const res = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: 9999, tipo: 'notebook', requerimiento: 'No enciende' });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Cliente no encontrado');
  });

  test('TC-E04 | POST con tipo inválido → 400', async () => {
    const res = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: clienteId, tipo: 'tablet', requerimiento: 'Pantalla rota' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('notebook o escritorio');
  });

  test('TC-E05 | POST sin requerimiento → 400', async () => {
    const res = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: clienteId, tipo: 'notebook' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('requerimiento');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Consulta de equipos
// ════════════════════════════════════════════════════════════════════════════

describe('Equipos — Consulta', () => {
  let equipoId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: clienteId, tipo: 'escritorio', requerimiento: 'No carga Windows' });
    equipoId = res.body.id;
  });

  test('TC-E06 | GET /api/equipos → 200 + incluye cliente_nombre', async () => {
    const res = await request(app)
      .get('/api/equipos')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].cliente_nombre).toBeDefined();
    expect(res.body[0].cliente_rut).toBeDefined();
  });

  test('TC-E07 | GET /api/equipos?estado=ingresado → filtra por estado', async () => {
    const res = await request(app)
      .get('/api/equipos?estado=ingresado')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.every(e => e.estado === 'ingresado')).toBe(true);
  });

  test('TC-E08 | GET /api/equipos/:id existente → 200 + datos completos', async () => {
    const res = await request(app)
      .get(`/api/equipos/${equipoId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.tipo).toBe('escritorio');
    expect(res.body.cliente_nombre).toBe('Pedro Soto');
  });

  test('TC-E09 | GET /api/equipos/:id inexistente → 404', async () => {
    const res = await request(app)
      .get('/api/equipos/9999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Ciclo de estados (TE_01..TE_05)
// ════════════════════════════════════════════════════════════════════════════

describe('Equipos — Ciclo de estados', () => {
  let equipoA; // para avanzar paso a paso
  let equipoB; // para probar transición inválida

  beforeAll(async () => {
    const resA = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: clienteId, tipo: 'notebook', requerimiento: 'Teclado no funciona' });
    equipoA = resA.body.id;

    const resB = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: clienteId, tipo: 'notebook', requerimiento: 'Se apaga solo' });
    equipoB = resB.body.id;
  });

  test('TC-E10 | PATCH ingresado → en_revision → 200', async () => {
    const res = await request(app)
      .patch(`/api/equipos/${equipoA}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'en_revision' });

    expect(res.status).toBe(200);
    expect(res.body.estado_anterior).toBe('ingresado');
    expect(res.body.estado_nuevo).toBe('en_revision');
  });

  test('TC-E11 | PATCH transición inválida ingresado → listo → 409 + transiciones_validas', async () => {
    const res = await request(app)
      .patch(`/api/equipos/${equipoB}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'listo' });

    expect(res.status).toBe(409);
    expect(res.body.transiciones_validas).toEqual(['en_revision']);
  });

  test('TC-E12 | PATCH avanza en_revision → en_reparacion → listo → 200', async () => {
    await request(app)
      .patch(`/api/equipos/${equipoA}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'en_reparacion' });

    const res = await request(app)
      .patch(`/api/equipos/${equipoA}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'listo' });

    expect(res.status).toBe(200);
    expect(res.body.estado_nuevo).toBe('listo');
  });

  test('TC-E13 | DELETE equipo en estado listo → 409', async () => {
    const res = await request(app)
      .delete(`/api/equipos/${equipoA}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('listo');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Actualización y eliminación
// ════════════════════════════════════════════════════════════════════════════

describe('Equipos — Actualización y eliminación', () => {
  let equipoEdit;
  let equipoDelete;

  beforeAll(async () => {
    const resEdit = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: clienteId, tipo: 'notebook', requerimiento: 'Batería dañada' });
    equipoEdit = resEdit.body.id;

    const resDel = await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: clienteId, tipo: 'escritorio', requerimiento: 'No hay imagen' });
    equipoDelete = resDel.body.id;
  });

  test('TC-E14 | PUT equipo en estado ingresado → 200', async () => {
    const res = await request(app)
      .put(`/api/equipos/${equipoEdit}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: clienteId, tipo: 'escritorio', marca: 'Dell', requerimiento: 'Batería dañada y ventilador roto' });

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBeDefined();
  });

  test('TC-E15 | DELETE equipo en estado ingresado → 200', async () => {
    const res = await request(app)
      .delete(`/api/equipos/${equipoDelete}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBeDefined();

    const verificar = await request(app)
      .get(`/api/equipos/${equipoDelete}`)
      .set('Authorization', `Bearer ${token}`);
    expect(verificar.status).toBe(404);
  });
});
