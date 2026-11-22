import { createRemoteJWKSet, jwtVerify } from "jose";
import * as oidc from "openid-client";
import { one, rows } from "./db.mjs";
import { hash } from "./storage.mjs";
import { randomBytes } from "node:crypto";

const issuer = process.env.OIDC_ISSUER,
  clientId = process.env.OIDC_CLIENT_ID,
  secret = process.env.OIDC_CLIENT_SECRET,
  redirect = process.env.OIDC_REDIRECT_URI;
const connections = {
  Apple: process.env.OIDC_APPLE_CONNECTION,
  Google: process.env.OIDC_GOOGLE_CONNECTION,
  Facebook: process.env.OIDC_FACEBOOK_CONNECTION,
};
const brokerProviders =
  issuer && clientId && secret && redirect
    ? Object.keys(connections).filter((p) => connections[p])
    : [];
export const managedAuthURL = process.env.NEON_AUTH_BASE_URL || "";
export const providers = [...new Set([...brokerProviders, ...(managedAuthURL ? ["Google"] : [])])];
const keys = managedAuthURL
  ? createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL || managedAuthURL + "/.well-known/jwks.json"))
  : null;

export async function managedGoogle(token) {
  if (!keys || typeof token !== "string") throw Error("Missing token");
  const { payload } = await jwtVerify(token, keys, {
    issuer: [new URL(managedAuthURL).origin, managedAuthURL],
    requiredClaims: ["sub", "exp", "iat"],
    algorithms: ["EdDSA"],
  });
  const user = await one(
    `SELECT u.email,u.name FROM neon_auth."user" u
     WHERE u.id::text=$1 AND u."emailVerified" AND NOT coalesce(u.banned,false)
     AND EXISTS (SELECT 1 FROM neon_auth.account a WHERE a."userId"=u.id AND a."providerId"='google')`,
    payload.sub
  );
  if (!user) throw Error("Google identity required");
  return appIdentity({ iss: managedAuthURL, sub: payload.sub, email: user.email, name: user.name, email_verified: true });
}

let configuration;
async function config() {
  if (!configuration) configuration = await oidc.discovery(new URL(issuer), clientId, secret);
  return configuration;
}
export async function begin(provider, s) {
  if (!brokerProviders.includes(provider)) throw Error("Provider unavailable");
  const c = await config(),
    state = oidc.randomState(),
    nonce = oidc.randomNonce(),
    verifier = oidc.randomPKCECodeVerifier();
  await rows("DELETE FROM oidc_requests WHERE expires<$1", Date.now());
  await rows(
    "INSERT INTO oidc_requests VALUES($1,$2,$3,$4,$5)",
    state,
    s.token,
    verifier,
    nonce,
    Date.now() + 600000,
  );
  return oidc.buildAuthorizationUrl(c, {
    redirect_uri: redirect,
    scope: "openid email profile",
    connection: connections[provider],
    state,
    nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
  }).href;
}
export async function complete(query, s) {
  if (!brokerProviders.length) throw Error("Provider unavailable");
  const current = new URL(redirect);
  current.search = query;
  const state = current.searchParams.get("state") || "";
  const req = await one(
    "DELETE FROM oidc_requests WHERE state=$1 AND session=$2 AND expires>$3 RETURNING *",
    state,
    s.token,
    Date.now(),
  );
  if (!req) throw Error("Expired sign-in");
  const tokens = await oidc.authorizationCodeGrant(await config(), current, {
    pkceCodeVerifier: req.verifier,
    expectedNonce: req.nonce,
    expectedState: state,
    idTokenExpected: true,
  });
  const claims = tokens.claims();
  return appIdentity(claims);
}
async function appIdentity(claims) {
  if (!claims?.sub) throw Error("Missing identity");
  const identity = await one(
    "SELECT user_id FROM identities WHERE issuer=$1 AND subject=$2",
    claims.iss,
    claims.sub,
  );
  if (identity) return identity.user_id;
  if (claims.email_verified !== true || typeof claims.email !== "string")
    throw Error("Verified email required");
  const email = claims.email.toLowerCase().trim();
  const identityRow = await one(
    `WITH new_user AS (
    INSERT INTO users(email,hash,name) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING RETURNING id
  ) INSERT INTO identities(issuer,subject,user_id) SELECT $4,$5,id FROM new_user RETURNING user_id`,
    email,
    hash(randomBytes(32).toString("hex")),
    String(claims.name || email).slice(0, 120),
    claims.iss,
    claims.sub,
  );
  if (!identityRow) throw Error("Use existing sign-in");
  return identityRow.user_id;
}
