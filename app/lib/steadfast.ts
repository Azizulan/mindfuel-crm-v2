import { Setting } from './models';
import { encryptSecret, decryptSecret } from './crypto';

// Server-side Steadfast/Packzy credential store (Tier 7.28).
//
// Keys live encrypted in the Settings collection and NEVER leave the server.
// All Packzy API calls are proxied through our own /api/courier/* routes so
// the browser never holds the secret.

const PACKZY_BASE = 'https://portal.packzy.com/api/v1';
const KEY_API = 'steadfast_api_key';
const KEY_SECRET = 'steadfast_secret_key';

export async function saveSteadfastCredentials(apiKey: string, secretKey: string): Promise<void> {
  await Promise.all([
    Setting.updateOne(
      { key: KEY_API },
      { $set: { key: KEY_API, value: encryptSecret(apiKey) } },
      { upsert: true }
    ),
    Setting.updateOne(
      { key: KEY_SECRET },
      { $set: { key: KEY_SECRET, value: encryptSecret(secretKey) } },
      { upsert: true }
    ),
  ]);
}

export async function getSteadfastCredentials(): Promise<{ apiKey: string; secretKey: string } | null> {
  const [k, s] = await Promise.all([
    Setting.findOne({ key: KEY_API }),
    Setting.findOne({ key: KEY_SECRET }),
  ]);
  const apiKey = decryptSecret(k?.value as string);
  const secretKey = decryptSecret(s?.value as string);
  if (!apiKey || !secretKey) return null;
  return { apiKey, secretKey };
}

export function steadfastHeaders(creds: { apiKey: string; secretKey: string }): Record<string, string> {
  return {
    'Api-Key': creds.apiKey,
    'Secret-Key': creds.secretKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

// Thin proxy fetch used by the /api/courier/* routes.
export async function packzyFetch(
  endpoint: string,
  init: RequestInit & { creds: { apiKey: string; secretKey: string } }
): Promise<Response> {
  const { creds, ...rest } = init;
  return fetch(`${PACKZY_BASE}${endpoint}`, {
    ...rest,
    headers: { ...steadfastHeaders(creds), ...(rest.headers || {}) },
  });
}

export { PACKZY_BASE };
