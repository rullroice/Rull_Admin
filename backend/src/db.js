// src/db.js
// Base de datos SQLite usando sql.js (WebAssembly — sin compilación nativa)
// Persiste en disco usando fs.readFileSync / writeFileSync

const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(__dirname, '..', 'rulltec.db');

let SQL  = null;  // instancia de sql.js
let db   = null;  // instancia Database activa
let isMemory = false;

// ── Inicialización asíncrona del motor ───────────────────────────────────────
async function initEngine() {
  if (!SQL) {
    const initSqlJs = require('sql.js');
    SQL = await initSqlJs();
  }
}

// ── Obtener (o crear) la BD de disco ────────────────────────────────────────
async function getDb() {
  if (db) return db;

  await initEngine();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  isMemory = false;
  initSchema();
  return db;
}

// ── Persistir en disco (llamar después de cada escritura) ────────────────────
function persist() {
  if (!db || isMemory) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ── Esquema completo del DRF ─────────────────────────────────────────────────
function initSchema() {
  db.run(`PRAGMA foreign_keys = ON;`);
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre    TEXT    NOT NULL,
      email     TEXT    NOT NULL UNIQUE,
      hash      TEXT    NOT NULL,
      rol       TEXT    NOT NULL DEFAULT 'cajero',
      creado_en TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre    TEXT    NOT NULL,
      apellido  TEXT    NOT NULL,
      rut       TEXT    NOT NULL UNIQUE,
      telefono  TEXT,
      creado_en TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS equipos (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id     INTEGER NOT NULL REFERENCES clientes(id),
      tipo           TEXT    NOT NULL,
      marca          TEXT,
      requerimiento  TEXT    NOT NULL,
      estado         TEXT    NOT NULL DEFAULT 'ingresado',
      ingresado_en   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      actualizado_en TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS servicios (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre    TEXT    NOT NULL,
      costo     REAL    NOT NULL,
      activo    INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS boletas (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      equipo_id   INTEGER NOT NULL REFERENCES equipos(id),
      servicio_id INTEGER NOT NULL REFERENCES servicios(id),
      precio      REAL    NOT NULL,
      anticipo    REAL    NOT NULL DEFAULT 0,
      descuento   REAL    NOT NULL DEFAULT 0,
      total       REAL    NOT NULL,
      vuelto      REAL    NOT NULL DEFAULT 0,
      emitida_en  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);
}

// ── Helpers estilo better-sqlite3 (síncronos desde la perspectiva del caller) ─
// sql.js tiene una API diferente; estos wrappers la uniformizan.

function dbRun(sql, params = []) {
  db.run(sql, params);
  persist();
  // Retorna el id del último insert
  const rows = db.exec('SELECT last_insert_rowid() as id');
  return { lastInsertRowid: rows[0]?.values[0][0] ?? null };
}

function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const obj = stmt.getAsObject();
    stmt.free();
    return obj;
  }
  stmt.free();
  return undefined;
}

function dbAll(sql, params = []) {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

// ── BD en memoria para tests ─────────────────────────────────────────────────
async function createTestDb() {
  await initEngine();
  db = new SQL.Database(); // en memoria, sin disco
  isMemory = true;
  initSchema();
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, persist, dbRun, dbGet, dbAll, createTestDb, closeDb };
