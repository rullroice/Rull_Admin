# RullTec — Sistema de Gestión de Taller de Reparación

> Sistema web para talleres de reparación de equipos computacionales. Gestión de clientes, equipos, servicios, caja y boletas con panel de estadísticas en tiempo real.

| Campo        | Detalle                        |
|--------------|--------------------------------|
| **Autores**  | Raúl Ibarra — Jhon Bustos      |
| **Instituto**| Instituto Santo Tomás Rancagua |
| **Versión**  | 1.0.0                          |
| **Stack**    | Node.js · Express · SQLite (sql.js) · EJS |

---

## Requisitos previos

Solo necesitas tener instalado:

- [Node.js 18+](https://nodejs.org/) — incluye `npm` automáticamente

> **¿Cómo verificar?** Abre una terminal y ejecuta:
> ```bash
> node -v   # debe mostrar v18.x.x o superior
> npm -v    # debe mostrar 9.x.x o superior
> ```

No se requiere instalar ninguna base de datos, ni servidor adicional, ni Docker. Todo corre con `npm install`.

---

## Instalación y arranque

```bash
# 1. Clonar el repositorio
git clone https://github.com/rullroice/Rull_Admin.git
cd Rull_Admin

# 2. Instalar TODAS las dependencias automáticamente
npm install

# 3. Crear el archivo de variables de entorno
cp backend/.env.example backend/.env

# 4. Iniciar el servidor
npm start
```

Listo. Abrir en el navegador:

```
http://localhost:3000
```

> Para desarrollo con **recarga automática** al guardar cambios:
> ```bash
> npm run dev
> ```

---

## Primer acceso — Crear usuario administrador

El sistema no trae usuarios precargados. Al iniciar por primera vez, registrar el administrador con este comando (requiere tener el servidor corriendo):

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre":   "Administrador",
    "email":    "admin@rulltec.cl",
    "password": "Admin1234",
    "rol":      "admin"
  }'
```

Luego ingresar en `/login` con:

| Campo    | Valor            |
|----------|------------------|
| Email    | admin@rulltec.cl |
| Password | Admin1234        |

---

## Recorrido del sistema

### 1. Dashboard `/dashboard`
Vista de inicio tras el login. Muestra estadísticas del día: equipos ingresados, en proceso, listos y entregados. Boletas emitidas y monto total recaudado.

### 2. Clientes `/clientes`
Registro de personas que traen equipos al taller.
- Crear cliente con nombre, apellido, RUT y teléfono.
- Buscador en tiempo real por nombre o RUT.
- Editar y eliminar (solo si el cliente no tiene equipos asociados).

### 3. Equipos `/equipos`
Ciclo de vida de cada equipo ingresado al taller.
- Asociar equipo a un cliente registrado.
- Tipos disponibles: notebook, escritorio.
- Descripción libre del requerimiento técnico.
- **Estados:** `ingresado → en proceso → listo → entregado`
- Cambio de estado desde el botón "Estado" en la tabla.
- Filtro por estado en la vista.

### 4. Servicios `/servicios`
Catálogo de servicios del taller con sus precios en CLP.
- Crear, editar y desactivar servicios.
- Un servicio desactivado no aparece en el catálogo pero conserva su historial en boletas.

### 5. Caja `/caja`
Lista de equipos con estado `listo` pendientes de cobro.
- Seleccionar un equipo para emitir la boleta.
- Ingresar servicio, descuento (opcional) y anticipo (opcional).
- El sistema calcula el total y el vuelto automáticamente.
- Al emitir, el equipo pasa automáticamente a estado `entregado`.

### 6. Boletas `/boletas`
Historial completo de todas las boletas emitidas.
- Ver detalle de cada boleta.
- Descargar boleta en PDF.

---

## Variables de entorno

El archivo `backend/.env` se crea a partir de `backend/.env.example`. Contiene:

```env
JWT_SECRET=cambia_esto_por_una_clave_segura
JWT_EXPIRES_IN=8h
PORT=3000
NODE_ENV=development
```

> **Importante:** `JWT_SECRET` debe ser una cadena larga y aleatoria en producción. Para desarrollo, cualquier texto funciona.

---

## Comandos disponibles

| Comando              | Descripción                                      |
|----------------------|--------------------------------------------------|
| `npm install`        | Instala todas las dependencias                   |
| `npm start`          | Inicia el servidor en modo producción            |
| `npm run dev`        | Inicia con nodemon (recarga al guardar cambios)  |
| `npm test`           | Ejecuta los 62 tests de integración              |
| `npm run test:coverage` | Tests con reporte de cobertura de código      |

---

## Estructura del proyecto

```
Rull_Admin/
├── backend/
│   ├── server.js              # Punto de entrada Express + EJS
│   ├── .env                   # Variables de entorno (NO subir a Git)
│   ├── .env.example           # Plantilla de variables (sí se sube)
│   ├── rulltec.db             # Base de datos SQLite (se genera sola)
│   └── src/
│       ├── db.js              # Motor sql.js + helpers
│       ├── controllers/       # Lógica de negocio por módulo
│       ├── routes/            # Definición de endpoints API
│       ├── middlewares/       # Verificación JWT
│       └── tests/             # Suites Jest + Supertest
├── frontend/
│   ├── css/style.css          # Estilos globales
│   ├── js/                    # Scripts por vista
│   └── views/                 # Plantillas EJS
├── documentacion/
│   └── RullTec_Presentacion.md
├── .gitignore
├── package.json
└── README.md
```

---

## Solución de problemas frecuentes

**El servidor no inicia:**
- Verificar que Node.js sea versión 18 o superior: `node -v`
- Verificar que existe el archivo `backend/.env` (correr `cp backend/.env.example backend/.env`)

**Error al hacer login:**
- Asegurarse de haber creado el usuario administrador con el comando `curl` de la sección "Primer acceso".

**Puerto 3000 ocupado:**
- Cambiar el puerto en `backend/.env`: `PORT=3001` y acceder a `http://localhost:3001`

**La base de datos no guarda datos entre reinicios:**
- Verificar que el proceso tiene permisos de escritura en la carpeta `backend/`.

---

## Pruebas

El proyecto incluye **62 tests de integración** sobre 5 suites (Jest + Supertest). Cada suite usa una base de datos en memoria aislada, sin afectar los datos reales.

```bash
npm test
```

| Suite             | Archivo            | Tests |
|-------------------|--------------------|-------|
| Autenticación     | auth.test.js       | JWT, login, registro |
| Clientes          | clientes.test.js   | CRUD, validación RUT |
| Equipos           | equipos.test.js    | CRUD, cambio de estado |
| Servicios         | servicios.test.js  | CRUD, soft delete |
| Boletas           | boletas.test.js    | Emisión, cálculo de totales |

---

*Instituto Santo Tomás Rancagua — Aseguramiento de Calidad 2026*
