// js/boletas.js — Historial de boletas emitidas

requireAuth();
cargarUsuarioUI();
cargarBoletas();

let boletaActual = null;

async function cargarBoletas() {
  const tbody = document.getElementById('tablaBody');
  try {
    const data = await apiFetch('/api/boletas');
    if (!data) return;
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><p>No hay boletas emitidas.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = data.map(b => `
      <tr style="cursor:pointer" onclick="verDetalle(${b.id})">
        <td><strong>#${b.id}</strong></td>
        <td>${b.cliente_nombre}<br><small style="color:var(--text-soft)">${b.cliente_rut}</small></td>
        <td>${b.servicio_nombre}</td>
        <td>${formatMonto(b.precio)}</td>
        <td>${formatMonto(b.descuento)}</td>
        <td><strong>${formatMonto(b.total)}</strong></td>
        <td>${formatMonto(b.anticipo)}</td>
        <td>${formatMonto(b.vuelto)}</td>
        <td>${b.emitida_en.slice(0,16).replace('T',' ')}</td>
      </tr>`).join('');
  } catch (err) { mostrarAlerta('alerta', err.message); }
}

async function verDetalle(id) {
  try {
    const b = await apiFetch(`/api/boletas/${id}`);
    if (!b) return;
    boletaActual = b;
    document.getElementById('boletaNum').textContent = `#${b.id}`;
    document.getElementById('boletaDetalle').innerHTML = `
      <p><strong>Cliente:</strong> ${b.cliente_nombre} (${b.cliente_rut})</p>
      <p><strong>Servicio:</strong> ${b.servicio_nombre}</p>
      <hr style="margin:0.75rem 0;border-color:var(--border)">
      <p><strong>Precio:</strong> ${formatMonto(b.precio)}</p>
      <p><strong>Descuento:</strong> ${formatMonto(b.descuento)}</p>
      <p><strong>Total:</strong> ${formatMonto(b.total)}</p>
      <p><strong>Anticipo:</strong> ${formatMonto(b.anticipo)}</p>
      <p><strong>Vuelto entregado:</strong> ${formatMonto(b.vuelto)}</p>
      <hr style="margin:0.75rem 0;border-color:var(--border)">
      <p><strong>Emitida:</strong> ${b.emitida_en.slice(0,16).replace('T',' ')}</p>
    `;
    document.getElementById('modal').classList.add('open');
  } catch (err) { mostrarAlerta('alerta', err.message); }
}

function cerrarModal() {
  document.getElementById('modal').classList.remove('open');
  boletaActual = null;
}

function descargarPDF() {
  if (!boletaActual) return;
  const b = boletaActual;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 52, 96);
  doc.text('RullTec', 20, 22);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Sistema de Gestión de Mantenimiento', 20, 30);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 52, 96);
  doc.text(`Boleta #${b.id}`, 190, 22, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text(b.emitida_en.slice(0,16).replace('T',' '), 190, 30, { align: 'right' });

  doc.setDrawColor(229, 231, 235);
  doc.line(20, 36, 190, 36);

  // Cliente / Servicio
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128);
  doc.text('CLIENTE', 20, 46);
  doc.text('SERVICIO', 110, 46);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(26, 26, 46);
  doc.text(b.cliente_nombre, 20, 54);
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`RUT: ${b.cliente_rut}`, 20, 61);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(26, 26, 46);
  doc.text(b.servicio_nombre, 110, 54);

  doc.setDrawColor(229, 231, 235);
  doc.line(20, 68, 190, 68);

  // Table header
  doc.setFillColor(248, 250, 252);
  doc.rect(20, 72, 170, 9, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128);
  doc.text('Concepto', 25, 79);
  doc.text('Monto', 185, 79, { align: 'right' });

  const filas = [
    ['Precio del servicio', formatMonto(b.precio)],
    ['Descuento',           formatMonto(b.descuento)],
    ['Total a pagar',       formatMonto(b.total)],
    ['Anticipo previo',     formatMonto(b.anticipo)],
    ['Vuelto entregado',    formatMonto(b.vuelto)],
  ];

  let y = 92;
  doc.setFontSize(10);
  filas.forEach(([concepto, monto]) => {
    const isTotal = concepto === 'Total a pagar';
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    if (isTotal) { doc.setTextColor(5, 150, 105); } else { doc.setTextColor(26, 26, 46); }
    doc.text(concepto, 25, y);
    doc.text(monto, 185, y, { align: 'right' });
    y += 9;
  });

  doc.setDrawColor(229, 231, 235);
  doc.line(20, y + 3, 190, y + 3);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180);
  doc.text('Documento generado por RullTec', 105, y + 11, { align: 'center' });

  doc.save(`boleta-${b.id}.pdf`);
}
