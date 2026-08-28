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
  const configuredUrl = configured("CANVASSING_LOGIN_URL");
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");
  const base = configured("CANVASSING_BASE_URL") || "http://localhost";
  return `${base.replace(/\/+$/, "")}/canvassing/`;
}

export function credentialEmailContent(input: CredentialsEmail) {
  return {
    subject: "Your Andrii for Mayor canvassing login",
    text: `Hi ${input.displayName},

Thanks for helping with the campaign.

Your canvassing-app login is ready:

Canvassing app: ${canvassingLoginUrl()}
Username: ${input.username}
Password: ${input.password}

For neighbourhood flyer delivery, the app shows grey roofs that are available to flyer. You can deliver near your home or use the Next Area recommendation, then mark the homes you reached as flyered.

The full volunteer guide is here:

https://helpos.ca/vol

If you need more flyers or help getting started, reply to this email or come by Thursdays from 5:30–6:30 p.m. at 254 8th Street East.

Thanks,
Andrii Zvorygin
Candidate for Mayor of Owen Sound
andrii@zvorygin.ca
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
