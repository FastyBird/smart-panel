import { HOMEY_CLOUD_CALLBACK_PATH } from './devices-homey.constants';
import { redactHomeyCloudCallbackRequestTarget } from './homey-cloud-callback-redaction';

describe('redactHomeyCloudCallbackRequestTarget', () => {
	it('removes callback query material from current and original request targets', () => {
		const request = {
			raw: {
				url: `${HOMEY_CLOUD_CALLBACK_PATH}?code=provider-secret&state=opaque-state&error_description=private`,
				originalUrl: `${HOMEY_CLOUD_CALLBACK_PATH}?code=provider-secret&state=opaque-state`,
			},
			query: { code: 'provider-secret', state: 'opaque-state' },
		};

		redactHomeyCloudCallbackRequestTarget(request);

		expect(request.raw.url).toBe(HOMEY_CLOUD_CALLBACK_PATH);
		expect(request.raw.originalUrl).toBe(HOMEY_CLOUD_CALLBACK_PATH);
		expect(request.query).toEqual({ code: 'provider-secret', state: 'opaque-state' });
	});

	it('does not alter unrelated request targets', () => {
		const request = { raw: { url: '/api/v1/plugins/devices-homey/status?code=ordinary-filter' } };

		redactHomeyCloudCallbackRequestTarget(request);

		expect(request.raw.url).toBe('/api/v1/plugins/devices-homey/status?code=ordinary-filter');
	});
});
