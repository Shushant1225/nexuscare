// If frontend and backend are deployed on different URLs, set VITE_API_URL
// (e.g. https://your-backend-url) before building. Otherwise it uses same-origin /api.
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function request(path, options) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.details ? ` (${data.details.join(" ")})` : "";
    throw new Error((data.error || "Request failed") + detail);
  }
  return data;
}

export const extractAppointment = (text) =>
  request("/api/extract", { method: "POST", body: JSON.stringify({ text }) });

export const saveAppointment = (appointment, source_text) =>
  request("/api/appointments", {
    method: "POST",
    body: JSON.stringify({ appointment, source_text, confirmed: true }),
  });

export const listAppointments = () => request("/api/appointments");

export const updateStatus = (id, status) =>
  request(`/api/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
