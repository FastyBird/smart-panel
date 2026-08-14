import {
	HomeyConnectorError,
	HomeyConnectorErrorCategory,
	HomeyConnectorOperation,
} from '../errors/homey-connector.error';

import { classifyHomeyLocalTransportError, mapHomeyLocalTransportError } from './homey-local.error-mapper';

describe('Homey local transport error mapper', () => {
	it.each<[unknown, HomeyConnectorErrorCategory]>([
		[{ statusCode: 401 }, HomeyConnectorErrorCategory.AUTHENTICATION],
		[{ status: 403 }, HomeyConnectorErrorCategory.AUTHORIZATION],
		[{ statusCode: 408 }, HomeyConnectorErrorCategory.TIMEOUT],
		[{ statusCode: 504 }, HomeyConnectorErrorCategory.TIMEOUT],
		[{ statusCode: 400 }, HomeyConnectorErrorCategory.VALIDATION],
		[{ statusCode: 409 }, HomeyConnectorErrorCategory.VALIDATION],
		[{ statusCode: 422 }, HomeyConnectorErrorCategory.VALIDATION],
		[{ statusCode: 500 }, HomeyConnectorErrorCategory.UNAVAILABLE],
		[{ name: 'AbortError' }, HomeyConnectorErrorCategory.TIMEOUT],
		[{ code: 'ETIMEDOUT' }, HomeyConnectorErrorCategory.TIMEOUT],
		[{ code: 'ECONNREFUSED' }, HomeyConnectorErrorCategory.UNAVAILABLE],
		[{ code: 'HOMEY_UNSUPPORTED' }, HomeyConnectorErrorCategory.UNSUPPORTED],
		[new Error('unexpected protocol failure'), HomeyConnectorErrorCategory.PROTOCOL],
	])('classifies %# without inspecting message text', (error, category) => {
		expect(classifyHomeyLocalTransportError(error)).toBe(category);
	});

	it('rebuilds normalized failures for the public operation and discards sensitive raw details', () => {
		const rawSecret = 'sentinel-api-key@private-address';
		const mapped = mapHomeyLocalTransportError(
			{ body: rawSecret, message: rawSecret, statusCode: 401, url: `http://${rawSecret}` },
			HomeyConnectorOperation.CONNECT,
		);

		expect(mapped).toStrictEqual(
			new HomeyConnectorError(HomeyConnectorErrorCategory.AUTHENTICATION, HomeyConnectorOperation.CONNECT),
		);
		expect(JSON.stringify(mapped)).not.toContain(rawSecret);
		expect(mapped.stack).not.toContain(rawSecret);
	});

	it('preserves only the category when remapping an existing connector error', () => {
		const mapped = mapHomeyLocalTransportError(
			new HomeyConnectorError(HomeyConnectorErrorCategory.TIMEOUT, HomeyConnectorOperation.GET_ZONES),
			HomeyConnectorOperation.GET_DEVICES,
		);

		expect(mapped).toStrictEqual(
			new HomeyConnectorError(HomeyConnectorErrorCategory.TIMEOUT, HomeyConnectorOperation.GET_DEVICES),
		);
	});
});
