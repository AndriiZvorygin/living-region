import { DatabaseSync } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  ensureAuthSchema,
  ensureUserProfileSchema,
  createUser,
  setUserPassword,
  type UserRole,
} from "./auth";

const dbPath = resolve(
  process.env.CANVASS_DB ?? "private/canvassing/owen-sound.sqlite",
);

async function readSecret(prompt: string) {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error("A terminal is required for password entry");
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise<string>((resolveSecret, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolveSecret(value);
    };
    const onData = (chunk: Buffer | string) => {
      const input = String(chunk);
      for (const character of input) {
        if (character === "\u0003") return finish(new Error("Cancelled"));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] ?? "create";
  let positionalUsername: string | undefined;
  for (let index = 1; index < args.length; index++) {
    if (args[index].startsWith("--")) {
      index++;
      continue;
    }
    positionalUsername = args[index];
    break;
  }
  const username = positionalUsername ?? option("--username");
  if (!username) throw new Error("Usage: ... user:create <username> [--role candidate|volunteer]");
  await mkdir(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try {
    const migrations = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
      .get();
    if (!migrations)
      throw new Error("Canvassing database is not initialized; start the server once first");
    ensureAuthSchema(db);
    ensureUserProfileSchema(db);
    const password = await readSecret(
      `${command === "password" ? "New password" : "Password"}: `,
    );
    const confirmation = await readSecret("Confirm password: ");
    if (password !== confirmation) throw new Error("Passwords do not match");
    if (command === "password") {
      await setUserPassword(db, username, password);
      console.log(`Password updated for ${username}`);
      return;
    }
    if (command !== "create") throw new Error("Command must be create or password");
    const role = (option("--role") ?? "volunteer") as UserRole;
    const displayName = option("--display-name") ?? username;
    const user = await createUser(db, {
      username,
      display_name: displayName,
      role,
      password,
    });
    console.log(`Created ${user.username} (${user.role})`);
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
