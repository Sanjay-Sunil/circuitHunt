import { describe, it, expect } from 'vitest';
import { matchOutpost } from './OutpostQRScanner';

describe('matchOutpost', () => {
  const sampleOutposts = [
    {
      key: 'outpost1',
      name: 'Outpost 1',
      slug: '4b6c8f9b-6db5-4b13-9b88-51f6815cf1be',
      prices: { temp_sensor: [25, 30, 35, 20] }
    },
    {
      key: 'outpost2',
      name: 'Outpost 2',
      slug: 'c1f8a846-5b72-4d2a-a0f5-3c1a3ebc4199',
      prices: { ultrasonic_sensor: [35, 40, 45, 50] }
    },
    {
      key: 'outpost3',
      name: 'Outpost 3',
      slug: 'd748f3db-f179-45d2-a7d1-dc7e6b014389',
      prices: { temp_sensor: [25, 35, 20, 30] }
    },
    {
      key: 'outpost4',
      name: 'Outpost 4',
      slug: 'f8a02bd3-e7a9-453a-9284-cd9c8a98075f',
      prices: { capacitor: [5, 20, 10, 15] }
    }
  ];

  it('matches raw UUID slug from Admin QR page correctly', () => {
    const res = matchOutpost('4b6c8f9b-6db5-4b13-9b88-51f6815cf1be', sampleOutposts);
    expect(res).toBeDefined();
    expect(res.name).toBe('Outpost 1');
  });

  it('matches case-insensitively and trimmed', () => {
    const res = matchOutpost('  C1F8A846-5B72-4D2A-A0F5-3C1A3EBC4199 \n', sampleOutposts);
    expect(res).toBeDefined();
    expect(res.name).toBe('Outpost 2');
  });

  it('matches if embedded in URL or prefix', () => {
    const res = matchOutpost('https://circuithunt.app/market?slug=d748f3db-f179-45d2-a7d1-dc7e6b014389', sampleOutposts);
    expect(res).toBeDefined();
    expect(res.name).toBe('Outpost 3');
  });

  it('matches by outpost key or name as fallback', () => {
    const resKey = matchOutpost('outpost4', sampleOutposts);
    expect(resKey).toBeDefined();
    expect(resKey.name).toBe('Outpost 4');

    const resName = matchOutpost('Outpost 1', sampleOutposts);
    expect(resName).toBeDefined();
    expect(resName.slug).toBe('4b6c8f9b-6db5-4b13-9b88-51f6815cf1be');
  });

  it('returns null for invalid QR codes', () => {
    const res = matchOutpost('some-random-unknown-qr-code', sampleOutposts);
    expect(res).toBeNull();
  });
});
