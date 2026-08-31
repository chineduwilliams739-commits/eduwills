const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function randomChars(length: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => ALPHABET[byte % ALPHABET.length]).join('');
  }
  return Array.from({ length }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
}

/** Stable, non-sensitive public identifier used in account links and local recovery. */
export function createPublicId(): string {
  return `EW${randomChars(10)}`;
}

export function usernameFromEmail(email: unknown): string {
  const local = String(email || '').trim().toLowerCase().split('@')[0] || 'learner';
  const cleaned = local.replace(/[^a-z0-9._-]/g, '').slice(0, 24);
  return cleaned.length >= 3 ? cleaned : `learner_${randomChars(6).toLowerCase()}`;
}

export function accountLink(publicId: string): string {
  return `${window.location.origin}/eduwills/dashboard/?u=${encodeURIComponent(publicId)}`;
}
