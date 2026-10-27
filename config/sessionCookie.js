const isProduction = process.env.NODE_ENV === "production";

// Render and the deployed frontend use different sites, so production session
// cookies must allow cross-site requests and be sent over HTTPS.
export const sessionCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
};
