// tests/helpers.js
// Helper compartido para suites que necesitan un token con rol 'admin'.
// Desde que el registro público fuerza rol='cajero', el único camino para
// obtener un admin de prueba es: crear un superadmin directo en BD y usarlo
// para ascender a un usuario recién registrado.

const request = require('supertest');
const bcrypt  = require('bcryptjs');
const { dbRun } = require('../src/db');

async function crearAdminYObtenerToken(app, { nombre, email, password }) {
  const superEmail = `super_${Date.now()}_${Math.random().toString(36).slice(2)}@rulltec.cl`;
  const superPassword = 'superpass123';
  const hash = await bcrypt.hash(superPassword, 10);
  dbRun(
    'INSERT INTO usuarios (nombre, email, hash, rol) VALUES (?, ?, ?, ?)',
    ['Super Test', superEmail, hash, 'superadmin']
  );
  const loginSuper = await request(app)
    .post('/api/auth/login')
    .send({ email: superEmail, password: superPassword });
  const tokenSuper = loginSuper.body.token;

  await request(app).post('/api/auth/register').send({ nombre, email, password });
  const loginUsuario = await request(app).post('/api/auth/login').send({ email, password });
  const perfil = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${loginUsuario.body.token}`);

  await request(app)
    .patch(`/api/auth/usuarios/${perfil.body.id}/rol`)
    .set('Authorization', `Bearer ${tokenSuper}`)
    .send({ rol: 'admin' });

  const loginFinal = await request(app).post('/api/auth/login').send({ email, password });
  return loginFinal.body.token;
}

// Crea un superadmin directo en BD y devuelve su token — usado en suites
// que necesitan probar el borrado forzado (?forzar=true), exclusivo del rol superadmin.
async function crearSuperAdminYObtenerToken(app) {
  const email    = `super_${Date.now()}_${Math.random().toString(36).slice(2)}@rulltec.cl`;
  const password = 'superpass123';
  const hash = await bcrypt.hash(password, 10);
  dbRun(
    'INSERT INTO usuarios (nombre, email, hash, rol) VALUES (?, ?, ?, ?)',
    ['Super Test', email, hash, 'superadmin']
  );
  const login = await request(app).post('/api/auth/login').send({ email, password });
  return login.body.token;
}

module.exports = { crearAdminYObtenerToken, crearSuperAdminYObtenerToken };
