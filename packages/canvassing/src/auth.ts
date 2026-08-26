import { randomBytes, randomInt, randomUUID, createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import argon2 from "argon2";

export type UserRole = "candidate" | "volunteer";

export type AuthenticatedUser = {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  role: UserRole;
};

const SESSION_DAYS = 30;

export function ensureAuthSchema(db: DatabaseSync) {
  const migrated = new Set(
    (
      db.prepare("SELECT version FROM schema_migrations").all() as Array<{
        version: number;
      }>
    ).map((row) => row.version),
  );
  if (migrated.has(13)) return;
  db.exec(`BEGIN;
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('candidate','volunteer')),
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
    CREATE INDEX sessions_user ON sessions(user_id);
    CREATE INDEX sessions_expires ON sessions(expires_at);
    INSERT INTO schema_migrations VALUES
      (13,'authenticated_canvassing_users_and_sessions',datetime('now'));
    COMMIT;`);
}

export function ensureUserProfileSchema(db: DatabaseSync) {
  const migrated = new Set(
    (
      db.prepare("SELECT version FROM schema_migrations").all() as Array<{
        version: number;
      }>
    ).map((row) => row.version),
  );
  if (migrated.has(16)) return;
  db.exec(`BEGIN;
    ALTER TABLE users ADD COLUMN email TEXT;
    ALTER TABLE users ADD COLUMN updated_at TEXT;
    UPDATE users SET updated_at=created_at WHERE updated_at IS NULL;
    INSERT INTO schema_migrations VALUES
      (16,'user_profile_fields_for_administration',datetime('now'));
    COMMIT;`);
}

export function normalizeUsername(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function validatePassword(password: string) {
  if (password.length < 10)
    throw new Error("Password must contain at least 10 characters");
  if (password.length > 256)
    throw new Error("Password must contain at most 256 characters");
}

export function validateUserEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Email address is invalid");
  return email;
}

export function validateChosenPassword(password: string) {
  if (password.length < 14)
    throw new Error("Password must contain at least 14 characters");
  if (password.length > 256)
    throw new Error("Password must contain at most 256 characters");
}

const temporaryPasswordAlphabet =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTemporaryPassword() {
  const groups = Array.from({ length: 4 }, () =>
    Array.from({ length: 5 }, () =>
      temporaryPasswordAlphabet[randomInt(temporaryPasswordAlphabet.length)],
    ).join(""),
  );
  return groups.join("-");
}

export async function hashPassword(password: string) {
  validatePassword(password);
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(password: string, passwordHash: string) {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now = new Date()) {
  return new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString();
}

export function userFromRow(row: any): AuthenticatedUser {
  return {
    id: String(row.id),
    username: String(row.username),
    display_name: String(row.display_name),
    email: row.email == null ? null : String(row.email),
    role: row.role === "volunteer" ? "volunteer" : "candidate",
  };
}

export function findUserByUsername(db: DatabaseSync, username: string) {
  const row = db
    .prepare("SELECT * FROM users WHERE username=?")
    .get(normalizeUsername(username));
  return row ? userFromRow(row) : null;
}

export async function createUser(
  db: DatabaseSync,
  input: {
    username: string;
    display_name: string;
    role: UserRole;
    password: string;
    email?: string | null;
  },
) {
  const username = normalizeUsername(input.username);
  if (!/^[a-z][a-z0-9._-]{1,63}$/.test(username))
    throw new Error(
      "Username must start with a letter and contain only letters, numbers, dot, underscore, or hyphen",
    );
  if (!input.display_name.trim()) throw new Error("Display name is required");
  if (input.role !== "candidate" && input.role !== "volunteer")
    throw new Error("Role must be candidate or volunteer");
  const email = validateUserEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const id = username;
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO users (id,username,display_name,email,password_hash,role,active,created_at,updated_at,last_login_at) VALUES (?,?,?,?,?,?,1,?,?,NULL)",
  ).run(
    id,
    username,
    input.display_name.trim(),
    email,
    passwordHash,
    input.role,
    createdAt,
    createdAt,
  );
  return {
    id,
    username,
    display_name: input.display_name.trim(),
    email,
    role: input.role,
  };
}

export async function setUserPasswordById(
  db: DatabaseSync,
  userId: string,
  password: string,
  preserveSessionTokenHash?: string,
) {
  const passwordHash = await hashPassword(password);
  const updatedAt = new Date().toISOString();
  const result = db
    .prepare("UPDATE users SET password_hash=?,updated_at=? WHERE id=?")
    .run(passwordHash, updatedAt, userId);
  if (!result.changes) throw new Error("User not found");
  if (preserveSessionTokenHash)
    db.prepare("DELETE FROM sessions WHERE user_id=? AND token_hash!=?").run(
      userId,
      preserveSessionTokenHash,
    );
  else db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
}

export async function setUserPassword(
  db: DatabaseSync,
  username: string,
  password: string,
) {
  const row = db
    .prepare("SELECT id FROM users WHERE username=?")
    .get(normalizeUsername(username)) as { id: string } | undefined;
  if (!row) throw new Error("User not found");
  await setUserPasswordById(db, row.id, password);
}

export function createSession(db: DatabaseSync, userId: string, now = new Date()) {
  const token = newSessionToken();
  const createdAt = now.toISOString();
  db.prepare(
    "INSERT INTO sessions (id,token_hash,user_id,created_at,expires_at,last_seen_at) VALUES (?,?,?,?,?,?)",
  ).run(
    randomUUID(),
    hashSessionToken(token),
    userId,
    createdAt,
    sessionExpiry(now),
    createdAt,
  );
  return token;
}

export function deleteSession(db: DatabaseSync, token: string) {
  db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hashSessionToken(token));
}

export function findSessionUser(db: DatabaseSync, token: string, now = new Date()) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token_hash=? AND s.expires_at>? AND u.active=1`,
    )
    .get(hashSessionToken(token), now.toISOString());
  if (!row) return null;
  db.prepare("UPDATE sessions SET last_seen_at=? WHERE token_hash=?").run(
    now.toISOString(),
    hashSessionToken(token),
  );
  return userFromRow(row);
}

export function parseCookies(header: string | undefined) {
  const values = new Map<string, string>();
  for (const part of String(header ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (!name) continue;
    values.set(name, decodeURIComponent(part.slice(separator + 1).trim()));
  }
  return values;
}
