import 'dotenv/config';

/** Public, and only ever used locally — never a fallback outside development or test. */
const DEVELOPMENT_SECRET = 'dev-secret';

/**
 * Reading the shared secret is deliberately fail-fast.
 *
 * The fallback triggers only when NODE_ENV is *explicitly* development or test. An unset or
 * unrecognised NODE_ENV throws exactly like production does — otherwise a production box
 * that simply forgot to set NODE_ENV would silently accept a publicly-known secret, which
 * turns a signed webhook into an open one.
 */
function readSapWebhookSecret(): string {
  const secret = process.env.SAP_WEBHOOK_SECRET;
  if (secret) {
    return secret;
  }

  const environment = process.env.NODE_ENV;

  if (environment === 'development' || environment === 'test') {
    console.warn(
      '[config] SAP_WEBHOOK_SECRET is not set — falling back to the public development ' +
        'secret. Set it in .env before pointing a real SAP system at this server.',
    );
    return DEVELOPMENT_SECRET;
  }

  throw new Error(
    `SAP_WEBHOOK_SECRET must be set (NODE_ENV=${environment ?? 'unset'}). The development ` +
      'fallback only applies when NODE_ENV is explicitly "development" or "test".',
  );
}

export const env = {
  sapWebhookSecret: readSapWebhookSecret(),
  /** Replay window: deliveries more than five minutes off our clock are rejected. */
  sapTimestampToleranceMs: 5 * 60 * 1000,
};
