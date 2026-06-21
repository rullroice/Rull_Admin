// js/clientes.js — CRUD de clientes

requireAuth();
cargarUsuarioUI();
cargarClientes();

const PREFIJOS_TEL = ['+591', '+56', '+54', '+51'];
let clientesCache = [];

function formatRUT(val) {
  const cleaned = val.replace(/[^0-9kK]/g, '');
  if (cleaned.length <= 1) return cleaned.toUpperCase();
  const body = cleaned.slice(0, -1);
  const dv   = cleaned.slice(-1).toUpperCase();
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
}

function autoFormatRUT(input) {
  input.value = formatRUT(input.value);
}

async function cargarClientes() {
  const q     = document.getElementById('busqueda').value.trim();
  const url   = '/api/clientes' + (q ? `?q=${encodeURIComponent(q)}` : '');
  const tbody = document.getElementById('tablaBody');
  try {
    const data = await apiFetch(url);
    if (!data) return;
    clientesCache = data;
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>No hay clientes registrados.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = data.map(c => `
      <tr>
        <td>${c.id}</td>
        <td>${esc(c.nombre)} ${esc(c.apellido)}</td>
        <td>${esc(c.rut)}</td>
        <td>${esc(c.telefono) || '—'}</td>
        <td>${c.creado_en.slice(0,10)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="editarCliente(${c.id})">Editar</button>
          <button class="btn btn-sm btn-danger"  onclick="eliminarCliente(${c.id})">Eliminar</button>
        </td>
      </tr>`).join('');
  } catch (err) { mostrarAlerta('alerta', err.message); }
}

function abrirModal(cliente = null) {
  document.getElementById('modal').classList.add('open');
  document.getElementById('formCliente').reset();
  document.getElementById('alertaModal').style.display = 'none';
  if (cliente) {
    document.getElementById('modalTitulo').textContent = 'Editar cliente';
    document.getElementById('clienteId').value = cliente.id;
    document.getElementById('nombre').value    = cliente.nombre;
    document.getElementById('apellido').value  = cliente.apellido;
    document.getElementById('rut').value       = cliente.rut;

    const tel = cliente.telefono || '';
    let prefijo = '+56', numero = tel;
    for (const p of PREFIJOS_TEL) {
      if (tel.startsWith(p)) { prefijo = p; numero = tel.slice(p.length); break; }
    }
    document.getElementById('telefonoPrefijo').value = prefijo;
    document.getElementById('telefonoNumero').value  = numero;
  } else {
    document.getElementById('modalTitulo').textContent = 'Nuevo cliente';
    document.getElementById('clienteId').value = '';
  }
}

function cerrarModal() {
  document.getElementById('modal').classList.remove('open');
}

async function editarCliente(id) {
  try {
    const c = await apiFetch(`/api/clientes/${id}`);
    if (c) abrirModal(c);
  } catch (err) { mostrarAlerta('alerta', err.message); }
}

async function guardarCliente(e) {
  e.preventDefault();
  const id  = document.getElementById('clienteId').value;
  const btn = document.getElementById('btnGuardar');
  btn.disabled = true;

  const prefijo = document.getElementById('telefonoPrefijo').value;
  const numero  = document.getElementById('telefonoNumero').value.trim();

  const body = {
    nombre:   document.getElementById('nombre').value,
    apellido: document.getElementById('apellido').value,
    rut:      document.getElementById('rut').value,
    telefono: numero ? `${prefijo}${numero}` : null
  };
  try {
    if (id) {
      await apiFetch(`/api/clientes/${id}`, { method: 'PUT', body });
      mostrarAlerta('alerta', 'Cliente actualizado correctamente', 'success');
    } else {
      await apiFetch('/api/clientes', { method: 'POST', body });
      mostrarAlerta('alerta', 'Cliente registrado correctamente', 'success');
    }
    cerrarModal();
    cargarClientes();
  } catch (err) {
    mostrarAlerta('alertaModal', err.message);
  } finally {
    btn.disabled = false;
  }
}

async function eliminarCliente(id) {
  const cliente = clientesCache.find(c => c.id === id);
  const nombre  = cliente ? `${cliente.nombre} ${cliente.apellido}` : `#${id}`;
  if (!confirm(`¿Eliminar al cliente "${nombre}"?`)) return;
  try {
    await apiFetch(`/api/clientes/${id}`, { method: 'DELETE' });
    mostrarAlerta('alerta', 'Cliente eliminado', 'success');
    cargarClientes();
  } catch (err) {
    // Solo el superadmin puede forzar el borrado de un cliente con equipos asociados.
    const usuario = getUsuario();
    if (usuario?.rol === 'superadmin' && confirm(
      `${err.message}\n\n¿Forzar la eliminación de "${nombre}"? Esto también eliminará sus equipos y boletas asociadas.`
    )) {
      try {
        await apiFetch(`/api/clientes/${id}?forzar=true`, { method: 'DELETE' });
        mostrarAlerta('alerta', 'Cliente eliminado (forzado)', 'success');
        cargarClientes();
      } catch (err2) { mostrarAlerta('alerta', err2.message); }
      return;
    }
    mostrarAlerta('alerta', err.message);
  }
}
