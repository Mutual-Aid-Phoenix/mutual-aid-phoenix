// Step 2 of the Decap CMS → GitHub OAuth dance.
//
// GitHub redirects the popup here with a short-lived `code`. We swap
// the code for an access token using the client secret (kept in
// Cloudflare Pages env, never shipped to the client) and hand the
// token back to Decap via window.postMessage. The handshake Decap
// expects is documented in decap-cms-lib-auth/src/externalAuth:
// the popup posts "authorizing:github" to its opener, and on receipt
// of the same string from the opener replies with
// "authorization:github:success:{token, provider}".

interface Env {
  OAUTH_CLIENT_SECRET: string;
}

const CLIENT_ID = "Ov23lizl0GVxfaKrSxni";

export const onRequestGet = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return renderMessage("error", { error: "missing_code" });
  }

  const tokenRes = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "mutual-aid-phoenix-oauth",
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: env.OAUTH_CLIENT_SECRET,
        code,
      }),
    },
  );

  const payload = (await tokenRes.json().catch(() => null)) as
    | { access_token?: string; error?: string; error_description?: string }
    | null;

  if (!payload?.access_token) {
    return renderMessage("error", {
      error: payload?.error ?? "token_exchange_failed",
      description: payload?.error_description,
    });
  }

  return renderMessage("success", {
    token: payload.access_token,
    provider: "github",
  });
};

// Returns an HTML page that completes the Decap handshake via
// postMessage and then closes itself.
function renderMessage(
  kind: "success" | "error",
  data: Record<string, unknown>,
): Response {
  const message = `authorization:github:${kind}:${JSON.stringify(data)}`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Authorizing…</title>
</head>
<body>
<p>Completing GitHub sign-in…</p>
<script>
(function () {
  var message = ${JSON.stringify(message)};
  function onReply(e) {
    if (e.data !== "authorizing:github") return;
    e.source.postMessage(message, e.origin);
    window.removeEventListener("message", onReply);
    setTimeout(function () { window.close(); }, 500);
  }
  window.addEventListener("message", onReply, false);
  if (window.opener) {
    window.opener.postMessage("authorizing:github", "*");
  }
})();
</script>
</body>
</html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
