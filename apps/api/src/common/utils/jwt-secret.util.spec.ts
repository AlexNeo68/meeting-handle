import { resolveJwtSecret } from './jwt-secret.util';

describe('resolveJwtSecret', () => {
  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('should return the secret when it is long enough', () => {
    process.env.JWT_SECRET = 'a'.repeat(40);
    expect(resolveJwtSecret()).toBe('a'.repeat(40));
  });

  it('should throw when JWT_SECRET is missing', () => {
    expect(() => resolveJwtSecret()).toThrow('JWT_SECRET must be set');
  });

  it('should throw when JWT_SECRET is shorter than 32 characters', () => {
    process.env.JWT_SECRET = 'test-secret';
    expect(() => resolveJwtSecret()).toThrow(/at least 32 characters/);
  });
});
