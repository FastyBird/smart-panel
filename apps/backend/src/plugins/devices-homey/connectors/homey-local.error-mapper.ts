import {
	HomeyConnectorError,
	HomeyConnectorErrorCategory,
	HomeyConnectorOperation,
} from '../errors/homey-connector.error';

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const valueOf = (error: unknown, key: string): unknown => (isRecord(error) ? error[key] : undefined);

const numericCode = (error: unknown): number | null => {
	for (const value of [valueOf(error, 'statusCode'), valueOf(error, 'status'), valueOf(error, 'code')]) {
		if (typeof value === 'number' && Number.isInteger(value)) {
			return value;
		}
	}

	return null;
};

const stringCode = (error: unknown): string | null => {
	for (const value of [valueOf(error, 'code'), valueOf(error, 'name')]) {
		if (typeof value === 'string') {
			return value.toUpperCase();
		}
	}

	return null;
};

export const classifyHomeyLocalTransportError = (error: unknown): HomeyConnectorErrorCategory => {
	if (error instanceof HomeyConnectorError) {
		return error.category;
	}

	const statusCode = numericCode(error);

	if (statusCode === 401) {
		return HomeyConnectorErrorCategory.AUTHENTICATION;
	}

	if (statusCode === 403) {
		return HomeyConnectorErrorCategory.AUTHORIZATION;
	}

	if (statusCode === 408 || statusCode === 504) {
		return HomeyConnectorErrorCategory.TIMEOUT;
	}

	if (statusCode === 400 || statusCode === 409 || statusCode === 422) {
		return HomeyConnectorErrorCategory.VALIDATION;
	}

	if (statusCode !== null && statusCode >= 500) {
		return HomeyConnectorErrorCategory.UNAVAILABLE;
	}

	const code = stringCode(error);

	if (code !== null && ['ABORTERROR', 'ECONNABORTED', 'ETIMEDOUT', 'TIMEOUTERROR'].includes(code)) {
		return HomeyConnectorErrorCategory.TIMEOUT;
	}

	if (code !== null && ['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND'].includes(code)) {
		return HomeyConnectorErrorCategory.UNAVAILABLE;
	}

	if (code === 'HOMEY_UNSUPPORTED' || code === 'UNSUPPORTED') {
		return HomeyConnectorErrorCategory.UNSUPPORTED;
	}

	return HomeyConnectorErrorCategory.PROTOCOL;
};

/** Discards raw messages, response bodies, endpoints, and causes. */
export const mapHomeyLocalTransportError = (error: unknown, operation: HomeyConnectorOperation): HomeyConnectorError =>
	error instanceof HomeyConnectorError
		? new HomeyConnectorError(error.category, operation)
		: new HomeyConnectorError(classifyHomeyLocalTransportError(error), operation);
