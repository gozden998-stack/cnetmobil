// Basit, bellek içi (in-memory) sabit pencereli rate limiter.
// Tek instance içindir; her deploy/restart'ta sıfırlanır. Amaç, herkese
// açık form endpoint'lerinin (leads, iphone18-preorder gibi) botlar
// tarafından spam/flood edilmesini zorlaştırmak.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return (
    forwardedFor?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
