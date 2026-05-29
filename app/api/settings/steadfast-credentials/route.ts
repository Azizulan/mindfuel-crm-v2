import { handleApi, err } from '@/app/lib/api-helper';
import { saveSteadfastCredentials, getSteadfastCredentials } from '@/app/lib/steadfast';
import { maskSecret } from '@/app/lib/crypto';

export const dynamic = 'force-dynamic';

// GET — status only. NEVER returns the actual secret to the client.
export async function GET() {
  return handleApi(async () => {
    const creds = await getSteadfastCredentials();
    if (!creds) return { configured: false, apiKeyPreview: '', secretKeyPreview: '' };
    return {
      configured: true,
      apiKeyPreview: maskSecret(creds.apiKey),
      secretKeyPreview: maskSecret(creds.secretKey),
    };
  });
}

// POST — save credentials (encrypted server-side).
export async function POST(req: Request) {
  return handleApi(async () => {
    const { apiKey, secretKey } = await req.json();
    if (!apiKey || !secretKey) return err('Both API key and secret key are required.');
    await saveSteadfastCredentials(String(apiKey).trim(), String(secretKey).trim());
    return { configured: true, message: 'Credentials saved securely.' };
  });
}
