const MIN_JWT_SECRET_LENGTH = 32;

export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be set and be at least ${MIN_JWT_SECRET_LENGTH} characters long`,
    );
  }
  return secret;
}
