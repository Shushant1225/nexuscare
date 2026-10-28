// validate.js - validates the AI's structured output against the schema.
// Never invents values: anything missing/invalid becomes null and is reported.

export const DEPARTMENTS = ["General", "Cardiology", "Pediatrics", "Orthopedics", "Other"];
export const URGENCIES = ["routine", "soon", "urgent"];
export const STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled"];

const REQUIRED = ["patient_name", "reason"]; // must be present to save

const todayISO = () => new Date().toISOString().slice(0, 10);

export function validateExtraction(raw) {
  const errors = [];
  const warnings = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, data: null, errors: ["AI output was not a JSON object."], warnings };
  }

  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const data = {
    patient_name: str(raw.patient_name),
    contact: str(raw.contact),
    reason: str(raw.reason),
    preferred_date: str(raw.preferred_date),
    preferred_time: str(raw.preferred_time),
    department: str(raw.department),
    urgency: str(raw.urgency),
  };

  // date format + not in the past
  if (data.preferred_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.preferred_date) || isNaN(Date.parse(data.preferred_date))) {
      warnings.push(`preferred_date "${data.preferred_date}" is not a valid YYYY-MM-DD date; cleared.`);
      data.preferred_date = null;
    } else if (data.preferred_date < todayISO()) {
      warnings.push(`preferred_date ${data.preferred_date} is in the past; cleared.`);
      data.preferred_date = null;
    }
  }

  // contact: at least 7 digits if present
  if (data.contact && data.contact.replace(/\D/g, "").length < 7) {
    warnings.push("Contact does not look like a valid phone number; cleared.");
    data.contact = null;
  }

  // enums
  if (!DEPARTMENTS.includes(data.department)) {
    if (data.department) warnings.push(`Unknown department "${data.department}"; set to Other.`);
    data.department = "Other";
  }
  if (!URGENCIES.includes(data.urgency)) {
    if (data.urgency) warnings.push(`Unknown urgency "${data.urgency}"; set to routine.`);
    data.urgency = "routine";
  }

  const missing_fields = [];
  for (const f of ["patient_name", "contact", "reason", "preferred_date", "preferred_time"]) {
    if (!data[f]) missing_fields.push(f);
  }
  for (const f of REQUIRED) {
    if (!data[f]) errors.push(`Required field "${f}" is missing.`);
  }

  return { ok: errors.length === 0, data, missing_fields, errors, warnings };
}

// Used again on save: the client may have edited the preview, so re-validate.
export function validateForSave(body) {
  const v = validateExtraction(body);
  return v;
}
