import * as crypto from 'crypto';

import { ACCESS_TOKEN_TYPE } from '../auth.constants';

export const hashToken = (token: string): string => {
	return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Minimal request shape we need to read the Authorization header.
 *
 * Typed structurally rather than as Express's or Fastify's `Request`
 * because callers come from both worlds: `AuthGuard` runs over a
 * `FastifyRequest`-extending `AuthenticatedRequest`, while
 * `DisplayAwareThrottlerGuard` uses NestJS's generic execution-context
 * request. Both have `headers.authorization` as the same `string`-ish
 * shape, which is all this util needs.
 */
type RequestWithAuthHeader = {
	headers: {
		authorization?: string | string[];
	};
};

/**
 * Pull a Bearer access token out of the `Authorization` header.
 *
 * Returns `undefined` when the header is absent, when the scheme isn't
 * `Bearer`, or when the value is malformed. Shared by `AuthGuard` (full
 * token validation) and `DisplayAwareThrottlerGuard` (display-token
 * detection for throttler bypass) so both stay in lockstep on what
 * counts as a token-bearing request.
 */
export const extractAccessTokenFromHeader = (request: RequestWithAuthHeader): string | undefined => {
	const rawHeader = request.headers.authorization;
	const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
	if (!authHeader) {
		return undefined;
	}
	const [type, token] = authHeader.split(' ');
	return type === ACCESS_TOKEN_TYPE ? token : undefined;
};
