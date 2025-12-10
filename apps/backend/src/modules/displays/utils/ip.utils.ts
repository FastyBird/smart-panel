import { Request } from 'express';

/**
 * Extract client IP address from request, handling proxies and forwarded headers
 */
export function extractClientIp(request: Request): string {
	// Check X-Forwarded-For header (most common proxy header)
	const xForwardedFor = request.headers['x-forwarded-for'];
	if (xForwardedFor) {
		// X-Forwarded-For can contain multiple IPs, take the first one
		const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor.split(',')[0];
		if (ips && typeof ips === 'string') {
			return ips.trim();
		}
	}

	// Check X-Real-IP header
	const xRealIp = request.headers['x-real-ip'];
	if (xRealIp && typeof xRealIp === 'string') {
		return xRealIp.trim();
	}

	// Check CF-Connecting-IP (Cloudflare)
	const cfConnectingIp = request.headers['cf-connecting-ip'];
	if (cfConnectingIp && typeof cfConnectingIp === 'string') {
		return cfConnectingIp.trim();
	}

	// Fallback to socket remote address
	if (request.socket?.remoteAddress) {
		return request.socket.remoteAddress;
	}

	// Last resort: use connection remote address
	if ((request as any).connection?.remoteAddress) {
		return (request as any).connection.remoteAddress;
	}

	return 'unknown';
}

/**
 * Check if IP address is localhost (IPv4 or IPv6)
 */
export function isLocalhost(ip: string): boolean {
	if (!ip || ip === 'unknown') {
		return false;
	}

	const normalizedIp = ip.toLowerCase().trim();

	// IPv4 localhost
	if (normalizedIp === '127.0.0.1' || normalizedIp === 'localhost') {
		return true;
	}

	// IPv6 localhost
	if (normalizedIp === '::1' || normalizedIp === '::ffff:127.0.0.1') {
		return true;
	}

	// Check if it's a localhost variant
	if (normalizedIp.startsWith('127.') || normalizedIp.startsWith('::ffff:127.')) {
		return true;
	}

	return false;
}
