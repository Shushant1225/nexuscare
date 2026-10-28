// server.js - Express API
import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { extractWithAI } from "./ai.js";
import { validateExtraction, validateForSave, STATUSES } from "./validate.js";
import { createAppointment, listAppointments, updateStatus, getAppointment } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const EMERGENCY = /chest pain|can'?t breathe|cannot breathe|difficulty breathing|severe bleeding|unconscious|stroke|heart attack|सीने में दर्द|साँस|ਛਾਤੀ ਵਿੱਚ ਦਰਦ/i;

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// 1) Extract: text -> AI -> schema -> validation -> PREVIEW (nothing is saved here)
app.post("/api/extract", async (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (text.length < 5) {
    return res.status(400).json({ error: "Please provide a longer message (at least a few words)." });
  }
  if (text.length > 2000) {
    return res.status(400).json({ error: "Message is too long (max 2000 characters)." });
  }
  try {
    const { raw, mode } = await extractWithAI(text);
    const v = validateExtraction(raw);
    res.json({
      preview: v.data,
      missing_fields: v.missing_fields ?? [],
      errors: v.errors,
      warnings: v.warnings,
      can_save: v.ok,
      emergency: EMERGENCY.test(text),
      mode,
    });
  } catch (err) {
    console.error("extract error:", err.message);
    res.status(502).json({ error: `The AI could not process this message. Reason: ${err.message}` });
  }
});

// 2) Save (CREATE): only after the user confirmed the preview
app.post("/api/appointments", (req, res) => {
  const v = validateForSave(req.body?.appointment);
  if (!v.ok) return res.status(422).json({ error: "Validation failed", details: v.errors });
  if (req.body?.confirmed !== true) {
    return res.status(400).json({ error: "User confirmation is required before saving." });
  }
  const saved = createAppointment({ ...v.data, source_text: req.body?.source_text ?? null });
  res.status(201).json({ appointment: saved });
});

// 3) List
app.get("/api/appointments", (_req, res) => res.json({ appointments: listAppointments() }));

// 4) Update status (UPDATE)
app.patch("/api/appointments/:id/status", (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body ?? {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: `Status must be one of: ${STATUSES.join(", ")}` });
  if (!getAppointment(id)) return res.status(404).json({ error: "Appointment not found" });
  res.json({ appointment: updateStatus(id, status) });
});

// Optional: serve the built React app from this server (one URL for everything).
// Build the frontend first (npm run build in /frontend) so ../frontend/dist exists.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../frontend/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log(`NexusCare API running on port ${PORT}`));