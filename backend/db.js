// db.js - SQLite database using Node's BUILT-IN sqlite module (Node 22.13+ / 24).
// No native package to install or compile.
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(process.env.DB_PATH || "nexuscare.db");
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
CREATE TABLE IF NOT EXISTS appointments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_name   TEXT NOT NULL,
  contact        TEXT,
  reason         TEXT NOT NULL,
  preferred_date TEXT,
  preferred_time TEXT,
  department     TEXT NOT NULL,
  urgency        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'Pending',
  source_text    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// node:sqlite rejects `undefined`, so normalise to null.
const n = (v) => (v === undefined ? null : v);

export function createAppointment(a) {
  const info = db
    .prepare(
      `INSERT INTO appointments
       (patient_name, contact, reason, preferred_date, preferred_time, department, urgency, source_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      n(a.patient_name), n(a.contact), n(a.reason), n(a.preferred_date),
      n(a.preferred_time), n(a.department), n(a.urgency), n(a.source_text)
    );
  return getAppointment(Number(info.lastInsertRowid));
}

export function getAppointment(id) {
  return db.prepare("SELECT * FROM appointments WHERE id = ?").get(id);
}

export function listAppointments() {
  return db
    .prepare(
      `SELECT * FROM appointments
       ORDER BY CASE urgency WHEN 'urgent' THEN 0 WHEN 'soon' THEN 1 ELSE 2 END, id DESC`
    )
    .all();
}

export function updateStatus(id, status) {
  db.prepare(
    "UPDATE appointments SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, id);
  return getAppointment(id);
}