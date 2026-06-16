// seed.js — Crea el usuario administrador inicial
// Uso: node backend/seed.js

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const bcrypt = require('bcryptjs');
const { getDb, dbGet, dbRun, closeDb } = require('./src/db');

async function seed() {
  await getDb();

  const email = 'admin@rulltec.cl';
  const existe = dbGet('SELECT id FROM usuarios WHERE email = ?', [email]);

  if (existe) {
    console.log('⚠️  El usuario admin ya existe — no se creó duplicado.');
    closeDb();
    return;
  }

  const hash = await bcrypt.hash('admin1234', 10);
  const { lastInsertRowid } = dbRun(
    'INSERT INTO usuarios (nombre, email, hash, rol) VALUES (?, ?, ?, ?)',
    ['Administrador', email, hash, 'admin']
  );

  console.log(`✅ Usuario admin creado (id=${lastInsertRowid})`);
  console.log(`   Email:      ${email}`);
  console.log(`   Contraseña: admin1234`);
  console.log(`   Rol:        admin`);
  closeDb();
}

seed().catch(err => {
  console.error('❌ Error en seed:', err.message);
  process.exit(1);
});
