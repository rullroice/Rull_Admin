// tests/clientes.test.js
// 13 casos de prueba — Módulo Clientes (RF Clientes)

process.env.JWT_SECRET     = 'clave_test_rulltec';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV       = 'test';

const request = require('supertest');
const { createTestDb, closeDb } = require('../src/db');

let app;
let token;

// RUTs chilenos válidos calculados con módulo 11:
// 11.111.111-1  → suma=32, 32%11=10, 11-10=1 ✓
// 1.234.567-4   → suma=106, 106%11=7, 11-7=4 ✓
// 9.999.999-3   → suma=261, 261%11=8, 11-8=3 ✓
// 7.654.321-6   → suma=126, 126%11=5, 11-5=6 ✓

beforeAll(async () => {
  await createTestDb();
  app = require('../server');

  await request(app).post('/api/auth/register').send({
    nombre: 'Admin Test', email: 'admin@test.cl', password: 'password123', rol: 'admin'
  });
  const res = await request(app).post('/api/auth/login').send({
    email: 'admin@test.cl', password: 'password123'
  });
  token = res.body.token;
});

afterAll(() => closeDb());

// ════════════════════════════════════════════════════════════════════════════
// Acceso protegido
// ════════════════════════════════════════════════════════════════════════════

describe('Clientes — Acceso protegido', () => {
  test('TC-C01 | GET /api/clientes sin token → 401', async () => {
    const res = await request(app).get('/api/clientes');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CRUD clientes
// ════════════════════════════════════════════════════════════════════════════

describe('Clientes — CRUD', () => {
  let clienteId;

  test('TC-C02 | POST con datos válidos → 201 + id', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Carlos', apellido: 'González', rut: '11.111.111-1', telefono: '+56911111111' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    clienteId = res.body.id;
  });

  test('TC-C03 | POST con RUT duplicado → 409', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Otro', apellido: 'Cliente', rut: '11.111.111-1' });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('RUT');
  });

  test('TC-C04 | POST con RUT inválido (DV incorrecto) → 400', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Test', apellido: 'User', rut: '11.111.111-2' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('válido');
  });

  test('TC-C05 | POST sin nombre → 400', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({ apellido: 'González', rut: '9.999.999-3' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('nombre');
  });

  test('TC-C06 | GET /api/clientes → 200 + array con al menos un elemento', async () => {
    const res = await request(app)
      .get('/api/clientes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('TC-C07 | GET /api/clientes?q=Carlos → filtra por nombre', async () => {
    const res = await request(app)
      .get('/api/clientes?q=Carlos')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.some(c => c.nombre === 'Carlos')).toBe(true);
  });

  test('TC-C08 | GET /api/clientes/:id existente → 200 + datos', async () => {
    const res = await request(app)
      .get(`/api/clientes/${clienteId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Carlos');
    expect(res.body.rut).toBe('11.111.111-1');
  });

  test('TC-C09 | GET /api/clientes/:id inexistente → 404', async () => {
    const res = await request(app)
      .get('/api/clientes/9999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('no encontrado');
  });

  test('TC-C10 | PUT /api/clientes/:id → 200 + actualiza datos', async () => {
    const res = await request(app)
      .put(`/api/clientes/${clienteId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Carlos', apellido: 'Pérez', rut: '11.111.111-1', telefono: '+56922222222' });

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBeDefined();

    // Verificar que el cambio se guardó
    const verificar = await request(app)
      .get(`/api/clientes/${clienteId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(verificar.body.apellido).toBe('Pérez');
  });

  test('TC-C11 | PUT /api/clientes/:id inexistente → 404', async () => {
    const res = await request(app)
      .put('/api/clientes/9999')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Test', apellido: 'User', rut: '9.999.999-3' });

    expect(res.status).toBe(404);
  });

  test('TC-C12 | DELETE cliente sin equipos → 200', async () => {
    const crear = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Temporal', apellido: 'Borrar', rut: '1.234.567-4' });

    const res = await request(app)
      .delete(`/api/clientes/${crear.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toBeDefined();
  });

  test('TC-C13 | DELETE cliente con equipos → 409', async () => {
    // Crear cliente con equipo asociado
    const crearCliente = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Con', apellido: 'Equipo', rut: '7.654.321-6' });

    await request(app)
      .post('/api/equipos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cliente_id:    crearCliente.body.id,
        tipo:          'notebook',
        requerimiento: 'No enciende el equipo'
      });

    const res = await request(app)
      .delete(`/api/clientes/${crearCliente.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('equipos');
  });
});
