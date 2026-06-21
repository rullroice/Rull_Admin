// server.js — Punto de entrada de RullTec Backend

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const authRoutes      = require('./src/routes/authRoutes');
const clientesRoutes  = require('./src/routes/clientesRoutes');
const equiposRoutes   = require('./src/routes/equiposRoutes');
const serviciosRoutes = require('./src/routes/serviciosRoutes');
const cajaRoutes      = require('./src/routes/cajaRoutes');
const boletasRoutes   = require('./src/routes/boletasRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Motor de vistas EJS ─────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'frontend', 'views'));

// ── Middlewares globales ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Archivos estáticos ──────────────────────────────────────────────────────
app.use('/css', express.static(path.join(__dirname, '..', 'frontend', 'css')));
app.use('/js',  express.static(path.join(__dirname, '..', 'frontend', 'js')));
app.use('/img', express.static(path.join(__dirname, '..', 'frontend', 'img')));

// ── Rutas de páginas (vistas EJS) ───────────────────────────────────────────
app.get('/',          (_req, res) => res.redirect('/login'));
app.get('/login',     (_req, res) => res.render('login',     { title: 'Iniciar Sesión' }));
app.get('/dashboard', (_req, res) => res.render('dashboard', { title: 'Dashboard',  page: 'dashboard' }));
app.get('/clientes',  (_req, res) => res.render('clientes',  { title: 'Clientes',   page: 'clientes'  }));
app.get('/equipos',   (_req, res) => res.render('equipos',   { title: 'Equipos',    page: 'equipos'   }));
app.get('/servicios', (_req, res) => res.render('servicios', { title: 'Servicios',  page: 'servicios' }));
app.get('/caja',      (_req, res) => res.render('caja',      { title: 'Caja',       page: 'caja'      }));
app.get('/boletas',   (_req, res) => res.render('boletas',   { title: 'Boletas',    page: 'boletas'   }));
app.get('/usuarios',  (_req, res) => res.render('usuarios',  { title: 'Usuarios',   page: 'usuarios'  }));

// ── Rutas API ───────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/clientes',  clientesRoutes);
app.use('/api/equipos',   equiposRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/api/caja',      cajaRoutes);
app.use('/api/boletas',   boletasRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ estado: 'ok', version: '1.0.0', sistema: 'RullTec' });
});

// ── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── Error global ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Iniciar servidor ────────────────────────────────────────────────────────
// Antes de escuchar, se asegura que existan los usuarios superadmin/admin
// iniciales (idempotente — no duplica si ya existen).
if (require.main === module) {
  const { seed } = require('./seed');
  seed()
    .catch(err => console.error('❌ Error al crear usuarios iniciales:', err.message))
    .finally(() => {
      app.listen(PORT, () => {
        console.log(`✅ RullTec corriendo en http://localhost:${PORT}`);
        console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
      });
    });
}

module.exports = app;
