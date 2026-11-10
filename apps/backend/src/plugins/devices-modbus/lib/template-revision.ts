import { createHash } from 'crypto';

import { ModbusTemplate } from '../templates/modbus-template.types';

const canonicalize = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.map(canonicalize);
	}

	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, canonicalize((value as Record<string, unknown>)[key])]),
		);
	}

	return value;
};

/** First 16 hex characters of SHA-256 over the canonical (recursively key-sorted) JSON of the template. */
export function modbusTemplateRevision(template: ModbusTemplate): string {
	return createHash('sha256')
		.update(JSON.stringify(canonicalize(template)))
		.digest('hex')
		.slice(0, 16);
}
