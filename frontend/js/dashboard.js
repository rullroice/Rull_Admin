// js/dashboard.js — Panel de control: métricas diarias

requireAuth();
cargarUsuarioUI();

async function cargarDashboard() {
  const data = await apiFetch('/api/dashboard');
  if (!data) return;

  document.getElementById('fechaHoy').textContent        = 'Hoy: ' + data.fecha;
  document.getElementById('statAtenciones').textContent  = data.atenciones_hoy;
  document.getElementById('statRecaudacion').textContent = '$' + data.recaudacion_hoy.toLocaleString('es-CL');

  const e = data.equipos_por_estado;
  document.getElementById('eIngresado').textContent  = e.ingresado;
  document.getElementById('eRevision').textContent   = e.en_revision;
  document.getElementById('eReparacion').textContent = e.en_reparacion;
  document.getElementById('eListo').textContent      = e.listo;
  document.getElementById('eEntregado').textContent  = e.entregado;
}

cargarDashboard();
