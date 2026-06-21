// js/usuarios.js — Consola superadmin: gestión de usuarios y roles

requireAuth();
cargarUsuarioUI();

if (requireRole('superadmin')) {
  cargarUsuarios();
}

let usuariosCache = [];

async function cargarUsuarios() {
  const tbody = document.getElementById('tablaBody');
  try {
    const data = await apiFetch('/api/auth/usuarios');
    if (!data) return;
    usuariosCache = data;
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>No hay usuarios.</p></div></td></tr>';
      return;
    }
    const usuarioActual = getUsuario();
    tbody.innerHTML = data.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${esc(u.nombre)}</td>
        <td>${esc(u.email)}</td>
        <td>${badgeRol(u.rol)}</td>
        <td>${u.creado_en.slice(0,10)}</td>
        <td>${accionesUsuario(u, usuarioActual)}</td>
      </tr>`).join('');
  } catch (err) { mostrarAlerta('alerta', err.message); }
}

function accionesUsuario(u, usuarioActual) {
  if (u.rol === 'superadmin') {
    return '<span style="color:var(--text-lighter)">— protegido —</span>';
  }
  const botonRol = u.rol === 'admin'
    ? `<button class="btn btn-sm btn-outline" onclick="cambiarRol(${u.id}, 'cajero')">Quitar admin</button>`
    : `<button class="btn btn-sm btn-success" onclick="cambiarRol(${u.id}, 'admin')">Asignar admin</button>`;
  const esUsuarioActual = usuarioActual && usuarioActual.id === u.id;
  const botonEliminar = esUsuarioActual ? '' :
    `<button class="btn btn-sm btn-danger" onclick="eliminarUsuario(${u.id})">Eliminar</button>`;
  return `${botonRol} ${botonEliminar}`;
}

function abrirModal() {
  document.getElementById('modal').classList.add('open');
  document.getElementById('formUsuario').reset();
  document.getElementById('alertaModal').style.display = 'none';
}

function cerrarModal() {
  document.getElementById('modal').classList.remove('open');
}

async function guardarUsuario(e) {
  e.preventDefault();
  const btn = document.getElementById('btnGuardar');
  btn.disabled = true;
  const body = {
    nombre:   document.getElementById('nombre').value,
    email:    document.getElementById('email').value,
    password: document.getElementById('password').value
  };
  try {
    await apiFetch('/api/auth/register', { method: 'POST', body });
    mostrarAlerta('alerta', 'Usuario creado correctamente (rol: cajero)', 'success');
    cerrarModal();
    cargarUsuarios();
  } catch (err) {
    mostrarAlerta('alertaModal', err.message);
  } finally { btn.disabled = false; }
}

async function cambiarRol(id, rol) {
  const usuario = usuariosCache.find(u => u.id === id);
  const nombre  = usuario ? usuario.nombre : `#${id}`;
  const accion = rol === 'admin' ? 'asignar como administrador del taller' : 'quitar el rol de administrador a';
  if (!confirm(`¿Confirmas ${accion} "${nombre}"?`)) return;
  try {
    await apiFetch(`/api/auth/usuarios/${id}/rol`, { method: 'PATCH', body: { rol } });
    mostrarAlerta('alerta', 'Rol actualizado correctamente', 'success');
    cargarUsuarios();
  } catch (err) { mostrarAlerta('alerta', err.message); }
}

async function eliminarUsuario(id) {
  const usuario = usuariosCache.find(u => u.id === id);
  const nombre  = usuario ? usuario.nombre : `#${id}`;
  if (!confirm(`¿Eliminar la cuenta de "${nombre}"? Esta acción no se puede deshacer.`)) return;
  try {
    await apiFetch(`/api/auth/usuarios/${id}`, { method: 'DELETE' });
    mostrarAlerta('alerta', 'Usuario eliminado', 'success');
    cargarUsuarios();
  } catch (err) { mostrarAlerta('alerta', err.message); }
}
