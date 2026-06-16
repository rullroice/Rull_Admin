// tests/auth.test.js
// Suite completa de pruebas para el módulo de Autenticación
// Cubre: TC-01 a TC-12 del DRF de RullTec
// Herramientas: Jest + Supertest

const request = require('supertest');
const jwt     = require('jsonwebtoken');

// Antes de cargar la app, inyectamos variables de entorno para tests
process.env.JWT_SECRET     = 'clave_test_rulltec';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV       = 'test';

// Usamos BD en memoria para no tocar la BD de desarrollo
const { createTestDb, closeDb } = require('../src/db');
createTestDb();

const app = require('../server');

// ── Datos de prueba ──────────────────────────────────────────────────────────

const USUARIO_VALIDO = {
  nombre:   'Juan Pérez',
  email:    'juan@rulltec.cl',
  password: 'password123'
};

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  // Pre-registrar un usuario para las pruebas de login
  await request(app).post('/api/auth/register').send(USUARIO_VALIDO);
});

afterAll(() => {
  closeDb();
});

// ════════════════════════════════════════════════════════════════════════════
// RF-01: LOGIN
// ════════════════════════════════════════════════════════════════════════════

describe('RF-01 — Login', () => {

  test('TC-01 | Login con credenciales válidas → 200 + token JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USUARIO_VALIDO.email, password: USUARIO_VALIDO.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario.email).toBe(USUARIO_VALIDO.email);
    // Verificar que el token es un JWT válido
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.email).toBe(USUARIO_VALIDO.email);
  });

  test('TC-02 | Login con contraseña incorrecta → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USUARIO_VALIDO.email, password: 'clave_incorrecta' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciales inválidas');
  });

  test('TC-07 | Login con email inexistente → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@rulltec.cl', password: 'cualquier' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciales inválidas');
  });

});

// ════════════════════════════════════════════════════════════════════════════
// RF-02: REGISTRO
// ════════════════════════════════════════════════════════════════════════════

describe('RF-02 — Registro', () => {

  test('TC-11 | Registro exitoso con datos válidos → 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombre: 'Ana Soto', email: 'ana@rulltec.cl', password: 'segura123' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  test('TC-03 | Registro con email duplicado → 409', async () => {
    // El email de USUARIO_VALIDO ya fue registrado en beforeAll
    const res = await request(app)
      .post('/api/auth/register')
      .send(USUARIO_VALIDO);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('ya está registrado');
  });

  test('TC-05 | Registro con contraseña corta (6 chars) → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombre: 'Test', email: 'test2@rulltec.cl', password: 'abc123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('8 caracteres');
  });

  test('TC-08 | Registro con email inválido → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombre: 'Test', email: 'noesvalido', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('formato válido');
  });

});

// ════════════════════════════════════════════════════════════════════════════
// RF-03: PERFIL (GET /me) — CORREGIDO desde el bug original
// ════════════════════════════════════════════════════════════════════════════

describe('RF-03 — Perfil de usuario', () => {

  let tokenValido;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: USUARIO_VALIDO.email, password: USUARIO_VALIDO.password });
    tokenValido = res.body.token;
  });

  test('TC-12 | GET /me con token válido → 200 + datos del usuario', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenValido}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(USUARIO_VALIDO.email);
    expect(res.body.hash).toBeUndefined(); // No exponer el hash
  });

  test('TC-09 | Acceso sin token → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token no proporcionado');
  });

  // ── CORRECCIÓN BUG RF-03 ────────────────────────────────────────────────
  // Antes: ambos casos devolvían "No autorizado" genérico
  // Ahora: cada error tiene su mensaje y código específico

  test('TC-04 | Token expirado → 401 con mensaje específico (BUG CORREGIDO)', async () => {
    // Crear un token ya vencido (expiración en el pasado)
    const tokenVencido = jwt.sign(
      { id: 1, email: USUARIO_VALIDO.email, rol: 'cajero' },
      process.env.JWT_SECRET,
      { expiresIn: -1 } // Expirado inmediatamente
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenVencido}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');          // ← código específico
    expect(res.body.error).toContain('expirado');         // ← mensaje útil
    expect(res.body.error).not.toBe('No autorizado');     // ← ya no es el genérico
  });

  test('TC-10 | Token malformado → 401 con código TOKEN_INVALID (BUG CORREGIDO)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer esto.no.esuntoken');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
    expect(res.body.error).not.toBe('No autorizado');
  });

  test('TC-06 | Update perfil sin token → 401 (pendiente de implementar endpoint)', async () => {
    // El endpoint PUT /api/auth/me aún no está implementado
    // Verificamos que cualquier ruta protegida rechace sin token
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.status).toBe(401);
  });

});
