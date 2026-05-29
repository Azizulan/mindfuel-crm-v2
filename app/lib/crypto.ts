import crypto from 'crypto';

// AES-256-GCM encryption for secrets at rest (Tier 7.28).
//
// The encryption key is derived from the CREDENTIALS_SECRET env var. If it's
// not set, we fall back to storing with a "plain:" prefix so the app keeps
// working — but you SHOULD set CREDENTIALS_SECRET in production so the
// Steadfast keys are never readable directly from the database.

const ALGO = 'aes-256-gcm';

function getKey(): Buffer | null {
  const secret = process.env.CREDENTIALS_SECRET;
  if (!secret) return null;
  // Derive a stable 32-byte key from whatever length secret is provided.
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  if (plain == null) return '';
  const key = getKey();
  if (!key) return `plain:${plain}`;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return '';
  if (stored.startsWith('plain:')) return stored.slice(6);
  if (!stored.startsWith('enc:')) return stored; // legacy plaintext value
  const key = getKey();
  if (!key) return ''; // can't decrypt without the key
  try {
    const [, ivb, tagb, datab] = stored.split(':');
    const iv = Buffer.from(ivb, 'base64');
    const tag = Buffer.from(tagb, 'base64');
    const data = Buffer.from(datab, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

// Mask a secret for display: show only the last 4 chars.
export function maskSecret(plain: string): string {
  if (!plain) return '';
  if (plain.length <= 4) return '••••';
  return '••••' + plain.slice(-4);
}
