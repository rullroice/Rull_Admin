// js/login.js — Lógica de la página de inicio de sesión

const form  = document.getElementById('loginForm');
const error = document.getElementById('error');
const btn   = document.getElementById('btnLogin');

if (localStorage.getItem('token')) {
  window.location.href = '/dashboard';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.style.display = 'none';
  btn.textContent = 'Iniciando…';
  btn.disabled    = true;

  try {
    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        email:    document.getElementById('email').value,
        password: document.getElementById('password').value
      })
    });
    const data = await res.json();

    if (!res.ok) {
      error.textContent   = data.error || 'Error al iniciar sesión';
      error.style.display = 'block';
    } else {
      localStorage.setItem('token',   data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      window.location.href = '/dashboard';
    }
  } catch {
    error.textContent   = 'No se pudo conectar con el servidor';
    error.style.display = 'block';
  } finally {
    btn.textContent = 'Iniciar sesión';
    btn.disabled    = false;
  }
});
