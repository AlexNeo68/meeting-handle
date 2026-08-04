import { resolveTrustProxyHops } from './trust-proxy.util';

describe('resolveTrustProxyHops', () => {
  it('should default to 0 (trust proxy off) when TRUST_PROXY_HOPS is unset', () => {
    expect(resolveTrustProxyHops({})).toBe(0);
  });

  it('should default to 0 when TRUST_PROXY_HOPS is an empty string', () => {
    expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: '' })).toBe(0);
  });

  it('should return the configured hop count when set explicitly', () => {
    expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: '1' })).toBe(1);
    expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: '2' })).toBe(2);
  });

  it('should fall back to 0 for a non-numeric value', () => {
    expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: 'abc' })).toBe(0);
  });

  it('should fall back to 0 for a negative value', () => {
    expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: '-1' })).toBe(0);
  });
});
