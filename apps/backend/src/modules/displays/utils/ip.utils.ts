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
