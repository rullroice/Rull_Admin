// js/servicios.js — Catálogo de servicios (CRUD + soft delete)

requireAuth();
cargarUsuarioUI();
cargarServicios();

async function cargarServicios() {
  const tbody = document.getElementById('tablaBody');
  try {
    const data = await apiFetch('/api/servicios');
    if (!data) return;
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>No hay servicios en el catálogo.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = data.map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${s.nombre}</td>
        <td>${formatMonto(s.costo)}</td>
        <td>${s.creado_en.slice(0,10)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="editarServicio(${s.id})">Editar</button>
          <button class="btn btn-sm btn-danger"  onclick="desactivarServicio(${s.id}, '${s.nombre}')">Desactivar</button>
        </td>
      </tr>`).join('');
  } catch (err) { mostrarAlerta('alerta', err.message); }
}

function abrirModal(servicio = null) {
  document.getElementById('modal').classList.add('open');
  document.getElementById('formServicio').reset();
  document.getElementById('alertaModal').style.display = 'none';
  const costoEl = document.getElementById('costo');
  if (servicio) {
    document.getElementById('modalTitulo').textContent = 'Editar servicio';
    document.getElementById('servicioId').value = servicio.id;
    document.getElementById('nombre').value     = servicio.nombre;
    costoEl.dataset.raw = servicio.costo;
    costoEl.value       = Number(servicio.costo).toLocaleString('es-CL');
  } else {
    document.getElementById('modalTitulo').textContent = 'Nuevo servicio';
    document.getElementById('servicioId').value = '';
    costoEl.dataset.raw = '';
  }
}

function cerrarModal() {
  document.getElementById('modal').classList.remove('open');
}

async function editarServicio(id) {
  try {
    const s = await apiFetch(`/api/servicios/${id}`);
    if (s) abrirModal(s);
  } catch (err) { mostrarAlerta('alerta', err.message); }
}

async function guardarServicio(e) {
  e.preventDefault();
  const id  = document.getElementById('servicioId').value;
  const btn = document.getElementById('btnGuardar');
  btn.disabled = true;
  const body = {
    nombre: document.getElementById('nombre').value,
    costo:  rawCLP('costo')
  };
  try {
    if (id) {
      await apiFetch(`/api/servicios/${id}`, { method: 'PUT', body });
      mostrarAlerta('alerta', 'Servicio actualizado', 'success');
    } else {
      await apiFetch('/api/servicios', { method: 'POST', body });
      mostrarAlerta('alerta', 'Servicio creado', 'success');
    }
    cerrarModal();
    cargarServicios();
  } catch (err) {
    mostrarAlerta('alertaModal', err.message);
  } finally { btn.disabled = false; }
}

async function desactivarServicio(id, nombre) {
  if (!confirm(`¿Desactivar el servicio "${nombre}"?`)) return;
  try {
    await apiFetch(`/api/servicios/${id}`, { method: 'DELETE' });
    mostrarAlerta('alerta', 'Servicio desactivado', 'success');
    cargarServicios();
  } catch (err) { mostrarAlerta('alerta', err.message); }
}
