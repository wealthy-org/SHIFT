import fs from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { neon } from "@neondatabase/serverless";
import { CONFIG } from "./config";
import { pumpChain } from "../chain/bridge";
import { advance, newState } from "./engine";
import type { State } from "./types";

interface Holder {
  state: State;
  rbase: number;
  vbase: number;
}
const G = globalThis as any;
const DIR = process.env.SHIFT_DATA_DIR || path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "state.json.gz");
const LEGACY_FILE = path.join(DIR, "state.json");
const DB = process.env.DATABASE_URL;
const sql = DB ? neon(DB) : null;
// Engine state is one document, so it is stored as one row. Gzipped, because the
// uncompressed JSON is ~1 MB and this is rewritten on a timer.
const SAVE_EVERY_SEC = Math.max(15, Number(process.env.SHIFT_SAVE_SECONDS || 60));

const pack = (s: State) => gzipSync(Buffer.from(JSON.stringify(s))).toString("base64");
const unpack = (b64: string) => JSON.parse(gunzipSync(Buffer.from(b64, "base64")).toString()) as State;

// Runs on every boot, including a fresh one, so the first save has somewhere to go.
async function ensureSchema() {
  if (!sql) return;
  await sql.query("CREATE TABLE IF NOT EXISTS shift_state (id int PRIMARY KEY, state jsonb, updated_at timestamptz NOT NULL DEFAULT now())");
  await sql.query("ALTER TABLE shift_state ADD COLUMN IF NOT EXISTS state_gz text");
  // Older deployments created `state jsonb NOT NULL`; state_gz replaces it.
  await sql.query("ALTER TABLE shift_state ALTER COLUMN state DROP NOT NULL");
}

async function load(): Promise<State | null> {
  try {
    if (sql) {
      const rows = await sql.query("SELECT state, state_gz FROM shift_state WHERE id = 1");
      if (!rows.length) return null;
      return rows[0].state_gz ? unpack(rows[0].state_gz) : ((rows[0].state as State) ?? null);
    }
    if (fs.existsSync(FILE)) return unpack(fs.readFileSync(FILE, "utf8"));
    if (fs.existsSync(LEGACY_FILE)) return JSON.parse(fs.readFileSync(LEGACY_FILE, "utf8"));
    return null;
  } catch (err) {
    console.error("[shift store] load failed, starting fresh:", (err as Error).message);
    return null;
  }
}

let saving = false;
async function save(h: Holder) {
  if (saving) return;
  saving = true;
  try {
    const gz = pack(h.state);
    if (sql) {
      // state_gz replaces the old jsonb column; null it out so it stops costing.
      await sql.query(
        "INSERT INTO shift_state (id, state_gz, state, updated_at) VALUES (1, $1, NULL, now()) ON CONFLICT (id) DO UPDATE SET state_gz = EXCLUDED.state_gz, state = NULL, updated_at = now()",
        [gz],
      );
    } else {
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(FILE + ".tmp", gz);
      fs.renameSync(FILE + ".tmp", FILE);
    }
  } catch (err) {
    console.error("[shift store] save failed:", (err as Error).message);
  } finally {
    saving = false;
  }
}

export const clock = (h: Holder) => h.vbase + (Date.now() - h.rbase) * CONFIG.speed;

async function boot(): Promise<Holder> {
  try {
    await ensureSchema();
  } catch (err) {
    console.error("[shift store] schema setup failed:", (err as Error).message);
  }
  const loaded = process.env.SHIFT_FRESH ? null : await load();
  const now = Date.now();
  const h: Holder = { state: loaded || newState(now), rbase: now, vbase: now };
  advance(h.state, clock(h));
  let n = 0;
  const timer = setInterval(() => {
    try {
      advance(h.state, clock(h));
      pumpChain(h.state);
      if (++n % SAVE_EVERY_SEC === 0) void save(h);
    } catch (err) {
      console.error("[shift engine]", err);
    }
  }, 1000);
  timer.unref?.();
  const bye = () => void save(h);
  process.once("SIGTERM", bye);
  process.once("SIGINT", bye);
  void save(h);
  return h;
}

export const engine = (): Promise<Holder> => (G.__shiftEngine ||= boot());

// Returns state brought up to the present moment.
export async function live() {
  const h = await engine();
  const now = clock(h);
  advance(h.state, now);
  return { s: h.state, now };
}
