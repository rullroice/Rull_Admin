# RullTec — Sistema de Gestión de Taller de Reparación

---

| Campo         | Detalle                                     |
|---------------|---------------------------------------------|
| **Autores**   | Raúl Ibarra — Jhon Bustos                   |
| **Instituto** | Instituto Santo Tomás Rancagua              |
| **Asignatura**| Aseguramiento de Calidad                    |
| **Docente**   | Boris González                              |
| **Año**       | 2026                                        |
| **Versión**   | 1.0.0                                       |

---

## 1. Descripción del Sistema

**RullTec** es un sistema de gestión integral para talleres de reparación de equipos computacionales. Permite registrar y dar seguimiento a equipos ingresados por clientes, desde la recepción hasta la entrega final, pasando por las etapas de revisión y reparación. Incluye un módulo de caja para emitir boletas y un panel de control con estadísticas en tiempo real.

### Problema que resuelve

Los talleres pequeños y medianos de reparación gestionan su operación de forma manual (papel o planillas), lo que genera pérdida de información, demoras en la atención y errores en los cobros. RullTec centraliza toda la operación en una sola plataforma web accesible desde cualquier navegador.

### Público objetivo

Técnicos en computación y dueños de talleres de reparación que necesitan una herramienta liviana, sin instalación de software adicional y con acceso basado en roles.

---

## 2. Stack Tecnológico

| Capa           | Tecnología     | Versión  | Razón de elección                                                              |
|----------------|----------------|----------|--------------------------------------------------------------------------------|
| Runtime        | Node.js        | 18+      | Entorno JavaScript en servidor, amplio ecosistema npm                          |
| Framework HTTP | Express        | 4.x      | Minimalista, flexible y ampliamente documentado                                |
| Base de datos  | sql.js         | 1.14.x   | SQLite compilado a WebAssembly; no requiere binarios nativos, ideal para entornos de desarrollo/CI |
| Motor de vistas| EJS            | 6.x      | Plantillas HTML con JavaScript embebido; curva de aprendizaje mínima           |
| Autenticación  | jsonwebtoken   | 9.x      | Tokens JWT estándar de industria para autenticación stateless                  |
| Hash contraseñas| bcryptjs      | 2.x      | Implementación pura JS de bcrypt; sin dependencias nativas                     |
| Validación     | Joi            | 17.x     | Esquemas de validación declarativos con mensajes personalizados                |
| Variables env  | dotenv         | 16.x     | Carga de configuración desde archivo `.env`                                    |
| CORS           | cors           | 2.x      | Middleware para permitir peticiones cross-origin                               |
| Frontend       | HTML/CSS/JS    | Vanilla  | Sin frameworks; máximo control y sin dependencias de compilación               |
| PDF            | jsPDF          | 2.5.x    | Generación de PDFs en el navegador (cliente)                                   |
| Pruebas        | Jest + Supertest| 29.x / 7.x | Suite de pruebas de integración HTTP sobre la misma app Express             |

---

## 3. Arquitectura del Sistema

```
┌────────────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                       │
│                                                            │
│   EJS Views  ←→  JavaScript Vanilla  ←→  fetch() API      │
│   /login, /dashboard, /clientes,                          │
│   /equipos, /servicios, /caja, /boletas                   │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTP (puerto 3000)
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                   EXPRESS SERVER                           │
│                   (backend/server.js)                      │
│                                                            │
│   Middlewares: cors · express.json · express.urlencoded   │
│   Motor EJS:   app.set('view engine', 'ejs')              │
│   Estáticos:   /css → frontend/css                        │
│                /js  → frontend/js                         │
│                                                            │
│   Rutas de vistas:   GET /login, /dashboard, ...          │
│   Rutas API:         /api/auth, /api/clientes, ...        │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                    CONTROLLERS                             │
│                                                            │
│  authController  │ clientesController  │ equiposController │
│  serviciosController │ cajaController  │ boletasController │
│  dashboardController                                       │
│                                                            │
│  Validación: Joi schemas por cada entidad                 │
│  Middleware: authMiddleware (verificación JWT)            │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│               BASE DE DATOS (sql.js / SQLite)              │
│               backend/rulltec.db                           │
│                                                            │
│   Tablas: usuarios · clientes · equipos                   │
│           servicios · boletas                              │
│                                                            │
│   Helpers: dbRun() · dbGet() · dbAll()                    │
│   Persistencia: fs.writeFileSync tras cada escritura      │
└────────────────────────────────────────────────────────────┘
```

---

## 4. Módulos del Sistema

### 4.1 Autenticación (Auth)

**Propósito:** Controlar el acceso al sistema mediante JWT. Solo usuarios autenticados pueden operar los módulos protegidos.

**Funcionalidades clave:**
- Login con email y contraseña (hash bcrypt)
- Registro de nuevos usuarios con asignación de rol
- Consulta de perfil del usuario autenticado
- Token JWT con expiración configurable (por defecto 8 horas)

**Endpoints:**

| Método | Ruta                  | Descripción                    |
|--------|-----------------------|--------------------------------|
| POST   | `/api/auth/login`     | Iniciar sesión, retorna JWT    |
| POST   | `/api/auth/register`  | Registrar nuevo usuario        |
| GET    | `/api/auth/me`        | Obtener perfil (requiere JWT)  |

---

### 4.2 Clientes

**Propósito:** Gestionar el registro de personas que llevan equipos al taller.

**Funcionalidades clave:**
- Registro con nombre, apellido, RUT y teléfono
- Validación de RUT chileno mediante algoritmo módulo 11
- Formateo automático del RUT (ej.: `12.345.678-9`)
- Búsqueda por nombre, apellido o RUT
- Protección de eliminación si el cliente tiene equipos asociados

**Endpoints:**

| Método | Ruta                 | Descripción                             |
|--------|----------------------|-----------------------------------------|
| GET    | `/api/clientes`      | Listar clientes (param: `?q=búsqueda`) |
| GET    | `/api/clientes/:id`  | Obtener un cliente por ID              |
| POST   | `/api/clientes`      | Crear nuevo cliente                    |
| PUT    | `/api/clientes/:id`  | Actualizar datos del cliente           |
| DELETE | `/api/clientes/:id`  | Eliminar cliente (sin equipos)         |

---

### 4.3 Equipos

**Propósito:** Registrar los equipos ingresados al taller y gestionar su ciclo de vida a través de estados.

**Funcionalidades clave:**
- Asociación de equipo a un cliente existente
- Tipos: notebook, escritorio
- Descripción de requerimiento libre
- Filtro por estado
- Cambio de estado independiente (PATCH)

**Endpoints:**

| Método | Ruta                        | Descripción                        |
|--------|-----------------------------|------------------------------------|
| GET    | `/api/equipos`              | Listar equipos (param: `?estado=`) |
| GET    | `/api/equipos/:id`          | Obtener un equipo por ID           |
| POST   | `/api/equipos`              | Crear nuevo equipo                 |
| PUT    | `/api/equipos/:id`          | Actualizar datos del equipo        |
| PATCH  | `/api/equipos/:id/estado`   | Cambiar estado del equipo          |
| DELETE | `/api/equipos/:id`          | Eliminar equipo                    |

---

### 4.4 Servicios

**Propósito:** Mantener un catálogo de servicios ofrecidos por el taller, con sus respectivos costos.

**Funcionalidades clave:**
- Registro de nombre y costo en CLP
- Soft delete (el servicio se desactiva, no se elimina físicamente)
- Protección: no se puede eliminar si tiene boletas asociadas

**Endpoints:**

| Método | Ruta                  | Descripción                     |
|--------|-----------------------|---------------------------------|
| GET    | `/api/servicios`      | Listar servicios activos        |
| GET    | `/api/servicios/:id`  | Obtener servicio por ID         |
| POST   | `/api/servicios`      | Crear nuevo servicio            |
| PUT    | `/api/servicios/:id`  | Actualizar servicio             |
| DELETE | `/api/servicios/:id`  | Desactivar servicio (soft delete)|

---

### 4.5 Caja

**Propósito:** Mostrar los equipos en estado "listo" disponibles para cobro, facilitando la emisión de boletas.

**Funcionalidades clave:**
- Lista filtrada de equipos con estado `listo`
- Punto de entrada hacia el módulo de boletas

**Endpoints:**

| Método | Ruta          | Descripción                            |
|--------|---------------|----------------------------------------|
| GET    | `/api/caja`   | Listar equipos listos para cobro       |

---

### 4.6 Boletas

**Propósito:** Emitir y consultar el historial de boletas de cobro asociadas a servicios realizados.

**Funcionalidades clave:**
- Emisión de boleta con selección de servicio, anticipo y descuento
- Cálculo automático de total, saldo y vuelto
- Cambio de estado del equipo a `entregado` al emitir boleta
- Descarga de boleta en formato PDF (client-side con jsPDF)

**Endpoints:**

| Método | Ruta               | Descripción                        |
|--------|--------------------|------------------------------------|
| GET    | `/api/boletas`     | Listar todas las boletas           |
| GET    | `/api/boletas/:id` | Obtener detalle de una boleta      |
| POST   | `/api/boletas`     | Emitir nueva boleta                |

---

### 4.7 Dashboard

**Propósito:** Proveer un resumen ejecutivo del estado actual del taller para la vista de inicio.

**Funcionalidades clave:**
- Conteo de atenciones del día (boletas emitidas hoy)
- Recaudación del día (suma de totales de boletas de hoy)
- Conteo de equipos agrupados por estado

**Endpoints:**

| Método | Ruta               | Descripción                             |
|--------|--------------------|-----------------------------------------|
| GET    | `/api/dashboard`   | Resumen: boletas del día y estados      |

---

## 5. Esquema de Base de Datos

### Tabla `usuarios`

| Columna     | Tipo    | Constraints                    | Descripción                    |
|-------------|---------|--------------------------------|--------------------------------|
| `id`        | INTEGER | PRIMARY KEY AUTOINCREMENT      | Identificador único            |
| `nombre`    | TEXT    | NOT NULL                       | Nombre del usuario             |
| `email`     | TEXT    | NOT NULL UNIQUE                | Correo electrónico (login)     |
| `hash`      | TEXT    | NOT NULL                       | Contraseña hasheada con bcrypt |
| `rol`       | TEXT    | NOT NULL DEFAULT 'cajero'      | Rol: `admin` o `cajero`        |
| `creado_en` | TEXT    | NOT NULL DEFAULT datetime()    | Fecha/hora de creación         |

### Tabla `clientes`

| Columna     | Tipo    | Constraints                 | Descripción              |
|-------------|---------|------------------------------|--------------------------|
| `id`        | INTEGER | PRIMARY KEY AUTOINCREMENT   | Identificador único      |
| `nombre`    | TEXT    | NOT NULL                    | Nombre del cliente       |
| `apellido`  | TEXT    | NOT NULL                    | Apellido del cliente     |
| `rut`       | TEXT    | NOT NULL UNIQUE             | RUT formateado (ej. `12.345.678-9`) |
| `telefono`  | TEXT    | (nullable)                  | Teléfono con prefijo     |
| `creado_en` | TEXT    | NOT NULL DEFAULT datetime() | Fecha/hora de registro   |

### Tabla `equipos`

| Columna          | Tipo    | Constraints                          | Descripción                        |
|------------------|---------|--------------------------------------|------------------------------------|
| `id`             | INTEGER | PRIMARY KEY AUTOINCREMENT            | Identificador único                |
| `cliente_id`     | INTEGER | NOT NULL REFERENCES clientes(id)     | Cliente propietario                |
| `tipo`           | TEXT    | NOT NULL                             | `notebook` o `escritorio`          |
| `marca`          | TEXT    | (nullable)                           | Marca del equipo                   |
| `requerimiento`  | TEXT    | NOT NULL                             | Descripción del problema           |
| `estado`         | TEXT    | NOT NULL DEFAULT 'ingresado'         | Estado actual en el ciclo de vida  |
| `ingresado_en`   | TEXT    | NOT NULL DEFAULT datetime()          | Fecha/hora de ingreso              |
| `actualizado_en` | TEXT    | NOT NULL DEFAULT datetime()          | Fecha/hora de última modificación  |

### Tabla `servicios`

| Columna     | Tipo    | Constraints                 | Descripción                       |
|-------------|---------|------------------------------|-----------------------------------|
| `id`        | INTEGER | PRIMARY KEY AUTOINCREMENT   | Identificador único               |
| `nombre`    | TEXT    | NOT NULL                    | Nombre del servicio               |
| `costo`     | REAL    | NOT NULL                    | Precio base en CLP                |
| `activo`    | INTEGER | NOT NULL DEFAULT 1          | `1` = activo, `0` = eliminado (soft delete) |
| `creado_en` | TEXT    | NOT NULL DEFAULT datetime() | Fecha/hora de creación            |

### Tabla `boletas`

| Columna       | Tipo    | Constraints                        | Descripción                               |
|---------------|---------|------------------------------------|-------------------------------------------|
| `id`          | INTEGER | PRIMARY KEY AUTOINCREMENT          | Número de boleta                          |
| `equipo_id`   | INTEGER | NOT NULL REFERENCES equipos(id)    | Equipo cobrado                            |
| `servicio_id` | INTEGER | NOT NULL REFERENCES servicios(id)  | Servicio aplicado                         |
| `precio`      | REAL    | NOT NULL                           | Precio del servicio al momento del cobro  |
| `anticipo`    | REAL    | NOT NULL DEFAULT 0                 | Pago previo recibido                      |
| `descuento`   | REAL    | NOT NULL DEFAULT 0                 | Descuento aplicado                        |
| `total`       | REAL    | NOT NULL                           | Total a pagar = precio − descuento        |
| `vuelto`      | REAL    | NOT NULL DEFAULT 0                 | Vuelto = monto_pagado − saldo_restante    |
| `emitida_en`  | TEXT    | NOT NULL DEFAULT datetime()        | Fecha/hora de emisión                     |

---

## 6. Flujo de Estados de Equipos

Cada equipo recorre el siguiente ciclo de vida desde su ingreso hasta la entrega:

```
                    ┌───────────────┐
       Ingreso  ──► │   INGRESADO   │
                    └──────┬────────┘
                           │ Técnico comienza revisión
                           ▼
                    ┌───────────────┐
                    │  EN REVISIÓN  │
                    └──────┬────────┘
                           │ Se diagnostica el problema
                           ▼
                    ┌───────────────┐
                    │ EN REPARACIÓN │
                    └──────┬────────┘
                           │ Reparación completada
                           ▼
                    ┌───────────────┐
                    │     LISTO     │ ◄── Disponible en módulo Caja
                    └──────┬────────┘
                           │ Boleta emitida (automático)
                           ▼
                    ┌───────────────┐
                    │   ENTREGADO   │ ◄── Estado final
                    └───────────────┘

  Notas:
  - El estado puede actualizarse manualmente a cualquier estado via PATCH /api/equipos/:id/estado
  - Al emitir una boleta, el equipo pasa automáticamente a "entregado"
  - Solo equipos en estado "listo" aparecen en el módulo Caja
```

---

## 7. Reglas de Negocio Clave

### 7.1 Validación de RUT Chileno (Módulo 11)

El sistema implementa la validación oficial del Servicio de Impuestos Internos (SII):

```
Algoritmo:
1. Separar el cuerpo del dígito verificador (DV)
2. Recorrer el cuerpo de derecha a izquierda
3. Multiplicar cada dígito por el factor (2, 3, 4, 5, 6, 7, 2, 3, ...)
4. Sumar todos los productos
5. DV calculado = 11 - (suma mod 11)
6. Si resultado = 11 → DV = '0'
   Si resultado = 10 → DV = 'K'
   De lo contrario  → DV = resultado como string

Ejemplo válido: 12.345.678-9
  Cuerpo: 12345678
  Suma ponderada: 8×2 + 7×3 + 6×4 + 5×5 + 4×6 + 3×7 + 2×2 + 1×3 = 194
  DV calculado: 11 - (194 mod 11) = 11 - 7 = 4  → No coincide, este ejemplo es ilustrativo.
```

### 7.2 Cálculo de Boleta

```
total          = precio_servicio - descuento
saldo_restante = total - anticipo
vuelto         = max(0, monto_pagado - saldo_restante)
```

Restricciones:
- `descuento` no puede ser mayor que `precio`
- `anticipo` no puede ser mayor que `total`
- Todos los montos son en CLP (pesos chilenos), sin decimales en la UI

### 7.3 Soft Delete de Servicios

Cuando se "elimina" un servicio, el campo `activo` se establece en `0`. El registro se mantiene en la base de datos para preservar la integridad referencial con las boletas existentes. Al listar servicios, solo se retornan aquellos con `activo = 1`.

### 7.4 Restricciones de Eliminación

| Entidad   | Restricción                                                              |
|-----------|--------------------------------------------------------------------------|
| Cliente   | No se puede eliminar si tiene equipos registrados (integridad referencial) |
| Equipo    | Puede eliminarse; no bloquea si tiene boletas (según implementación actual) |
| Servicio  | No se elimina físicamente; se desactiva con soft delete                  |
| Boleta    | No tiene endpoint DELETE; las boletas son permanentes (trazabilidad)     |

---

## 8. Endpoints API Completos

| Método | Ruta                        | Descripción                                 | Auth requerida |
|--------|-----------------------------|---------------------------------------------|:--------------:|
| POST   | `/api/auth/login`           | Iniciar sesión (retorna JWT)                | No             |
| POST   | `/api/auth/register`        | Registrar usuario                           | No             |
| GET    | `/api/auth/me`              | Obtener perfil del usuario autenticado      | Si             |
| GET    | `/api/clientes`             | Listar clientes (soporta `?q=`)            | Si             |
| GET    | `/api/clientes/:id`         | Obtener cliente por ID                      | Si             |
| POST   | `/api/clientes`             | Crear cliente                               | Si             |
| PUT    | `/api/clientes/:id`         | Actualizar cliente                          | Si             |
| DELETE | `/api/clientes/:id`         | Eliminar cliente                            | Si             |
| GET    | `/api/equipos`              | Listar equipos (soporta `?estado=`)        | Si             |
| GET    | `/api/equipos/:id`          | Obtener equipo por ID                       | Si             |
| POST   | `/api/equipos`              | Crear equipo                                | Si             |
| PUT    | `/api/equipos/:id`          | Actualizar equipo                           | Si             |
| PATCH  | `/api/equipos/:id/estado`   | Cambiar estado del equipo                   | Si             |
| DELETE | `/api/equipos/:id`          | Eliminar equipo                             | Si             |
| GET    | `/api/servicios`            | Listar servicios activos                    | Si             |
| GET    | `/api/servicios/:id`        | Obtener servicio por ID                     | Si             |
| POST   | `/api/servicios`            | Crear servicio                              | Si             |
| PUT    | `/api/servicios/:id`        | Actualizar servicio                         | Si             |
| DELETE | `/api/servicios/:id`        | Desactivar servicio (soft delete)           | Si             |
| GET    | `/api/caja`                 | Listar equipos listos para cobro            | Si             |
| GET    | `/api/boletas`              | Listar todas las boletas                    | Si             |
| GET    | `/api/boletas/:id`          | Obtener detalle de boleta                   | Si             |
| POST   | `/api/boletas`              | Emitir boleta                               | Si             |
| GET    | `/api/dashboard`            | Resumen estadístico del día                 | Si             |
| GET    | `/api/health`               | Health check del servidor                   | No             |

---

## 9. Guía de Instalación

### Requisitos previos

- Node.js 18 o superior
- npm 9 o superior

### Pasos

```bash
# 1. Clonar o descomprimir el proyecto
cd RullTec_Boris

# 2. Instalar dependencias
npm install

# 3. Crear archivo de configuración de entorno
cp backend/.env.example backend/.env
# Editar backend/.env y establecer:
#   JWT_SECRET=una_clave_segura_aleatoria
#   JWT_EXPIRES_IN=8h
#   PORT=3000
#   NODE_ENV=development

# 4. Iniciar el servidor
npm start

# O en modo desarrollo con recarga automática:
npm run dev
```

---

## 10. Ejecución y Credenciales

Una vez iniciado el servidor, acceder a:

```
http://localhost:3000
```

El sistema redirige automáticamente a `/login`. Para el primer acceso, registrar un usuario mediante la API:

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

### Credenciales de prueba (entorno de desarrollo)

| Campo    | Valor              |
|----------|--------------------|
| Email    | admin@rulltec.cl   |
| Password | Admin1234          |
| Rol      | admin              |

---

## 11. Ejecución de Pruebas

### Correr suite completa

```bash
npm test
```

### Correr con reporte de cobertura

```bash
npm run test:coverage
```

### Cobertura de pruebas

El proyecto cuenta con **62 tests** distribuidos en **5 suites** de integración (Jest + Supertest). Cada suite usa una base de datos en memoria para aislar los tests del entorno de desarrollo.

| Suite                        | Archivo               | Casos de prueba cubiertos                                               |
|------------------------------|-----------------------|-------------------------------------------------------------------------|
| Autenticación                | `auth.test.js`        | Login válido/inválido, registro, token JWT, perfil protegido            |
| Gestión de Clientes          | `clientes.test.js`    | CRUD completo, validación RUT, búsqueda, restricción de eliminación     |
| Gestión de Equipos           | `equipos.test.js`     | CRUD completo, cambio de estado, filtros, asociación con cliente        |
| Catálogo de Servicios        | `servicios.test.js`   | CRUD completo, soft delete, validación de costo                        |
| Emisión de Boletas           | `boletas.test.js`     | Emisión, cálculo de totales/vuelto, cambio de estado a entregado       |

### Estrategia de pruebas

- **Aislamiento:** Cada suite inicializa una BD SQLite en memoria mediante `createTestDb()`, garantizando que los tests no interfieran entre sí ni con datos de producción.
- **Pruebas de integración:** Se testea la pila completa (rutas → controladores → base de datos) usando Supertest para simular peticiones HTTP reales.
- **Casos positivos y negativos:** Cada módulo incluye tests de flujo exitoso y de manejo de errores (400, 401, 404, 409).
- **Ejecución en serie:** `--runInBand` garantiza que los tests se ejecuten secuencialmente, evitando conflictos en el estado de la BD compartida por suite.

---

## 12. Estructura de Directorios

```
RullTec_Boris/
├── backend/
│   ├── server.js                   # Punto de entrada, configuración Express + EJS
│   ├── .env                        # Variables de entorno (no versionado)
│   ├── rulltec.db                  # Base de datos SQLite (generada en runtime)
│   ├── src/
│   │   ├── db.js                   # Motor sql.js: init, helpers, persist
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── clientesController.js
│   │   │   ├── equiposController.js
│   │   │   ├── serviciosController.js
│   │   │   ├── cajaController.js
│   │   │   ├── boletasController.js
│   │   │   └── dashboardController.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── clientesRoutes.js
│   │   │   ├── equiposRoutes.js
│   │   │   ├── serviciosRoutes.js
│   │   │   ├── cajaRoutes.js
│   │   │   ├── boletasRoutes.js
│   │   │   └── dashboardRoutes.js
│   │   └── middlewares/
│   │       └── authMiddleware.js   # Verificación JWT en rutas protegidas
│   └── tests/
│       ├── auth.test.js
│       ├── clientes.test.js
│       ├── equipos.test.js
│       ├── servicios.test.js
│       └── boletas.test.js
├── frontend/
│   ├── css/
│   │   └── style.css               # Estilos globales (sistema de diseño RullTec)
│   ├── js/
│   │   ├── app.js                  # Utilidades compartidas: auth, fetch, formato
│   │   ├── login.js
│   │   ├── dashboard.js
│   │   ├── clientes.js
│   │   ├── equipos.js
│   │   ├── servicios.js
│   │   ├── caja.js
│   │   └── boletas.js
│   └── views/
│       ├── login.ejs
│       ├── dashboard.ejs
│       ├── clientes.ejs
│       ├── equipos.ejs
│       ├── servicios.ejs
│       ├── caja.ejs
│       ├── boletas.ejs
│       └── partials/
│           ├── head.ejs            # Meta, título, enlace CSS
│           └── sidebar.ejs         # Navegación lateral con resaltado activo
├── documentacion/
│   └── RullTec_Presentacion.md
└── package.json
```

---

*Documento generado para presentación académica — Instituto Santo Tomás Rancagua, 2026*
