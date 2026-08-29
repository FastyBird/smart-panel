import { HOMEY_CLOUD_CALLBACK_PATH } from './devices-homey.constants';

interface HomeyCloudCallbackRequest {
	readonly raw: {
		url?: string;
		originalUrl?: string;
	};
}

/**
 * Removes OAuth query material before guards, filters, and application loggers can observe the request target.
 * Fastify has already parsed `request.query` when this hook runs, so the callback controller retains its inputs.
 */
export const redactHomeyCloudCallbackRequestTarget = (request: HomeyCloudCallbackRequest): void => {
	const requestTarget = request.raw.url;

	if (!requestTarget) return;

	let pathname: string;

	try {
		pathname = new URL(requestTarget, 'http://localhost').pathname;
	} catch {
		return;
	}

	if (pathname !== HOMEY_CLOUD_CALLBACK_PATH) return;

	request.raw.url = pathname;
	request.raw.originalUrl = pathname;
};
