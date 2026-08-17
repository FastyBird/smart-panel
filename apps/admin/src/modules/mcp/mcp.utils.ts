import type { McpCapability } from './mcp.constants';

export const resolveMcpEndpoint = (location: Pick<Location, 'origin' | 'pathname'>): string => {
	const ingressMatch = location.pathname.match(/^(\/api\/hassio_ingress\/[^/]+)/);
	const ingressBase = ingressMatch ? ingressMatch[1] : '';

	return `${location.origin}${ingressBase}/api/v1/modules/mcp`;
};

export const isCapabilitySubset = (granted: McpCapability[], ceiling: McpCapability[]): boolean =>
	granted.every((capability) => ceiling.includes(capability));

export type McpClientStatus = 'active' | 'disabled' | 'expired' | 'revoked';

/**
 * Single definition of a client's effective state, shared by the status column
 * and the status filter so a row can never be labelled one thing and matched by
 * another.
 */
export const resolveMcpClientStatus = (client: {
	enabled: boolean;
	credentialRevoked: boolean;
	credentialExpiresAt: string | null;
}): McpClientStatus => {
	if (client.credentialRevoked) {
		return 'revoked';
	}

	if (client.credentialExpiresAt !== null && new Date(client.credentialExpiresAt).getTime() <= Date.now()) {
		return 'expired';
	}

	if (!client.enabled) {
		return 'disabled';
	}

	return 'active';
};
