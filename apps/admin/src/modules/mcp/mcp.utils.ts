import type { McpCapability } from './mcp.constants';

export const resolveMcpEndpoint = (location: Pick<Location, 'origin' | 'pathname'>): string => {
	const ingressMatch = location.pathname.match(/^(\/api\/hassio_ingress\/[^/]+)/);
	const ingressBase = ingressMatch ? ingressMatch[1] : '';

	return `${location.origin}${ingressBase}/api/v1/modules/mcp`;
};

export const isCapabilitySubset = (granted: McpCapability[], ceiling: McpCapability[]): boolean =>
	granted.every((capability) => ceiling.includes(capability));
