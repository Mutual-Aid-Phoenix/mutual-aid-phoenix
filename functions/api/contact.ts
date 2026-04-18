// Contact-form backend. Validates the submission, verifies the
// Turnstile token server-side, and emails the feedback to the
// recipient configured via Cloudflare Pages env vars.
//
// Env bindings (set via `pnpm wrangler pages secret put ...`):
//   - TURNSTILE_SECRET          — paired with the public site key used
//                                 in src/pages/[locale]/contact.astro.
//   - RESEND_API_KEY            — https://resend.com/api-keys
//   - CONTACT_RECIPIENT_EMAIL   — where to deliver feedback. With the
//                                 Resend sandbox sender this must be
//                                 the account-owner email; fan-out to
//                                 other inboxes via a Gmail forward rule.

type Env = {
  TURNSTILE_SECRET: string;
  RESEND_API_KEY: string;
  CONTACT_RECIPIENT_EMAIL: string;
};

type PagesContext = {
  request: Request;
  env: Env;
};

// Resend's shared-sandbox sender. Works without custom-domain DNS,
// which is fine for v1. Swap to a verified domain address once we
// have one (post-launch).
const FROM_ADDRESS = "Mutual Aid Phoenix <onboarding@resend.dev>";

const MAX_FIELD = {
  name: 120,
  email: 200,
  feedback: 5000,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function verifyTurnstile(token: string, secret: string, ip: string) {
  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

function clip(v: FormDataEntryValue | null, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export const onRequestPost = async ({
  request,
  env,
}: PagesContext): Promise<Response> => {
  if (
    !env.TURNSTILE_SECRET ||
    !env.RESEND_API_KEY ||
    !env.CONTACT_RECIPIENT_EMAIL
  ) {
    return json({ error: "server_misconfigured" }, 500);
  }
  const recipient = env.CONTACT_RECIPIENT_EMAIL;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const name = clip(form.get("name"), MAX_FIELD.name);
  const email = clip(form.get("email"), MAX_FIELD.email);
  const feedback = clip(form.get("feedback"), MAX_FIELD.feedback);
  const token = clip(form.get("cf-turnstile-response"), 4096);

  if (!feedback) {
    return json({ error: "feedback_required" }, 400);
  }
  if (!token) {
    return json({ error: "turnstile_required" }, 400);
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  const ok = await verifyTurnstile(token, env.TURNSTILE_SECRET, ip);
  if (!ok) {
    return json({ error: "turnstile_failed" }, 400);
  }

  const submittedAt = new Date().toISOString();
  const body = [
    `New contact-form submission`,
    ``,
    `From:       ${name || "(anonymous)"}`,
    `Reply to:   ${email || "(not provided)"}`,
    `Submitted:  ${submittedAt}`,
    ``,
    `---`,
    ``,
    feedback,
  ].join("\n");

  const payload: Record<string, unknown> = {
    from: FROM_ADDRESS,
    to: [recipient],
    subject: "Mutual Aid Phoenix — contact form submission",
    text: body,
  };
  if (email) payload.reply_to = email;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resendRes.ok) {
    const detail = await resendRes.text().catch(() => "");
    console.error("[contact] resend failed", resendRes.status, detail);
    return json({ error: "send_failed" }, 502);
  }

  return json({ ok: true });
};
