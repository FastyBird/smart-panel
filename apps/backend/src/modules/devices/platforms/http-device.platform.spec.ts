import fetch, { Response } from 'node-fetch';

import { Logger } from '@nestjs/common';

import { HttpDevicePlatform } from './http-device.platform';

jest.mock('node-fetch', () => jest.fn());

const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

class TestHttpDevicePlatform extends HttpDevicePlatform {
	getType(): string {
		return 'test-platform';
	}

	process(): Promise<boolean> {
		return Promise.resolve(true);
	}

	processBatch(): Promise<boolean> {
		return Promise.resolve(true);
	}
}

const createMockResponse = (body: any, status = 200) => {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: () => body as unknown,
		text: () => JSON.stringify(body),
	} as unknown as Response;
};

describe('HttpDevicePlatform', () => {
	let platform: TestHttpDevicePlatform;
	let loggerErrorSpy: jest.SpyInstance;
	let loggerWarnSpy: jest.SpyInstance;
	let loggerLogSpy: jest.SpyInstance;

	beforeEach(() => {
		platform = new TestHttpDevicePlatform();

		loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
		loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
		loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('sendCommand', () => {
		const endpoint = 'http://example.com/api';
		const payload = { key: 'value' };
		const mockResponse = createMockResponse({ success: true }, 200);

		it('should successfully send command on first attempt', async () => {
			mockedFetch.mockResolvedValueOnce(mockResponse);

			const result = await platform['sendCommand'](endpoint, payload);

			expect(result).toEqual(mockResponse);
			expect(mockedFetch).toHaveBeenCalledTimes(1);
			expect(loggerLogSpy).toHaveBeenCalledWith(
				`[HttpDevicePlatform] Sending command to ${endpoint}`,
				expect.objectContaining({ tag: 'devices-module' }),
			);
			expect(loggerLogSpy).toHaveBeenCalledWith(
				`[HttpDevicePlatform] Successfully processed command to ${endpoint}`,
				expect.objectContaining({ tag: 'devices-module' }),
			);
		});

		it('should retry up to the max attempts if request fails', async () => {
			const mockFailureResponse = createMockResponse('Error', 500);

			mockedFetch.mockResolvedValue(mockFailureResponse);
			const result = await platform['sendCommand'](endpoint, payload, 'PUT', 3);

			expect(result).toEqual(false);
			expect(mockedFetch).toHaveBeenCalledTimes(3);
			expect(loggerWarnSpy).toHaveBeenCalledTimes(6);
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				`[HttpDevicePlatform] Sending command failed after 3 attempts`,
				undefined,
				expect.objectContaining({ tag: 'devices-module' }),
			);
		});

		it('should not retry if request fails with a non-retriable error (4xx)', async () => {
			const mockFailureResponse = createMockResponse('Unauthorized', 401);

			mockedFetch.mockResolvedValue(mockFailureResponse);
			const result = await platform['sendCommand'](endpoint, payload, 'PUT', 3);

			expect(result).toBe(false);
			expect(mockedFetch).toHaveBeenCalledTimes(1);
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				`[HttpDevicePlatform] Failed request to ${endpoint} status=401 response="Unauthorized"`,
				expect.objectContaining({ tag: 'devices-module' }),
			);
		});

		it('should log and return false if fetch throws an error', async () => {
			mockedFetch.mockRejectedValueOnce(new Error('Network error'));

			const result = await platform['sendCommand'](endpoint, payload);

			expect(result).toBe(false);
			expect(mockedFetch).toHaveBeenCalledTimes(1);
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('[HttpDevicePlatform] Error processing command'),
				undefined,
				expect.objectContaining({ tag: 'devices-module' }),
			);
		});
	});
});
