# AI60 Growth Engine

An **acquisition + referral engine** for the free workshop *"Build Your First AI Project in 60 Minutes"*.

**Goal:** get 500 final-year engineering students to register within 7 days using a ₹2,000 (simulated) campaign budget.

> **Honesty note:** No registration counts, CAC, K-factor, show-up rates or scores in this repository are measured results unless they come from the live database. Any figure in the docs is labelled as a *target*, *assumption* or *projection*. Demo/seed data (`npm run seed`) is synthetic and must not be quoted as real performance.

## Core loop

Discover → Landing → Fit quiz → Register → Refer → Friend registers → Workshop → Build → (Evaluate) → Share → New registrations

## What the product does today

* **Landing page** with workshop value proposition, timeline, FAQ and registration modal.
* **5-question quiz** that recommends a project *track* (no fit score).
* **Registration** with UTM / referral-code / ambassador-code capture and automatic referral-code generation.
* **Student dashboard**: registration details, personal referral link, real referral counts (from the DB), WhatsApp share, referral leaderboard.
* **Workshop companion**: 60-minute build checklist (starts unchecked). It is not a live classroom — no live stream, no live Q&A.
* **Project submission**: stores title, description, repo URL, stack. Automated evaluation is *not available yet*; the UI shows "Not evaluated".
* **Growth OS (admin)**: registrations, funnel counts from tracked events, channel breakdown from UTM data, referral registrations, ambassadors, experiments list, registrations table + CSV export, and a **message draft** form (nothing is sent).
* **AI provider abstraction** (`ai/`) kept for later use (Growth Copilot, Message Studio). The AI Hub UI has been removed from navigation.

## Deferred (not implemented yet)

Real Growth Copilot, Message Studio, budget simulator, tracked club links, GitHub-based project evaluation, Build Cards, Postgres, JWT migration, deployment.

## Quick start

```bash
npm install
npm run seed   # optional: synthetic demo data
npm start
```

* App: http://localhost:3000/
* Admin (demo credentials created on first run): `admin@ai60.demo` / `admin123` — change before any real deployment.

## Repository structure

```
├── ai/                  # AI provider abstraction (preserved)
├── data/                # sql.js database file
├── public/              # index.html, css, js (vanilla SPA)
├── submission/          # growth plan, video script, AI notes (targets/assumptions only)
├── database.js          # schema
├── seed.js              # synthetic demo data (not real results)
├── server.js            # Express API + static server
└── package.json
```

## Safety

* Seed data is simulated. No real student contact happens.
* Message sending is disabled: drafts are saved, never delivered.
* With no LLM keys configured, AI endpoints fall back to a safe demo responder; results from it are not presented as real evaluation.
