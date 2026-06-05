import { env } from "./env";

/**
 * Contractor lead-notification email via the Resend REST API (no SDK
 * dependency). No-ops gracefully when RESEND_API_KEY is unset.
 *
 * Set LEAD_FROM_EMAIL to a verified sender on your Resend domain.
 */
const FROM = process.env.LEAD_FROM_EMAIL || "Lawn Quotes <leads@example.com>";

export interface LeadEmailData {
  to: string;
  businessName: string;
  contact: { name?: string | null; email?: string | null; phone?: string | null };
  quoteDisplay: string;
  address?: string | null;
  smsConsent: boolean;
}

export async function sendLeadNotification(
  data: LeadEmailData,
): Promise<{ sent: boolean }> {
  if (!env.resendKey || !data.to) return { sent: false };

  const lines = [
    `New lead for ${data.businessName}`,
    ``,
    `Estimate: ${data.quoteDisplay}`,
    data.address ? `Address: ${data.address}` : "",
    data.contact.name ? `Name: ${data.contact.name}` : "",
    data.contact.email ? `Email: ${data.contact.email}` : "",
    data.contact.phone ? `Phone: ${data.contact.phone}` : "",
    data.contact.phone ? `SMS consent: ${data.smsConsent ? "yes" : "no"}` : "",
  ].filter(Boolean);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [data.to],
        subject: `New lawn-care lead — ${data.quoteDisplay}`,
        text: lines.join("\n"),
      }),
    });
    return { sent: res.ok };
  } catch {
    return { sent: false };
  }
}
