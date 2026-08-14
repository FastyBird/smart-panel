export const resolveHomeyTransportPort = (protocol: string, port: string | number): number => {
	if (protocol !== 'http' && protocol !== 'https') {
		throw new Error(`Unsupported Homey transport protocol '${protocol}'`);
	}

	if (port === '' || port === 'default') {
		return protocol === 'https' ? 443 : 80;
	}

	if (typeof port === 'string' && !/^\d+$/.test(port)) {
		throw new Error('Homey transport port must be an integer between 1 and 65535');
	}

	const parsedPort = typeof port === 'number' ? port : Number(port);

	if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
		throw new Error('Homey transport port must be an integer between 1 and 65535');
	}

	return parsedPort;
};
