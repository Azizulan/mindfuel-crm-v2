import { handleApi, err } from '@/app/lib/api-helper';
import { getSteadfastCredentials, packzyFetch } from '@/app/lib/steadfast';

export const dynamic = 'force-dynamic';

// Server-side proxy for Steadfast create_order (Tier 7.28).
// POST <OrderPayload> — forwarded verbatim to Packzy with server-held keys.
export async function POST(req: Request) {
  return handleApi(async () => {
    const creds = await getSteadfastCredentials();
    if (!creds) return err('Steadfast credentials are not configured. Add them in Settings.', 400);

    const payload = await req.json();
    const resp = await packzyFetch('/create_order', {
      method: 'POST',
      body: JSON.stringify(payload),
      creds,
    });
    const data = await resp.json();
    if (!resp.ok) {
      let message = data.message || `Order creation failed (HTTP ${resp.status})`;
      if (data.errors) message += ' ' + Object.values(data.errors).flat().join(' ');
      return err(message, resp.status);
    }
    return data;
  });
}
