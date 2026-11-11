// Shared by the scripts in this folder: opens the local D1 database from Node.

import { getPlatformProxy } from "wrangler";
import { D1Repository } from "../worker/data/d1-repository.ts";

/**
 * Runs `work` with a repository connected to the local database, then closes the connection.
 *
 * getPlatformProxy() is Wrangler's way to give a plain Node script the same local bindings
 * that `npm run dev` uses, so a script reads and writes the very database the dev server sees.
 */
export async function withLocalRepository(work: (repo: D1Repository) => Promise<void>): Promise<void> {
  const { env, dispose } = await getPlatformProxy<Env>();
  try {
    await work(new D1Repository(env.DB));
  } catch (error) {
    if (error instanceof Error && error.message.includes("no such table")) {
      console.error("The local database has no tables yet. Run `npm run db:migrate` first.");
      process.exitCode = 1;
    } else {
      throw error;
    }
  } finally {
    await dispose();
  }
}
