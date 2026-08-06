import 'dotenv/config';

export const TEST_JWT_SECRET = 'e2e-test-jwt-secret-at-least-32-characters-long';

export function ensureTestJwtSecret(): void {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  }
}

export function raiseThrottleLimit(): void {
  // e2e specs register/login many times within one app instance; the global
  // throttle (default 5/15min per IP) would 429 them. The password route pins
  // its own limit via @Throttle, so raising the global limit here is safe.
  if (!process.env.THROTTLE_LIMIT) {
    process.env.THROTTLE_LIMIT = '100000';
  }
}

ensureTestJwtSecret();
raiseThrottleLimit();
