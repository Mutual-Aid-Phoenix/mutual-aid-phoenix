// Step 1 of the Decap CMS → GitHub OAuth dance.
//
// Decap opens this path in a popup when a volunteer clicks "Login with
// GitHub". We redirect them to GitHub's authorize page; GitHub bounces
// back to /api/auth/callback with a short-lived code, which the
// companion function trades for an access token.
//
// The `client_id` must match the one in public/admin/config.yml —
// both halves belong to the same GitHub OAuth App. The `client_secret`
// lives only in Cloudflare Pages (see callback.ts).

const CLIENT_ID = "Ov23lizl0GVxfaKrSxni";

export const onRequestGet = async ({
  request,
}: {
  request: Request;
}): Promise<Response> => {
  const url = new URL(request.url);

  // Decap passes the scope it needs; default to `repo` so editors can
  // commit to private repos too (ours is public, but this keeps the
  // proxy reusable).
  const scope = url.searchParams.get("scope") ?? "repo";

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", CLIENT_ID);
  authorize.searchParams.set("scope", scope);
  authorize.searchParams.set(
    "redirect_uri",
    `${url.origin}/api/auth/callback`,
  );

  return Response.redirect(authorize.toString(), 302);
};
