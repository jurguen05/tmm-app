# Development Guidelines & Architecture - TMM System

This document establishes the architectural standards, code quality rules, risk mitigation policies, and anti-hallucination protocols for the **TMM System (Trading Management)** project. Both human contributors and AI assistants must strictly adhere to these guidelines.

---

## 1. Clean Architecture & Layer Separation

The project enforces a strict separation of concerns across 4 distinct layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                         │
│  - app/ (Next.js Server Components, Layouts, Pages, Routes)    │
│  - components/ (Interactive Client Components, Modals, Tables) │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                   APPLICATION & BUSINESS LOGIC                  │
│  - lib/positionsParser.ts (ThinkorSwim statement parsing rules) │
│  - lib/mkTosParser.ts (Quotes and technical indicators parser)  │
│  - lib/formatters.ts (Date ISO normalization, currency, math)   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                 INFRASTRUCTURE & DATA ACCESS                    │
│  - lib/supabase.ts (Browser & SSR client configurations)        │
│  - lib/storage.ts (Supabase Storage buckets operations)         │
│  - services/queries.tsx (SQL database queries & mutations)      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                     DOMAIN & TYPES LAYER                        │
│  - types/index.tsx (TypeScript interfaces, entities, contracts) │
└─────────────────────────────────────────────────────────────────┘
```

### Architectural Principles:
1. **Single Responsibility:** 
   * Parsers in `lib/` must be pure functions that transform CSV data without performing network requests or database calls.
   * Storage helpers in `lib/storage.ts` only manage physical files in Supabase Storage.
   * Database queries live in `services/queries.tsx` or dedicated server actions.
2. **Server Components First:** 
   * Default to Server Components (`app/**/page.tsx`) for fast server-side fetching and SSR.
   * Use `'use client'` strictly when client-side interactivity, state (`useState`, `useRef`), or browser events are required.
3. **Strict Typing:** 
   * All domain models (`Transaction`, `Position`, `Strategy`, `Profile`) must be defined in `types/index.tsx`.
   * Never use `any` when a known schema exists.

---

## 2. Anti-Hallucination Protocol (Cláusula Anti-Alucinación)

To prevent phantom fields, incorrect database queries, and fabricated code:

1. **Verify Before Coding:**
   * **Never assume database columns exist.** If a query refers to a column (e.g., `strategy_id` vs `strategy`, `position_status` vs `status`), inspect the schema cache, query the table, or check `types/index.tsx` first.
   * **Inspect Database Triggers:** When tables use triggers (e.g., `assign_transaction_data()`), verify that PL/pgSQL functions reference existing table columns to avoid `42703 (column does not exist)` runtime errors.
2. **Ambiguity Resolution:**
   * If strategy names, ticker formats, or account conventions differ between external CSVs and database tables (e.g., `MACD` vs `MAC`, `TechTrader` vs `Tech Trader`), **STOP and verify or ask the user** rather than silently guessing.
3. **No Phantom Files or Endpoints:**
   * Never fabricate endpoints, environment variables, or bucket names without confirming their existence in `.env.local`, `lib/storage.ts`, or the codebase.

---

## 3. Risk Management & Git Branching Policy (Protección de `main`)

To protect the stability of the production branch (`main`):

1. **Safe vs. Risky Changes:**
   * **Routine Changes:** Minor UI adjustments, styling fixes, or adding unit functions can be committed directly to `main` upon user request.
   * **Risky Changes:**
     - Database schema migrations or column renames.
     - Destructive table operations (`DELETE`, `DROP`).
     - Major architectural refactors touching multiple core modules.
     - Breaking changes to Storage bucket paths or parser structures.
2. **Branching & Forking Requirement for Risky Tasks:**
   * When a requested change is categorized as **risky**, the developer/AI must **propose creating an isolated branch** (e.g., `git checkout -b feature/name` or `refactor/name`) or an experimental fork before touching code.
   * Test the change thoroughly in the isolated branch.
   * Merge into `main` only after verified stability and explicit user confirmation.
3. **Push Confirmation:**
   * Always ask for explicit user confirmation before executing `git push origin main`.
   * Display the destination repository URL and branch to verify it does not push to an unintended fork.

---

## 4. ThinkorSwim CSV Processing & Bucket Protocols

All CSV ingestion must strictly respect the established protocols:

### A. Deduplication & Transactional Safety:
* **Duplicate Detection:** Always query `file_uploads` by `file_name` and `module` before touching Storage or tables. If already present, halt and alert the user.
* **Rollback on DB Failure:** If database row insertion fails after uploading the physical file, delete the created record in `file_uploads` to prevent orphaned locks.

### B. Storage Buckets & Paths:
* **Positions:**
  - Bucket: `'Positions'`
  - Storage path: `${accountId}/${fileName}`
  - Logic: Cleans the previous positions snapshot before inserting the new statement.
* **Transactions:**
  - Bucket: `'Transactions'`
  - Storage path: `Transactions/${accountId}/${fileName}`
  - Logic: Maps each row to `file_upload_id` and foreign key `strategy_id`.
* **MK-TOS:**
  - Bucket: `'Mk-tos'`
  - Storage path: `${accountId}/${fileName}` (Default fallback account: `'GENERAL'`).

### C. Date & Numeric Normalization:
* **Dates:** Use `parsearFechaTOS()` from `lib/formatters.ts`. Always output pure ISO strings (`YYYY-MM-DD`). Never use `new Date()` directly for display to prevent UTC/local timezone shifts.
* **Numbers:** Strip currency signs (`$`), thousand commas, and percent signs; store clean floating-point numbers.

---

## 5. UI/UX Standards

1. **Language:** All user-facing UI elements, labels, table headers, modal messages, and statuses must be in **English** (e.g., *CSVs Upload*, *Summary*, *Strategies Stops*, *Sign Out*).
2. **Quick Upload Modal:**
   * Drag-and-drop zone with auto-detection for Positions, Transactions, and MK-TOS.
   * Strict limit: 1 file per module per upload batch.
   * Immediate duplicate checking upon file drop.
   * **Auto-Close:** Automatically close the modal after 1 second if all files succeed without error.
3. **Sidebar Navigation Hierarchy:**
   * *Summary* at the top linking to the executive dashboard (`/dashboard`).
   * *Strategies Stops* (`/dashboard/strategies-stops`) as the parent node with collapsible tree view.
   * *Transactions*, *Positions*, and *Mk-Tos* indented with a vertical connector line under *Strategies Stops*.
