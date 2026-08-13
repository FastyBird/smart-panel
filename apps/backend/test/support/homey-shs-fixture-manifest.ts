import { resolveHomeyTransportPort } from './homey-shs-transport';

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const buildHomeyFixtureProvenance = (metadata: JsonRecord): JsonRecord => {
	const capturedAt = metadata.capturedAt;
	const homey = metadata.homey;
	const transport = metadata.transport;

	if (typeof capturedAt !== 'string') {
		throw new Error('Sanitized Homey capture metadata is missing or has invalid fixture provenance');
	}

	const capturedDate = new Date(capturedAt);
	const validCapturedAt = !Number.isNaN(capturedDate.getTime()) && capturedDate.toISOString() === capturedAt;

	if (
		!validCapturedAt ||
		!isRecord(homey) ||
		typeof homey.version !== 'string' ||
		!isRecord(transport) ||
		typeof transport.protocol !== 'string' ||
		(typeof transport.port !== 'string' && typeof transport.port !== 'number')
	) {
		throw new Error('Sanitized Homey capture metadata is missing or has invalid fixture provenance');
	}

	return {
		captureDate: capturedAt.slice(0, 10),
		homeyVersion: homey.version,
		transport: {
			protocol: transport.protocol,
			port: resolveHomeyTransportPort(transport.protocol, transport.port),
		},
		sanitized: true,
	};
};
