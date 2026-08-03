export function resolveTrustProxyHops(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.TRUST_PROXY_HOPS;
  if (raw === undefined || raw === '') return 0;
  const hops = Number(raw);
  return Number.isNaN(hops) || hops < 0 ? 0 : hops;
}
