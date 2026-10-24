---
last_updated: 2026-10-24T18:00:00Z
---

# Architecture Design

## System Overview
Repro Lite is a browser-side agent. The LLM gateway (existing Supabase function, unchanged) plans, drives the tool loop and audits. Python runs locally in Pyodide Web Workers. Atoms Cloud stores the public `checks` history.

## Tech Stack
Vite + React + TypeScript + shadcn/ui + Tailwind; Pyodide 0.26.4 (jsDelivr) with numpy/pandas/scipy/scikit-learn; Atoms Cloud (FastAPI + Postgres) via @metagptx/web-sdk.

## Module Design
| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| Worker | Loads Pyodide and runs code, capturing stdout/stderr | app/frontend/public/pyodide-worker.js |
| Runner | PySession: init, 60 s timeout (terminates worker), fresh sessions | src/lib/pyRunner.ts |
| LLM client | Gateway POST, visitor id, 429 -> RateLimitError, JSON parsing | src/lib/llm.ts |
| Agent | Plan contract, tool loop (10 turns), clean re-run, audit, verdict rules, Markdown report | src/lib/agent.ts |
| i18n/prefs | EN/中文 dictionary, dark mode | src/lib/i18n.ts |
| History | checks entity create/query/get | src/lib/checksApi.ts |
| UI | Shell, live step timeline, verdict card, pages | src/components/*, src/pages/Index.tsx, CheckDetail.tsx |

## Tech Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Verdict | Deterministic rules in code | err<=tol: reproduced; <=3x tol: partial; else not; re-run diff >1% or no value caps at partial; serious audit flag downgrades one level |
| Final script | Last run_python before finish must print "RESULT: x" | Enables clean re-run comparison |
| History | Public table (create_only=false), no login | Public gallery |

## File Tree Plan
See Module Design.

## Implementation Guide
Routes: `/` (form + live run + gallery), `/check/:id` (saved record).
