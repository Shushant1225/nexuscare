# NexusCare — Intelligent Care Coordination
CSB312 · Generative AI · CA3 Mini Project 2

Turns a patient/caregiver voice note or text message into a structured appointment request using schema-guided AI, validates it, shows a preview, and saves it to a database only after the user confirms. Staff manage requests on a board.

**Workflow:** User input → AI extraction → schema-guided JSON → validation → backend API → database create/update → frontend confirmation

## Project structure
```
nexuscare/
  backend/   Express API, SQLite database, AI extraction + validation
  frontend/  React (Vite): Patient Intake page + Staff Board
```

## Run locally
```bash
# terminal 1 - backend
cd backend
cp .env.example .env      # add your AI key here (see below)
npm install
npm start                 # http://localhost:5000

# terminal 2 - frontend
cd frontend
npm install
npm run dev               # open the printed URL
```

## AI configuration (backend/.env)
Works with any OpenAI-compatible API:
```
AI_BASE_URL=<provider base url>
AI_API_KEY=<your key>
AI_MODEL=<model name>
```
If `AI_API_KEY` is empty, a simple rule-based fallback runs so the app still works. The UI shows a "Fallback extractor" badge. Use a real key for your demo and screenshots.

## Deploy (ONE URL — easiest)
1. `cd frontend && npm install && npm run build`  (creates `frontend/dist`)
2. `cd ../backend && npm install && npm start`
   The backend serves the built frontend, so the single deployed URL runs frontend + backend + database.
3. Set `AI_*` values as environment variables on the platform.
If the platform needs separate frontend/backend deployments, set `VITE_API_URL=<backend url>` before `npm run build`.

## API
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/extract` | text → AI → validated **preview** (does not save) |
| POST | `/api/appointments` | **CREATE** record (requires `confirmed: true`) |
| GET | `/api/appointments` | list records |
| PATCH | `/api/appointments/:id/status` | **UPDATE** status |

## Schema
```json
{
  "patient_name": "string | null",
  "contact": "string | null",
  "reason": "string | null",
  "preferred_date": "YYYY-MM-DD | null",
  "preferred_time": "string | null",
  "department": "General | Cardiology | Pediatrics | Orthopedics | Other",
  "urgency": "routine | soon | urgent"
}
```
Sample output:
```json
{"patient_name":"Ravi Kumar","contact":"9876543210","reason":"Chest pain since morning","preferred_date":"2026-10-29","preferred_time":"morning","department":"Cardiology","urgency":"urgent"}
```

## Database
Table `appointments`: id, patient_name, contact, reason, preferred_date, preferred_time, department, urgency, status (Pending/Confirmed/Completed/Cancelled), source_text, created_at, updated_at.

## Safeguards
- Preview + explicit confirmation before saving (server rejects saves without `confirmed: true`)
- AI told to return `null` instead of guessing; missing fields highlighted in the UI
- Server re-validates everything on save (the user may have edited the preview)
- Emergency keyword banner; AI does not diagnose or give medical advice
- API key stays on the backend only

## Test cases (for the report)
| # | Input | Expected |
|---|---|---|
| 1 | "I'm Ravi Kumar, number 9876543210, chest pain, need doctor tomorrow morning" | All fields extracted, Cardiology, urgent, emergency banner, save works |
| 2 | "I need an appointment." | Name missing → highlighted, Confirm disabled |
| 3 | "hi" | Rejected: message too short |
| 4 | Backend stopped | Friendly "cannot reach server" error |
| 5 | Past date / bad phone | Warning shown, value cleared |
| 6 | Staff changes status | Row updates, saved in database |

## Known limitations / future work
Voice uses the browser speech API (Chrome/Edge); no login; no SMS/email reminders; single clinic.
