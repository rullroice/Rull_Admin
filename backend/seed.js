// seed.js — Crea los usuarios iniciales (superadmin y admin) si no existen
// Uso manual: node backend/seed.js
// También se ejecuta automáticamente al iniciar el servidor (ver server.js)

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const bcrypt = require('bcryptjs');
const { getDb, dbGet, dbRun } = require('./src/db');

const USUARIOS_INICIALES = [
  { nombre: 'Super Administrador', email: 'superadmin@rulltec.cl', password: 'superadmin1234', rol: 'superadmin' },
  { nombre: 'Administrador',       email: 'admin@rulltec.cl',      password: 'admin1234',       rol: 'admin' }
];

// Crea cada usuario inicial si su email todavía no existe en la BD.
// Idempotente: se puede llamar en cada arranque del servidor sin duplicar.
async function seed() {
  await getDb();

  for (const u of USUARIOS_INICIALES) {
    const existe = dbGet('SELECT id FROM usuarios WHERE email = ?', [u.email]);
    if (existe) {
      console.log(`⚠️  Usuario ${u.rol} (${u.email}) ya existe — no se creó duplicado.`);
      continue;
    }

    const hash = await bcrypt.hash(u.password, 10);
    const { lastInsertRowid } = dbRun(
      'INSERT INTO usuarios (nombre, email, hash, rol) VALUES (?, ?, ?, ?)',
      [u.nombre, u.email, hash, u.rol]
    );

    console.log(`✅ Usuario ${u.rol} creado (id=${lastInsertRowid})`);
    console.log(`   Email:      ${u.email}`);
    console.log(`   Contraseña: ${u.password}`);
  }
}

if (require.main === module) {
  const { closeDb } = require('./src/db');
  seed()
    .then(() => closeDb())
    .catch(err => {
      console.error('❌ Error en seed:', err.message);
      process.exit(1);
    });
}

module.exports = { seed };
