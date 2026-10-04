# AI60 Growth Engine — Turn One Registration Into a Viral Growth Loop

[![NxtWave Challenge](https://img.shields.io/badge/NxtWave-Growth%20Intern%20Challenge-blue.svg)](https://nxtwave.tech)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-v18%2B-brightgreen.svg)](https://nodejs.org)
[![Database](https://img.shields.io/badge/Database-SQLite%20(Pure%20JS)-orange.svg)](https://sql.js.org)

> **Submission for NxtWave Growth Intern Challenge**  
> **Challenge Goal:** Acquire **500 final-year engineering students** to register for *"Build Your First AI Project in 60 Minutes"* in **7 days** with a **₹2,000 budget**.

---

## 🎯 Executive Summary

Acquiring 500 engineering students on a ₹2,000 budget is impossible via traditional paid ads (which would demand a CAC under ₹4 in a market where tech ad CAC exceeds ₹50).  

The **AI60 Growth Engine** solves this by turning every registered student into an active acquisition node through **incentivized peer referral loops**, **campus club partnerships**, and **departmental WhatsApp distribution**, backed by a full-stack **Growth Operating System**.

---

## 🏗️ System Architecture

```mermaid
graph TD
    A[Public Traffic: WhatsApp Groups, Campus Clubs, Social] --> B[AI60 Conversion Landing Page]
    B --> C["Is This For Me?" 1-Min Qualification Quiz]
    C --> D[Frictionless Registration: 6 Essential Fields]
    D --> E[Unique Referral Code & Personal Link Generated]
    E --> F[1-Click WhatsApp Share: Pre-filled Viral Invite]
    F --> A
    
    D --> G[Student Hub & Referral Dashboard]
    G --> H[Milestone Rewards Unlock: 1, 3, 5, 10 Referrals]
    G --> I[AI Workshop Assistant & Project Idea Generator]
    
    D --> J[Live Workshop Studio & Interactive 60-Min Checklist]
    J --> K[Automated 7-Point AI Project Rubric Evaluation]
    K --> L[Verified Builder Badge & Post-Workshop LinkedIn Share]
    L --> A
    
    M[Growth OS Admin Console] --> N[Target 500 Monitor: 426 Regs Tracked]
    M --> O[Acquisition Funnel & Channel ROI Attribution]
    M --> P[Interactive 500-Target Campaign Simulator]
    M --> Q[Multichannel Broadcast Center & A/B Testing Lab]
```

---

## ✨ Core Working Assets

### 1. High-Converting Landing Page (`/#landing`)
* **Time-Boxed Value Proposition:** *"Build Your First AI Project in 60 Minutes"*.
* **Interactive 5-Step Pipeline Visual:** Idea → Build → Connect → Test → Demo (No generic stock photos).
* **Live Scarcity Meter:** Real-time counter showing **426 / 500 Spots Reserved (85.2%)**, with only 74 seats remaining.
* **Campus Social Proof:** 30+ engineering colleges actively participating.

### 2. "Is This For Me?" Qualification Quiz (`/#quiz`)
* 5 interactive multiple-choice questions assessing AI exposure, branch, and goals.
* Calculates dynamic **Workshop Match Score (e.g., 94% Match)** to dissolve student self-doubt before registration.

### 3. Student Hub & Viral Referral Console (`/#student`)
* Personalized referral link (`?ref=CODE`) and 1-click WhatsApp share button.
* **Milestone Unlock Progress:**
  * 1 Referral: AI Prompt Engineering Cheat Sheet.
  * 3 Referrals: 5 Tested GitHub Starter Repositories.
  * 5 Referrals: Priority 1-on-1 Code Review by Mentors.
  * 10 Referrals: Campus Growth Ambassador Hall of Fame.
* **Campus & Global Leaderboards:** Rank, verified signups, and badges.
* **AI Workshop Assistant:** Grounded chat assistant answering questions with approved workshop knowledge.
* **AI Project Idea Generator:** Custom 60-minute MVP blueprints for student branches.

### 4. Interactive Live Workshop Studio (`/#workshop`)
* Simulated live video stream stage with attendee counter (384 concurrent).
* Checkable 60-minute milestone checklist tracking attendance in the database.
* Live student Q&A feed simulation.

### 5. Automated AI Project Evaluation Rubric (`/#submit`)
* Evaluates submitted projects across **7 dimensions**: Problem Clarity, AI Integration, Functionality, UX Design, Originality, Technical Implementation, and Completeness.
* Generates verifiable digital builder badges with 1-click LinkedIn/WhatsApp share triggers to fuel post-workshop growth loops.

### 6. Admin Growth Operating System (`/#admin`)
* **Target 500 Monitor:** Tracks velocity toward 500 signups (426 seeded registrations).
* **End-to-End Funnel:** Visitors (4,120) → Quiz (1,840) → Registered (426) → Referrals (149) → Attendees (384).
* **Channel Attribution:** College Clubs (142), WhatsApp (88), Viral Referrals (149), Organic (28), Meta Ads (19).
* **Interactive Campaign Simulator:** Sliders for clubs, WhatsApp groups, viral coefficient, and ₹2,000 budget to project registration probability.
* **AI Growth Copilot:** Diagnostic recommendations citing active metrics.
* **Multichannel Broadcast Center:** WhatsApp message templates with audience filtering.
* **A/B Testing Suite:** Live headline and CTA experiments with statistical confidence tracking.

### 7. 5-Slide Strategy Presentation (`/#strategy`)
* Interactive in-app deck covering Student Friction, Channel Ranking, Mathematical Model, Working Assets, and Human vs AI reflections.

---

## 📊 The 500-Registration Mathematical Model

$$\text{Projected Regs} = \text{Clubs (160)} + \text{WhatsApp (111)} + \text{Referrals (149)} + \text{Organic (50)} + \text{Paid Ads (30)} = \mathbf{500+}$$

* **Budget:** ₹2,000
* **Total Registrations:** 508
* **Blended Cost per Registration:** **₹3.94** (Well under ₹2,000 budget)
* **Viral Coefficient ($K$):** 0.35 (35% of all signups generated by peer referrals)

---

## 🚀 Quick Start Guide

### Prerequisites
* Node.js v18 or higher
* npm

### Installation & Run

1. Clone or navigate to the directory:
   ```bash
   cd scratch/ai60-growth-engine
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Seed the realistic demo database (426 registrations, 149 referrals, 8 ambassadors, 3 experiments):
   ```bash
   npm run seed
   ```

4. Launch the application:
   ```bash
   npm start
   ```

5. Open in your browser:
   * **Public Landing Page:** [http://localhost:3000/](http://localhost:3000/)
   * **Admin Growth OS:** [http://localhost:3000/#admin](http://localhost:3000/#admin)
   * **5-Slide Strategy Deck:** [http://localhost:3000/#strategy](http://localhost:3000/#strategy)

### Demo Credentials
* **Admin Email:** `admin@ai60.demo`
* **Admin Password:** `admin123`

---

## 📁 Repository Structure

```
ai60-growth-engine/
├── data/
│   └── ai60.db              # SQLite pure JS database
├── public/
│   ├── css/
│   │   └── style.css        # Premium dark mode SaaS design system
│   ├── js/
│   │   └── app.js           # Client SPA application logic & router
│   └── index.html           # Single-page web application shell
├── submission/
│   ├── growth-plan.md       # 5-Slide Growth Master Plan
│   ├── ai-learning-notes.md # 3 Detailed AI Reflections (Human vs AI)
│   └── video-script.md      # 3-Minute Video Recording Script
├── database.js              # SQLite schema, tables & indexes
├── seed.js                  # Seed script generating 426 realistic records
├── server.js                # Express API backend & static file server
├── package.json
└── README.md
```

---

## 🧪 Simulation & Safety Compliance
* **No Real Student Contact:** All student profiles, phone numbers, and emails are simulated demo data.
* **Deterministic AI Safety:** When external LLM API credentials are not provided, the system seamlessly operates in `DEMO_AI_MODE=true` using an approved, grounded workshop knowledge base.
* **Safe Messaging:** Simulated WhatsApp queues prevent accidental external API dispatches without explicit production credentials.
