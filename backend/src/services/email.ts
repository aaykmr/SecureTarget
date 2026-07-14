import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

let client: SESClient | null = null;

function getClient(): SESClient | null {
  const region = process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim();
  if (!region) return null;
  if (!client) {
    client = new SESClient({ region });
  }
  return client;
}

export async function sendInviteEmail(input: {
  to: string;
  organizationName: string;
  inviteUrl: string;
}): Promise<{ sent: boolean; error?: string }> {
  const from = process.env.SES_FROM_EMAIL?.trim();
  const ses = getClient();
  if (!from || !ses) {
    return {
      sent: false,
      error: "SES not configured (set SES_FROM_EMAIL and AWS_REGION).",
    };
  }

  try {
    await ses.send(
      new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: [input.to] },
        Message: {
          Subject: { Data: `You're invited to ${input.organizationName} on EventIQN` },
          Body: {
            Text: {
              Data: [
                `You've been invited to join ${input.organizationName} on EventIQN.`,
                ``,
                `Set your password and join:`,
                input.inviteUrl,
                ``,
                `This link expires in 7 days.`,
              ].join("\n"),
            },
            Html: {
              Data: `
                <p>You've been invited to join <strong>${escapeHtml(input.organizationName)}</strong> on EventIQN.</p>
                <p><a href="${escapeHtml(input.inviteUrl)}">Set your password and join</a></p>
                <p>This link expires in 7 days.</p>
              `.trim(),
            },
          },
        },
      }),
    );
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
