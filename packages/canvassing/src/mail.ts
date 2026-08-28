import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import nodemailer from "nodemailer";

export type CredentialDelivery = "admin" | "volunteer";

export type CredentialsEmail = {
  displayName: string;
  username: string;
  password: string;
  volunteerEmail: string | null;
  delivery: CredentialDelivery;
};

export type SentEmail = {
  recipient: string;
  subject: string;
};

const configured = (name: string) => String(process.env[name] ?? "").trim();

export function configuredAdminEmail() {
  return configured("CANVASSING_ADMIN_EMAIL") || null;
}

export function configuredReplyToEmail() {
  return configured("CANVASSING_REPLY_TO_EMAIL") || null;
}

export function canvassingLoginUrl() {
  const base = configured("CANVASSING_BASE_URL") || "http://localhost";
  return `${base.replace(/\/+$/, "")}/canvassing/`;
}

export function credentialEmailContent(input: CredentialsEmail) {
  const recipientKind = input.delivery === "admin" ? "campaign administrator" : "volunteer";
  const forwarding =
    input.delivery === "admin"
      ? "You can forward this message privately to the volunteer."
      : "This message contains private login credentials; keep it private.";
  return {
    subject: `Owen Sound canvassing account for ${input.displayName}`,
    text: `A canvassing volunteer account has been created for ${input.displayName}.

Username: ${input.username}
Password: ${input.password}

Login:
${canvassingLoginUrl()}

This message was sent to the ${recipientKind}.
${forwarding}
The generated password is already strong and does not need to be changed. The user may change it later if desired.
${input.volunteerEmail ? `Volunteer email on the account: ${input.volunteerEmail}\n` : ""}
`,
  };
}

let smtpTransport: nodemailer.Transporter | null = null;

function transport() {
  if (smtpTransport) return smtpTransport;
  const host = configured("CANVASSING_SMTP_HOST");
  if (!host) throw new Error("CANVASSING_SMTP_HOST is not configured");
  const port = Number(configured("CANVASSING_SMTP_PORT") || "587");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("CANVASSING_SMTP_PORT is invalid");
  const user = configured("CANVASSING_SMTP_USER");
  const password = process.env.CANVASSING_SMTP_PASSWORD ?? "";
  smtpTransport = nodemailer.createTransport({
    host,
    port,
    secure:
      configured("CANVASSING_SMTP_SECURE") === "true" || port === 465,
    ...(user ? { auth: { user, pass: password } } : {}),
  });
  return smtpTransport;
}

export async function sendCredentialsEmail(
  recipient: string,
  input: CredentialsEmail,
): Promise<SentEmail> {
  const content = credentialEmailContent(input);
  const from = configured("CANVASSING_FROM_EMAIL");
  if (!from) throw new Error("CANVASSING_FROM_EMAIL is not configured");

  // This transport is deliberately opt-in and intended only for tests. It
  // lets integration tests inspect the message without sending real mail.
  if (configured("CANVASSING_TEST_MAIL_FAIL") === "1")
    throw new Error("test mail delivery failure");
  const testFile = configured("CANVASSING_TEST_MAIL_FILE");
  if (testFile) {
    await mkdir(dirname(testFile), { recursive: true });
    const replyTo = configuredReplyToEmail();
    await appendFile(
      testFile,
      JSON.stringify({
        from,
        to: recipient,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...content,
      }) + "\n",
      { mode: 0o600 },
    );
    return { recipient, subject: content.subject };
  }

  await transport().sendMail({
    from,
    to: recipient,
    subject: content.subject,
    text: content.text,
    ...(configuredReplyToEmail()
      ? { replyTo: configuredReplyToEmail()! }
      : {}),
  });
  return { recipient, subject: content.subject };
}
