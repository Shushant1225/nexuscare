import React, { useEffect, useState } from "react";
import { listAppointments, updateStatus } from "../api.js";

const STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled"];

export default function StaffBoard() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setRows((await listAppointments()).appointments);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function change(id, status) {
    try {
      const { appointment } = await updateStatus(id, status);
      setRows((rs) => rs.map((r) => (r.id === id ? appointment : r)));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="card wide-card">
      <div className="row between">
        <h2>Appointment requests</h2>
        <button className="chip" onClick={load}>↻ Refresh</button>
      </div>
      {error && <div className="alert error">{error}</div>}
      {loading && <p className="muted">Loading…</p>}
      {!loading && rows.length === 0 && <p className="muted">No requests yet. Create one from Patient Intake.</p>}

      <div className="table-wrap">
        {rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>#</th><th>Patient</th><th>Reason</th><th>Dept</th><th>When</th><th>Urgency</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td><strong>{r.patient_name}</strong><div className="muted small">{r.contact || "no contact"}</div></td>
                  <td>{r.reason}</td>
                  <td>{r.department}</td>
                  <td>{r.preferred_date || "—"}<div className="muted small">{r.preferred_time || ""}</div></td>
                  <td><span className={`badge ${r.urgency}`}>{r.urgency}</span></td>
                  <td>
                    <select value={r.status} onChange={(e) => change(r.id, e.target.value)}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
