// Sends transactional email via Resend's HTTP API. See last-man-standing-plan.md
// section 6a — recipient/sender are single config values, not scattered
// through the code, so this stays a one-line change to support more later.
export const REPORT_RECIPIENT_EMAIL = process.env.REPORT_RECIPIENT_EMAIL || "whitfield.tom@gmail.com";

const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, text }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend request failed (${response.status}): ${body}`);
  }
}
