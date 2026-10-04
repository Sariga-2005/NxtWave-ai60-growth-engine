# Architecture Audit

## Current Architecture
- **Framework/Language**: Vanilla Node.js (Express) backend, Vanilla JS (HTML/CSS) frontend (SPA).
- **Package Manager**: NPM
- **Database**: `sql.js` (SQLite in memory/file buffer).
- **Authentication**: JWT/bcrypt based authentication implemented manually.
- **UI/Design System**: Custom CSS in `public/css/style.css`, single page app (`public/index.html` and `public/js/app.js`).
- **Environment**: Loaded via `.env` (not currently using `dotenv` in `server.js` or maybe yes, let's check).
- **AI Integrations**: None live. Currently hardcoded/mocked in `server.js` (`/api/ai/chat`, `/api/quiz/submit` evaluating locally without LLM).

## Reusable Components
- **UI System**: The CSS design system is solid and can be reused. Modals, cards, gradients.
- **Database Layer**: `database.js` has a lot of good setup for SQLite tables.
- **API Routing**: Express setup in `server.js` is functional.

## Technical Debt
- Single large `server.js` file (60KB).
- Single large `app.js` frontend script.
- AI features are currently mocked strings.
- Frontend includes hardcoded strings for competition (e.g. 500 students, ₹2,000 budget, simulated mode).
- No actual LLM logic, fallback, or routing exists.

## Integration Points
- `server.js` API endpoints (e.g., `/api/ai/chat`, `/api/project/evaluate`) need to be wired to the new AI Gateway.
- `.env` needs to be expanded for multi-provider API keys.

## Recommended Changes
- Split AI logic into modular structure (`ai/gateway`, `ai/providers`, `ai/router`, etc.).
- Convert mocked AI routes in `server.js` to call the AI Gateway.
- Implement `zod` for structured output validation.
- Remove challenge-specific wording and fake UI elements in the frontend.
- Implement proper AI rate-limiting, error handling, and demo-mode gracefully.
