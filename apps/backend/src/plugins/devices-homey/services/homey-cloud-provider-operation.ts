import { HOMEY_CLOUD_PROVIDER_TIMEOUT_MS } from '../devices-homey.constants';
import {
	HomeyCloudProviderError,
	HomeyCloudProviderErrorCategory,
	HomeyCloudProviderOperation,
	HomeyCloudSelectionError,
} from '../errors/homey-cloud-authorization.error';

const PROVIDER_TIMEOUT_CODES = new Set([
	'ABORTERROR',
	'ABORT_ERR',
	'ECONNABORTED',
	'ETIMEDOUT',
	'TIMEOUTERROR',
	'UND_ERR_BODY_TIMEOUT',
	'UND_ERR_CONNECT_TIMEOUT',
	'UND_ERR_HEADERS_TIMEOUT',
]);
const PROVIDER_UNAVAILABLE_CODES = new Set([
	'EAI_AGAIN',
	'ECONNREFUSED',
	'ECONNRESET',
	'EHOSTDOWN',
	'EHOSTUNREACH',
	'ENETDOWN',
	'ENETRESET',
	'ENETUNREACH',
	'ENOTFOUND',
	'EPIPE',
	'ERR_STREAM_PREMATURE_CLOSE',
	'UND_ERR_SOCKET',
]);

class ProviderTimeoutError extends Error {}

export async function runHomeyCloudProviderOperation<T>(
	operation: HomeyCloudProviderOperation,
	execute: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
	let timeout: NodeJS.Timeout | null = null;
	const controller = new AbortController();
	const timeoutError = new ProviderTimeoutError();

	try {
		return await Promise.race([
			execute(controller.signal),
			new Promise<never>((_resolve, reject) => {
				timeout = setTimeout(() => {
					controller.abort(timeoutError);
					reject(timeoutError);
				}, HOMEY_CLOUD_PROVIDER_TIMEOUT_MS);
				timeout.unref();
			}),
		]);
	} catch (error) {
		if (error instanceof HomeyCloudSelectionError) throw error;

		throw mapHomeyCloudProviderError(error, operation);
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}

export function mapHomeyCloudProviderError(
	error: unknown,
	operation: HomeyCloudProviderOperation,
): HomeyCloudProviderError {
	if (error instanceof HomeyCloudProviderError) return error;
	if (error instanceof ProviderTimeoutError) {
		return new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.TIMEOUT, operation);
	}

	const records = providerErrorChain(error);
	const statusCode = records
		.flatMap((record) => [record.statusCode, record.status, record.code])
		.find((value): value is number => typeof value === 'number' && Number.isInteger(value));

	if (
		statusCode === 401 ||
		((operation === HomeyCloudProviderOperation.EXCHANGE_CODE ||
			operation === HomeyCloudProviderOperation.REFRESH_TOKEN) &&
			statusCode === 400)
	) {
		return new HomeyCloudProviderError(
			operation === HomeyCloudProviderOperation.EXCHANGE_CODE
				? HomeyCloudProviderErrorCategory.INVALID_GRANT
				: HomeyCloudProviderErrorCategory.INVALID_TOKEN,
			operation,
		);
	}
	if (statusCode === 408 || statusCode === 504) {
		return new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.TIMEOUT, operation);
	}
	if (statusCode === 429) {
		return new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.RATE_LIMITED, operation);
	}
	if (statusCode !== undefined && statusCode >= 500) {
		return new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.UNAVAILABLE, operation);
	}

	const codes = records.flatMap((record) =>
		[record.code, record.name, record.type]
			.filter((value): value is string => typeof value === 'string')
			.map((value) => value.toUpperCase()),
	);

	if (codes.some((code) => PROVIDER_TIMEOUT_CODES.has(code))) {
		return new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.TIMEOUT, operation);
	}
	if (codes.some((code) => PROVIDER_UNAVAILABLE_CODES.has(code))) {
		return new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.UNAVAILABLE, operation);
	}

	return new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.PROTOCOL, operation);
}

function providerErrorChain(error: unknown): readonly Record<string, unknown>[] {
	const records: Record<string, unknown>[] = [];
	const seen = new Set<object>();
	let current = error;

	while (typeof current === 'object' && current !== null && records.length < 5 && !seen.has(current)) {
		seen.add(current);
		const record = current as Record<string, unknown>;

		records.push(record);
		current = record.cause;
	}

	return records;
}
