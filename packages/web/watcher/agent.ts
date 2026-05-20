#!/usr/bin/env bun
/**
 * BuildingMind — CSV Watcher Agent
 *
 * Monitors a folder for new bank statement CSV files and automatically
 * imports them via the /api/import/movimentos endpoint.
 *
 * Usage:
 *   bun run packages/web/watcher/agent.ts [--folder ./watch_folder] [--api http://localhost:4200]
 *
 * Environment variables (override defaults):
 *   BM_WATCH_FOLDER   — folder to watch (default: ./watch_folder)
 *   BM_API_URL        — API base URL (default: http://localhost:4200)
 *   BM_EMAIL          — admin email (default: admin@buildingmind.pt)
 *   BM_PASSWORD       — admin password (default: Admin2026!)
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// ─── Config ───────────────────────────────────────────────────────────────────
const { values: args } = parseArgs({
  options: {
    folder: { type: "string", short: "f" },
    api:    { type: "string", short: "a" },
    help:   { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

if (args.help) {
  console.log(`
BuildingMind CSV Watcher Agent

Usage: bun run packages/web/watcher/agent.ts [options]

Options:
  -f, --folder <path>   Folder to watch (default: ./watch_folder)
  -a, --api <url>       API base URL (default: http://localhost:4200)
  -h, --help            Show this help
  
Environment variables:
  BM_WATCH_FOLDER, BM_API_URL, BM_EMAIL, BM_PASSWORD
`);
  process.exit(0);
}

const WATCH_FOLDER = args.folder
  ?? process.env.BM_WATCH_FOLDER
  ?? path.join(process.cwd(), "watch_folder");

const API_URL = args.api
  ?? process.env.BM_API_URL
  ?? "http://localhost:4200";

const EMAIL    = process.env.BM_EMAIL    ?? "admin@buildingmind.pt";
const PASSWORD = process.env.BM_PASSWORD ?? "Admin2026!";

// ─── Auth ─────────────────────────────────────────────────────────────────────
let authToken: string | null = null;

async function getToken(): Promise<string> {
  if (authToken) return authToken;

  const res = await fetch(`${API_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed (${res.status}): ${text}`);
  }

  // Better Auth returns token in header or body
  const headerToken = res.headers.get("set-auth-token");
  if (headerToken) {
    authToken = headerToken;
    return authToken;
  }

  const data = await res.json() as any;
  authToken = data.token ?? data.session?.token ?? null;
  if (!authToken) throw new Error("No token in auth response");
  return authToken;
}

// ─── Import ───────────────────────────────────────────────────────────────────
async function importCSV(filePath: string): Promise<void> {
  const filename = path.basename(filePath);
  log(`📄 Detected: ${filename}`);

  const token = await getToken();
  const fileData = fs.readFileSync(filePath);
  const blob = new Blob([fileData], { type: "text/csv" });
  const form = new FormData();
  form.append("file", blob, filename);

  const res = await fetch(`${API_URL}/api/import/movimentos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    log(`❌ Import failed (${res.status}): ${text}`);
    return;
  }

  const data = await res.json() as any;

  if (data.alreadyImported) {
    log(`⏭️  Already imported: ${filename}`);
    return;
  }

  log(
    `✅ Imported ${filename}: ` +
    `${data.totalRows} rows — ` +
    `quotas: +${data.quotasCreated ?? 0} created / ${data.quotasUpdated ?? 0} updated — ` +
    `despesas: +${data.despesasCreated ?? 0} created / ${data.despesasSkipped ?? 0} skipped` +
    (data.errors?.length ? ` — ${data.errors.length} warnings` : "")
  );

  if (data.errors?.length) {
    for (const e of data.errors.slice(0, 10)) log(`   ⚠️  ${e}`);
    if (data.errors.length > 10) log(`   … and ${data.errors.length - 10} more`);
  }

  // Move processed file to processed/ subfolder
  const processedDir = path.join(WATCH_FOLDER, "processed");
  fs.mkdirSync(processedDir, { recursive: true });
  const dest = path.join(processedDir, `${Date.now()}_${filename}`);
  fs.renameSync(filePath, dest);
  log(`📁 Moved to: processed/${path.basename(dest)}`);
}

// ─── Watcher ──────────────────────────────────────────────────────────────────
function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

async function startWatcher() {
  fs.mkdirSync(WATCH_FOLDER, { recursive: true });

  log(`🚀 BuildingMind CSV Watcher started`);
  log(`📂 Watching: ${WATCH_FOLDER}`);
  log(`🌐 API: ${API_URL}`);

  // Process any existing CSV files first
  const existing = fs.readdirSync(WATCH_FOLDER)
    .filter(f => f.toLowerCase().endsWith(".csv"))
    .map(f => path.join(WATCH_FOLDER, f));

  if (existing.length > 0) {
    log(`🔍 Found ${existing.length} existing CSV(s) to process`);
    for (const f of existing) {
      try { await importCSV(f); }
      catch (e: any) { log(`❌ Error processing ${f}: ${e.message}`); }
    }
  }

  // Watch for new files
  const watcher = fs.watch(WATCH_FOLDER, { persistent: true }, async (event, filename) => {
    if (!filename || !filename.toLowerCase().endsWith(".csv")) return;
    const filePath = path.join(WATCH_FOLDER, filename);

    // Small delay to ensure file is fully written
    await new Promise(r => setTimeout(r, 500));

    if (!fs.existsSync(filePath)) return; // already moved or deleted
    try {
      await importCSV(filePath);
    } catch (e: any) {
      log(`❌ Error processing ${filename}: ${e.message}`);
    }
  });

  watcher.on("error", (err) => log(`❌ Watcher error: ${err.message}`));

  log("👀 Waiting for CSV files… (Ctrl+C to stop)");

  // Keep alive
  process.on("SIGINT",  () => { watcher.close(); log("👋 Watcher stopped"); process.exit(0); });
  process.on("SIGTERM", () => { watcher.close(); log("👋 Watcher stopped"); process.exit(0); });
}

startWatcher().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
