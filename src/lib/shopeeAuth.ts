import { createHash } from 'node:crypto';

export function computeShopeeSignature(
  appId: string,
  timestamp: number,
  payloadStr: string,
  appSecret: string
): string {
  const factor = `${appId}${timestamp}${payloadStr}${appSecret}`;
  return createHash('sha256').update(factor, 'utf8').digest('hex');
}
