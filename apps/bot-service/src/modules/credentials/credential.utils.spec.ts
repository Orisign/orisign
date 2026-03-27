import { generateBotId, generateSecretKey, hashSecret, verifySecret } from './credential.utils';

describe('credential utils', () => {
  it('generates bot ids with expected prefix', () => {
    expect(generateBotId()).toMatch(/^bot_[a-f0-9]{16}$/);
  });

  it('hashes and verifies secret keys', () => {
    const secret = generateSecretKey();
    const digest = hashSecret(secret);

    expect(verifySecret(secret, digest)).toBe(true);
    expect(verifySecret(`${secret}_wrong`, digest)).toBe(false);
  });
});
