import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { CONFIG } from "./config";
import { advance, newState } from "./engine";
import type { State } from "./types";

interface Holder {
  state: State;
  rbase: number;
  vbase: number;
}
const G = globalThis as any;
const FILE = path.join(process.env.SHIFT_DATA_DIR || path.join(process.cwd(), ".data"), "state.json");
const DB = process.env.DATABASE_URL;
const sql = DB ? neon(DB) : null;

// One JSONB row holds the whole engine state. Without DATABASE_URL it falls back to a local file.
async function load(): Promise<State | null> {
  try {
    if (sql) {
      await sql.query("CREATE TABLE IF NOT EXISTS shift_state (id int PRIMARY KEY, state jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())");
      const rows = await sql.query("SELECT state FROM shift_state WHERE id = 1");
      return rows.length ? (rows[0].state as State) : null;
    }
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
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
    const json = JSON.stringify(h.state);
    if (sql) {
      await sql.query("INSERT INTO shift_state (id, state, updated_at) VALUES (1, $1::jsonb, now()) ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()", [json]);
    } else {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE + ".tmp", json);
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
  const loaded = process.env.SHIFT_FRESH ? null : await load();
  const now = Date.now();
  const h: Holder = { state: loaded || newState(now), rbase: now, vbase: now };
  advance(h.state, clock(h));
  let n = 0;
  const timer = setInterval(() => {
    try {
      advance(h.state, clock(h));
      if (++n % 15 === 0) void save(h);
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
