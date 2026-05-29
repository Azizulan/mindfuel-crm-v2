import { handleApi, err } from '@/app/lib/api-helper';
import { getSteadfastCredentials, packzyFetch } from '@/app/lib/steadfast';

export const dynamic = 'force-dynamic';

// Server-side proxy for Steadfast tracking (Tier 7.28). Keys stay on the server.
// POST { idType: 'consignment_id'|'invoice'|'tracking_code', idValue }
export async function POST(req: Request) {
  return handleApi(async () => {
    const creds = await getSteadfastCredentials();
    if (!creds) return err('Steadfast credentials are not configured. Add them in Settings.', 400);

    const { idType, idValue } = await req.json();
    const endpointMap: Record<string, string> = {
      consignment_id: `/status_by_cid/${idValue}`,
      invoice:        `/status_by_invoice/${idValue}`,
      tracking_code:  `/status_by_trackingcode/${idValue}`,
    };
    const endpoint = endpointMap[idType];
    if (!endpoint) return err('Invalid tracking ID type.');

    const resp = await packzyFetch(endpoint, { method: 'GET', creds });
    const data = await resp.json();
    if (!resp.ok) return err(data.message || `Tracking failed (HTTP ${resp.status})`, resp.status);
    return data;
  });
}
