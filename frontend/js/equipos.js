// js/equipos.js — Gestión de equipos y cambio de estado

requireAuth();
cargarUsuarioUI();
cargarEquipos();
cargarClientesSelect();

const ORDEN_ESTADOS = ['ingresado', 'en_revision', 'en_reparacion', 'listo', 'entregado'];
const LABEL_ESTADOS = {
  ingresado: 'Ingresado', en_revision: 'En revisión',
  en_reparacion: 'En reparación', listo: 'Listo', entregado: 'Entregado'
};

let equipoEstadoId     = null;
let equipoEstadoActual = null;
let equiposCache       = [];

async function cargarClientesSelect() {
  try {
    const clientes = await apiFetch('/api/clientes');
    if (!clientes) return;
    const sel = document.getElementById('clienteSelect');
    sel.innerHTML = '<option value="">Seleccionar cliente…</option>' +
      clientes.map(c => `<option value="${c.id}">${esc(c.nombre)} ${esc(c.apellido)} — ${esc(c.rut)}</option>`).join('');
  } catch {}
}

async function cargarEquipos() {
  const estado = document.getElementById('filtroEstado').value;
  const url    = '/api/equipos' + (estado ? `?estado=${estado}` : '');
  const tbody  = document.getElementById('tablaBody');
  try {
    const data = await apiFetch(url);
    if (!data) return;
    equiposCache = data;
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>No hay equipos.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = data.map(e => `
      <tr>
        <td>${e.id}</td>
        <td>${esc(e.cliente_nombre)}<br><small style="color:var(--text-soft)">${esc(e.cliente_rut)}</small></td>
        <td>${esc(e.tipo)}</td>
        <td>${esc(e.marca) || '—'}</td>
        <td style="max-width:200px;white-space:normal">${esc(e.requerimiento)}</td>
        <td>${badgeEstado(e.estado)}</td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="abrirModalEstado(${e.id})">Estado</button>
          ${e.estado !== 'entregado' ? `<button class="btn btn-sm btn-outline" onclick="editarEquipo(${e.id})">Editar</button>` : ''}
          <button class="btn btn-sm btn-danger" onclick="eliminarEquipo(${e.id})">Eliminar</button>
        </td>
      </tr>`).join('');
  } catch (err) { mostrarAlerta('alerta', err.message); }
}

function abrirModalEquipo(equipo = null) {
  document.getElementById('modalEquipo').classList.add('open');
  document.getElementById('formEquipo').reset();
  document.getElementById('alertaModal').style.display = 'none';
  if (equipo) {
    document.getElementById('modalTitulo').textContent = 'Editar equipo';
    document.getElementById('equipoId').value          = equipo.id;
    document.getElementById('clienteSelect').value     = equipo.cliente_id;
    document.getElementById('tipo').value              = equipo.tipo;
    document.getElementById('marca').value             = equipo.marca || '';
    document.getElementById('requerimiento').value     = equipo.requerimiento;
  } else {
    document.getElementById('modalTitulo').textContent = 'Nuevo equipo';
    document.getElementById('equipoId').value = '';
  }
}

function cerrarModalEquipo() {
  document.getElementById('modalEquipo').classList.remove('open');
}

async function editarEquipo(id) {
  try {
    const e = await apiFetch(`/api/equipos/${id}`);
    if (e) abrirModalEquipo(e);
  } catch (err) { mostrarAlerta('alerta', err.message); }
}

async function guardarEquipo(e) {
  e.preventDefault();
  const id  = document.getElementById('equipoId').value;
  const btn = document.getElementById('btnGuardar');
  btn.disabled = true;
  const body = {
    cliente_id:    parseInt(document.getElementById('clienteSelect').value),
    tipo:          document.getElementById('tipo').value,
    marca:         document.getElementById('marca').value || null,
    requerimiento: document.getElementById('requerimiento').value
  };
  try {
    if (id) {
      await apiFetch(`/api/equipos/${id}`, { method: 'PUT', body });
      mostrarAlerta('alerta', 'Equipo actualizado', 'success');
    } else {
      await apiFetch('/api/equipos', { method: 'POST', body });
      mostrarAlerta('alerta', 'Equipo registrado', 'success');
    }
    cerrarModalEquipo();
    cargarEquipos();
  } catch (err) {
    mostrarAlerta('alertaModal', err.message);
  } finally { btn.disabled = false; }
}

function abrirModalEstado(id) {
  const equipo = equiposCache.find(e => e.id === id);
  if (!equipo) return;
  equipoEstadoId     = id;
  equipoEstadoActual = equipo.estado;
  document.getElementById('modalEstado').classList.add('open');
  document.getElementById('alertaEstado').style.display = 'none';
  document.getElementById('equipoInfo').textContent =
    `Equipo #${id} — ${equipo.tipo} | Estado actual: ${LABEL_ESTADOS[equipo.estado] || equipo.estado}`;
  document.getElementById('nuevoEstado').value = equipo.estado;
}

function cerrarModalEstado() {
  document.getElementById('modalEstado').classList.remove('open');
  equipoEstadoId     = null;
  equipoEstadoActual = null;
}

async function cambiarEstado() {
  const estado    = document.getElementById('nuevoEstado').value;
  const idxActual = ORDEN_ESTADOS.indexOf(equipoEstadoActual);
  const idxNuevo  = ORDEN_ESTADOS.indexOf(estado);

  if (idxNuevo < idxActual) {
    const de  = LABEL_ESTADOS[equipoEstadoActual] || equipoEstadoActual;
    const a   = LABEL_ESTADOS[estado] || estado;
    if (!confirm(`¿Revertir de "${de}" a "${a}"? Esta acción retrocede el flujo de trabajo.`)) return;
  }

  try {
    await apiFetch(`/api/equipos/${equipoEstadoId}/estado`, { method: 'PATCH', body: { estado } });
    mostrarAlerta('alerta', 'Estado actualizado correctamente', 'success');
    cerrarModalEstado();
    cargarEquipos();
  } catch (err) { mostrarAlerta('alertaEstado', err.message); }
}

async function eliminarEquipo(id) {
  const equipo = equiposCache.find(e => e.id === id);
  const tipo   = equipo ? equipo.tipo : '';
  if (!confirm(`¿Eliminar el equipo "${tipo}" #${id}?`)) return;
  try {
    await apiFetch(`/api/equipos/${id}`, { method: 'DELETE' });
    mostrarAlerta('alerta', 'Equipo eliminado', 'success');
    cargarEquipos();
  } catch (err) {
    // Solo el superadmin puede forzar el borrado de un equipo bloqueado
    // (estado listo/entregado o con boletas asociadas).
    const usuario = getUsuario();
    if (usuario?.rol === 'superadmin' && confirm(
      `${err.message}\n\n¿Forzar la eliminación del equipo #${id}? Esto también eliminará sus boletas asociadas.`
    )) {
      try {
        await apiFetch(`/api/equipos/${id}?forzar=true`, { method: 'DELETE' });
        mostrarAlerta('alerta', 'Equipo eliminado (forzado)', 'success');
        cargarEquipos();
      } catch (err2) { mostrarAlerta('alerta', err2.message); }
      return;
    }
    mostrarAlerta('alerta', err.message);
  }
}
