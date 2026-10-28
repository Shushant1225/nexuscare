import React, { useRef, useState } from "react";
import { extractAppointment, saveAppointment } from "../api.js";

const DEPARTMENTS = ["General", "Cardiology", "Pediatrics", "Orthopedics", "Other"];
const URGENCIES = ["routine", "soon", "urgent"];
const FIELDS = [
  { key: "patient_name", label: "Patient name", required: true },
  { key: "contact", label: "Contact number" },
  { key: "reason", label: "Reason for visit", required: true },
  { key: "preferred_date", label: "Preferred date", type: "date" },
  { key: "preferred_time", label: "Preferred time" },
];

const SAMPLES = [
  "I'm Ravi Kumar, my number is 9876543210. I have chest pain since morning, need a doctor tomorrow morning.",
  "My son has fever for two days. Please book a child specialist. Contact 9812345678.",
  "I need an appointment.", // missing-field demo
];

export default function Intake() {
  const [text, setText] = useState("");
  const [lang, setLang] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // preview from AI
  const [form, setForm] = useState(null); // editable copy
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState("");
  const recRef = useRef(null);

  const speechSupported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  function toggleMic() {
    if (listening) return recRef.current?.stop();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    let base = text ? text + " " : "";
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setText(base + t);
    };
    rec.onerror = () => { setError("Microphone problem. Allow mic access or type your message."); setListening(false); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function analyze() {
    setError(""); setSaved(null); setResult(null); setForm(null);
    setLoading(true);
    try {
      const r = await extractAppointment(text);
      setResult(r);
      setForm(r.preview);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    setError(""); setLoading(true);
    try {
      const r = await saveAppointment(form, text);
      setSaved(r.appointment);
      setResult(null); setForm(null); setText("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const missing = (k) => form && !form[k];
  const canConfirm = form && form.patient_name && form.reason;

  return (
    <div className="grid">
      <section className="card">
        <h2>1. Tell us what you need</h2>
        <p className="muted">Speak or type in English, हिन्दी or ਪੰਜਾਬੀ.</p>

        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='e.g. "I am Ravi, need a cardiology appointment tomorrow morning, number 98765…"'
        />

        <div className="row">
          {speechSupported && (
            <>
              <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={listening}>
                <option value="en-IN">English</option>
                <option value="hi-IN">हिन्दी</option>
                <option value="pa-IN">ਪੰਜਾਬੀ</option>
              </select>
              <button className={listening ? "mic live" : "mic"} onClick={toggleMic} type="button">
                {listening ? "■ Stop" : "🎤 Speak"}
              </button>
            </>
          )}
          <button className="primary" onClick={analyze} disabled={loading || text.trim().length < 5}>
            {loading && !form ? "Analyzing…" : "Analyze with AI"}
          </button>
        </div>
        {!speechSupported && <p className="muted small">Voice input needs Chrome/Edge. You can type instead.</p>}

        <div className="samples">
          <span className="muted small">Try a sample:</span>
          {SAMPLES.map((s, i) => (
            <button key={i} className="chip" onClick={() => setText(s)}>Sample {i + 1}</button>
          ))}
        </div>

        {error && <div className="alert error">{error}</div>}
      </section>

      <section className="card">
        <h2>2. Review &amp; confirm</h2>

        {!form && !saved && <p className="muted">The extracted appointment request will appear here for you to check before anything is saved.</p>}

        {result?.emergency && (
          <div className="alert emergency">
            ⚠ This sounds like an emergency. Please call your local emergency number or go to the nearest hospital now — do not wait for an appointment.
          </div>
        )}

        {form && (
          <>
            <div className="status-line">
              <span className={result.can_save ? "pill ok" : "pill bad"}>
                {result.can_save ? "Validation passed" : "Validation: missing required info"}
              </span>
              {result.mode === "fallback" && <span className="pill warn">Fallback extractor (no AI key set)</span>}
            </div>

            {FIELDS.map((f) => (
              <label key={f.key} className={missing(f.key) ? "field missing" : "field"}>
                <span>
                  {f.label}
                  {f.required && " *"}
                  {missing(f.key) && <em> — not provided</em>}
                </span>
                <input
                  type={f.type || "text"}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value || null })}
                />
              </label>
            ))}

            <div className="row two">
              <label className="field">
                <span>Department</span>
                <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Urgency</span>
                <select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
                  {URGENCIES.map((u) => <option key={u}>{u}</option>)}
                </select>
              </label>
            </div>

            {result.warnings.map((w, i) => <div key={i} className="alert warn">{w}</div>)}
            {result.errors.map((w, i) => <div key={i} className="alert error">{w}</div>)}

            <button className="primary wide" onClick={confirm} disabled={!canConfirm || loading}>
              {loading ? "Saving…" : "Confirm & Save appointment"}
            </button>
            <p className="muted small">Nothing is saved until you click confirm. You can edit any field above.</p>
          </>
        )}

        {saved && (
          <div className="alert success">
            <strong>✓ Saved to database — Request #{saved.id}</strong>
            <ul>
              <li>{saved.patient_name} · {saved.department}</li>
              <li>{saved.preferred_date || "date to be arranged"} {saved.preferred_time || ""}</li>
              <li>Urgency: {saved.urgency} · Status: {saved.status}</li>
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
