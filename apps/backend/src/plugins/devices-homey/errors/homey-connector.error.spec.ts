import { HomeyConnectorError, HomeyConnectorErrorCategory, HomeyConnectorOperation } from './homey-connector.error';

describe('HomeyConnectorError', () => {
	it.each([
		[HomeyConnectorErrorCategory.AUTHENTICATION, false],
		[HomeyConnectorErrorCategory.AUTHORIZATION, false],
		[HomeyConnectorErrorCategory.TIMEOUT, true],
		[HomeyConnectorErrorCategory.UNAVAILABLE, true],
		[HomeyConnectorErrorCategory.PROTOCOL, false],
		[HomeyConnectorErrorCategory.VALIDATION, false],
		[HomeyConnectorErrorCategory.UNSUPPORTED, false],
	])('normalizes %s retryability to %s', (category, retryable) => {
		const error = new HomeyConnectorError(category, HomeyConnectorOperation.GET_DEVICES);

		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(HomeyConnectorError);
		expect(error.name).toBe('HomeyConnectorError');
		expect(error.category).toBe(category);
		expect(error.operation).toBe(HomeyConnectorOperation.GET_DEVICES);
		expect(error.retryable).toBe(retryable);
		expect(error.message).toBe(`Homey connector operation 'get_devices' failed (${category})`);
	});

	it('does not carry a raw transport cause', () => {
		const error = new HomeyConnectorError(HomeyConnectorErrorCategory.PROTOCOL, HomeyConnectorOperation.SUBSCRIBE);

		expect(error).not.toHaveProperty('cause');
	});
});
