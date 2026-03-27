import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function generateBotId() {
  return `bot_${randomBytes(8).toString('hex')}`;
}

export function generateBotUserId() {
  return `botusr_${randomBytes(8).toString('hex')}`;
}

export function generateSecretKey() {
  return randomBytes(24).toString('base64url');
}

export function hashSecret(secret: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(secret, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifySecret(secret: string, digest: string) {
  const [salt, originalHash] = digest.split(':');
  if (!salt || !originalHash) {
    return false;
  }

  const hash = scryptSync(secret, salt, 64).toString('hex');
  return timingSafeEqual(Buffer.from(hash, 'utf8'), Buffer.from(originalHash, 'utf8'));
}
