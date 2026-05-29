import { handleApi, err } from '@/app/lib/api-helper';
import { getSteadfastCredentials, packzyFetch } from '@/app/lib/steadfast';

export const dynamic = 'force-dynamic';

// Server-side proxy for Steadfast get_orders (Tier 7.28).
export async function GET() {
  return handleApi(async () => {
    const creds = await getSteadfastCredentials();
    if (!creds) return err('Steadfast credentials are not configured. Add them in Settings.', 400);

    const resp = await packzyFetch('/get_orders', { method: 'GET', creds });
    const data = await resp.json();
    if (!resp.ok) return err(data.message || `Fetch failed (HTTP ${resp.status})`, resp.status);
    return data;
  });
}
