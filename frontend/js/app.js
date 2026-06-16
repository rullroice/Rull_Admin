// js/app.js — Utilidades compartidas entre todas las páginas de RullTec

function getToken() {
  return localStorage.getItem('token');
}

function getUsuario() {
  try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
}

function requireAuth() {
  if (!getToken()) window.location.href = '/login';
}

function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = '/login';
}

function cargarUsuarioUI() {
  const u = getUsuario();
  const n = document.getElementById('usuarioNombre');
  const r = document.getElementById('usuarioRol');
  if (u && n) n.textContent = u.nombre;
  if (u && r) r.textContent = u.rol;
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const res   = await fetch(url, {
    ...options,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (res.status === 401) {
    const data = await res.json().catch(() => ({}));
    if (data.code === 'TOKEN_EXPIRED' || data.code === 'TOKEN_INVALID') {
      cerrarSesion();
      return null;
    }
  }

  return res.ok
    ? res.json()
    : res.json().then(d => { throw new Error(d.error || 'Error del servidor'); });
}

function mostrarAlerta(id, msg, tipo = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent   = msg;
  el.className     = `alert alert-${tipo}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function badgeEstado(estado) {
  const labels = {
    ingresado:     'Ingresado',
    en_revision:   'En revisión',
    en_reparacion: 'En reparación',
    listo:         'Listo',
    entregado:     'Entregado'
  };
  return `<span class="badge badge-${estado}">${labels[estado] || estado}</span>`;
}

function formatMonto(n) {
  return '$' + Number(n).toLocaleString('es-CL');
}

function maskCLP(input) {
  const raw = input.value.replace(/\D/g, '');
  input.dataset.raw = raw;
  input.value = raw ? Number(raw).toLocaleString('es-CL') : '';
}

function rawCLP(id) {
  return parseFloat(document.getElementById(id).dataset.raw) || 0;
}
