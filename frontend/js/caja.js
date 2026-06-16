// js/caja.js — Flujo de cobro: seleccionar equipo listo → emitir boleta

requireAuth();
cargarUsuarioUI();
cargarEquiposListos();
cargarServicios();

let serviciosCatalogo = [];

async function cargarEquiposListos() {
  const tbody = document.getElementById('equiposListos');
  try {
    const data = await apiFetch('/api/caja');
    if (!data) return;
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><p>No hay equipos listos para cobro en este momento.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = data.map(e => `
      <tr>
        <td>${e.id}</td>
        <td>${e.cliente_nombre}<br><small style="color:var(--text-soft)">${e.cliente_rut}</small></td>
        <td>${e.tipo}${e.marca ? ' ' + e.marca : ''}</td>
        <td style="max-width:200px;white-space:normal">${e.requerimiento}</td>
        <td><button class="btn btn-sm btn-success" onclick="seleccionarEquipo(${e.id}, '${e.tipo} ${e.marca || ''}', '${e.cliente_nombre}')">Cobrar</button></td>
      </tr>`).join('');
  } catch (err) { mostrarAlerta('alerta', err.message); }
}

async function cargarServicios() {
  try {
    serviciosCatalogo = await apiFetch('/api/servicios') || [];
    const sel = document.getElementById('servicioSel');
    sel.innerHTML = '<option value="">Seleccionar servicio…</option>' +
      serviciosCatalogo.map(s => `<option value="${s.id}" data-costo="${s.costo}">${s.nombre} — ${formatMonto(s.costo)}</option>`).join('');
  } catch {}
}

function seleccionarEquipo(id, tipo, cliente) {
  document.getElementById('equipoSelId').value        = id;
  document.getElementById('formTitulo').textContent   = `Cobro — ${tipo.trim()} de ${cliente}`;
  document.getElementById('formCard').style.display   = 'block';
  document.getElementById('formCobro').reset();

  const antiEl = document.getElementById('anticipo');
  antiEl.value = '0'; antiEl.dataset.raw = '0';
  const desEl = document.getElementById('descuento');
  desEl.value = '0'; desEl.dataset.raw = '0';
  document.getElementById('montoPagado').dataset.raw = '';

  document.getElementById('resumenBox').style.display = 'none';
  document.getElementById('formCard').scrollIntoView({ behavior: 'smooth' });
}

function cancelarCobro() {
  document.getElementById('formCard').style.display = 'none';
}

function calcularResumen() {
  const sel = document.getElementById('servicioSel');
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.dataset.costo) {
    document.getElementById('resumenBox').style.display = 'none';
    return;
  }

  const precio      = parseFloat(opt.dataset.costo);
  const descuento   = rawCLP('descuento');
  const anticipo    = rawCLP('anticipo');
  const montoPagado = rawCLP('montoPagado');
  const total       = precio - descuento;
  const saldo       = total - anticipo;
  const vuelto      = Math.max(0, montoPagado - saldo);

  document.getElementById('rPrecio').textContent    = formatMonto(precio);
  document.getElementById('rDescuento').textContent = formatMonto(descuento);
  document.getElementById('rTotal').textContent     = formatMonto(total);
  document.getElementById('rAnticipo').textContent  = formatMonto(anticipo);
  document.getElementById('rSaldo').textContent     = formatMonto(saldo);
  document.getElementById('rVuelto').textContent    = formatMonto(vuelto);
  document.getElementById('resumenBox').style.display = 'block';
}

async function emitirBoleta(e) {
  e.preventDefault();
  const btn = document.getElementById('btnEmitir');
  btn.disabled = true;
  const body = {
    equipo_id:    parseInt(document.getElementById('equipoSelId').value),
    servicio_id:  parseInt(document.getElementById('servicioSel').value),
    anticipo:     rawCLP('anticipo'),
    descuento:    rawCLP('descuento'),
    monto_pagado: rawCLP('montoPagado')
  };
  try {
    const res = await apiFetch('/api/boletas', { method: 'POST', body });
    mostrarAlerta('alerta', `Boleta #${res.id} emitida. Vuelto: ${formatMonto(res.resumen.vuelto)}`, 'success');
    document.getElementById('formCard').style.display = 'none';
    cargarEquiposListos();
  } catch (err) {
    mostrarAlerta('alertaForm', err.message);
  } finally { btn.disabled = false; }
}
