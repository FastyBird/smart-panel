import { Socket } from 'socket.io';

/**
 * Extract client IP address from Socket.IO connection, handling proxies and forwarded headers
 */
export function extractClientIpFromSocket(client: Socket): string {
	const request = client.request;

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

	// Fallback to handshake address
	if (client.handshake.address) {
		// Remove port if present (format: "::1" or "192.168.1.1:12345")
		const address = client.handshake.address.split(':')[0];
		if (address) {
			return address;
		}
	}

	// Fallback to socket remote address
	if (request.socket?.remoteAddress) {
		return request.socket.remoteAddress;
	}

	// Last resort: use connection remote address
	if ((request as { connection?: { remoteAddress?: string } }).connection?.remoteAddress) {
		return (request as { connection?: { remoteAddress?: string } }).connection.remoteAddress;
	}

	return 'unknown';
}
