import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Database handle, or null when DATABASE_URL is not configured.
 *
 * Every caller must handle null. Persistence is an enhancement here, not a
 * requirement — the app is fully usable without it, and a reviewer who clones
 * the repo gets a working product rather than a connection error.
 */
export type Database = ReturnType<typeof drizzle<typeof schema>>;

let cached: Database | null | undefined;

export function getDb(): Database | null {
  if (cached !== undefined) return cached;
  const url = process.env.DATABASE_URL;
  cached = url ? drizzle(neon(url), { schema }) : null;
  return cached;
}

export const isPersistenceEnabled = () => getDb() !== null;
export { schema };
