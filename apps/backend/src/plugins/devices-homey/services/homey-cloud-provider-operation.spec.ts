import { HOMEY_CLOUD_PROVIDER_TIMEOUT_MS } from '../devices-homey.constants';
import {
	HomeyCloudProviderErrorCategory,
	HomeyCloudProviderOperation,
} from '../errors/homey-cloud-authorization.error';

import { mapHomeyCloudProviderError, runHomeyCloudProviderOperation } from './homey-cloud-provider-operation';

describe('Homey Cloud provider operation boundary', () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it.each([
		[HomeyCloudProviderOperation.EXCHANGE_CODE, 400, HomeyCloudProviderErrorCategory.INVALID_GRANT],
		[HomeyCloudProviderOperation.REFRESH_TOKEN, 400, HomeyCloudProviderErrorCategory.INVALID_TOKEN],
		[HomeyCloudProviderOperation.AUTHENTICATE_HOMEY, 401, HomeyCloudProviderErrorCategory.INVALID_TOKEN],
		[HomeyCloudProviderOperation.LIST_HOMEYS, 429, HomeyCloudProviderErrorCategory.RATE_LIMITED],
		[HomeyCloudProviderOperation.LIST_HOMEYS, 503, HomeyCloudProviderErrorCategory.UNAVAILABLE],
	] as const)('maps %s HTTP %s to %s without retaining the raw error', (operation, statusCode, category) => {
		const raw = Object.assign(new Error('private provider response'), { statusCode });
		const mapped = mapHomeyCloudProviderError(raw, operation);

		expect(mapped).toMatchObject({ category, operation });
		expect(mapped).not.toHaveProperty('cause');
		expect(JSON.stringify(mapped)).not.toContain('private provider response');
	});

	it('walks bounded error causes for transport classification', () => {
		const raw = new Error('outer private response', {
			cause: Object.assign(new Error('inner private response'), { code: 'ECONNRESET' }),
		});

		expect(mapHomeyCloudProviderError(raw, HomeyCloudProviderOperation.AUTHENTICATE_HOMEY)).toMatchObject({
			category: HomeyCloudProviderErrorCategory.UNAVAILABLE,
			retryable: true,
		});
	});

	it('aborts the provider operation at the complete-operation deadline', async () => {
		jest.useFakeTimers();
		let signal: AbortSignal | null = null;
		const operation = runHomeyCloudProviderOperation(HomeyCloudProviderOperation.REFRESH_TOKEN, (operationSignal) => {
			signal = operationSignal;

			return new Promise(() => undefined);
		});
		const rejection = expect(operation).rejects.toMatchObject({
			category: HomeyCloudProviderErrorCategory.TIMEOUT,
			operation: HomeyCloudProviderOperation.REFRESH_TOKEN,
		});

		await jest.advanceTimersByTimeAsync(HOMEY_CLOUD_PROVIDER_TIMEOUT_MS);
		await rejection;
		expect(signal?.aborted).toBe(true);
	});
});
