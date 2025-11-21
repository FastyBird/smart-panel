/*
eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';

import { DevicesShellyV1Exception } from '../devices-shelly-v1.exceptions';
import {
	ShellyInfoResponse,
	ShellyLoginResponse,
	ShellySettingsResponse,
	ShellyStatusResponse,
} from '../interfaces/shelly-http.interface';

import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';

// Mock global fetch
global.fetch = jest.fn();

describe('ShellyV1HttpClientService', () => {
	let service: ShellyV1HttpClientService;

	// Quiet logger noise
	let logSpy: jest.SpyInstance;
	let debugSpy: jest.SpyInstance;
	let errSpy: jest.SpyInstance;

	beforeAll(() => {
		logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		errSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterAll(() => {
		logSpy.mockRestore();
		debugSpy.mockRestore();
		errSpy.mockRestore();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		service = new ShellyV1HttpClientService();
	});

	const mockFetchSuccess = <T>(data: T): void => {
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => data,
		});
	};

	const mockFetchError = (status = 500, statusText = 'Internal Server Error'): void => {
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: false,
			status,
			statusText,
		});
	};

	const mockFetchTimeout = (): void => {
		(global.fetch as jest.Mock).mockImplementation(
			() =>
				new Promise((_, reject) => {
					const error = new Error('The operation was aborted');
					error.name = 'AbortError';
					setTimeout(() => reject(error), 10);
				}),
		);
	};

	describe('getDeviceInfo', () => {
		it('should fetch device info from /shelly endpoint', async () => {
			const mockInfo: ShellyInfoResponse = {
				type: 'SHSW-PM',
				mac: '8CBFEAA58474',
				auth: false,
				fw: '1.14.0',
				longid: 1234567890,
			};

			mockFetchSuccess(mockInfo);

			const result = await service.getDeviceInfo('192.168.1.100');

			expect(global.fetch).toHaveBeenCalledWith(
				'http://192.168.1.100/shelly',
				expect.objectContaining({
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				}),
			);

			expect(result).toEqual(mockInfo);
		});

		it('should use custom timeout', async () => {
			mockFetchSuccess({} as ShellyInfoResponse);

			await service.getDeviceInfo('192.168.1.100', 10000);

			expect(global.fetch).toHaveBeenCalled();
			// Timeout is passed to AbortController, verified by no timeout error
		});
	});

	describe('getDeviceSettings', () => {
		it('should fetch device settings from /settings endpoint without auth', async () => {
			const mockSettings: Partial<ShellySettingsResponse> = {
				name: 'My Shelly',
				fw: '1.14.0',
			};

			mockFetchSuccess(mockSettings);

			const result = await service.getDeviceSettings('192.168.1.100');

			expect(global.fetch).toHaveBeenCalledWith(
				'http://192.168.1.100/settings',
				expect.objectContaining({
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				}),
			);

			expect(result).toEqual(mockSettings);
		});

		it('should include Basic auth header when credentials provided', async () => {
			mockFetchSuccess({} as Partial<ShellySettingsResponse>);

			await service.getDeviceSettings('192.168.1.100', undefined, 'admin', 'password123');

			const expectedAuth = Buffer.from('admin:password123').toString('base64');

			expect(global.fetch).toHaveBeenCalledWith(
				'http://192.168.1.100/settings',
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: `Basic ${expectedAuth}`,
					}),
				}),
			);
		});
	});

	describe('getDeviceStatus', () => {
		it('should fetch device status from /status endpoint', async () => {
			const mockStatus: Partial<ShellyStatusResponse> = {
				wifi_sta: { connected: true, ssid: 'TestNetwork', ip: '192.168.1.100', rssi: -65 },
				cloud: { enabled: false, connected: false },
				mqtt: { connected: false },
				has_update: false,
				ram_total: 50000,
				ram_free: 35000,
				fs_size: 200000,
				fs_free: 150000,
				uptime: 12345,
			};

			mockFetchSuccess(mockStatus);

			const result = await service.getDeviceStatus('192.168.1.100');

			expect(global.fetch).toHaveBeenCalledWith('http://192.168.1.100/status', expect.any(Object));
			expect(result).toEqual(mockStatus);
		});

		it('should include auth credentials when provided', async () => {
			mockFetchSuccess({} as Partial<ShellyStatusResponse>);

			await service.getDeviceStatus('192.168.1.100', undefined, 'admin', 'secret');

			const expectedAuth = Buffer.from('admin:secret').toString('base64');

			expect(global.fetch).toHaveBeenCalledWith(
				'http://192.168.1.100/status',
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: `Basic ${expectedAuth}`,
					}),
				}),
			);
		});
	});

	describe('getLoginSettings', () => {
		it('should fetch login settings from /settings/login endpoint', async () => {
			const mockLogin: ShellyLoginResponse = {
				enabled: true,
				unprotected: false,
				username: 'admin',
			};

			mockFetchSuccess(mockLogin);

			const result = await service.getLoginSettings('192.168.1.100');

			expect(global.fetch).toHaveBeenCalledWith('http://192.168.1.100/settings/login', expect.any(Object));
			expect(result).toEqual(mockLogin);
		});

		it('should not require authentication', async () => {
			mockFetchSuccess({} as ShellyLoginResponse);

			await service.getLoginSettings('192.168.1.100');

			const fetchCall = (global.fetch as jest.Mock).mock.calls[0][1];

			expect(fetchCall.headers.Authorization).toBeUndefined();
		});
	});

	describe('Error handling', () => {
		it('should throw exception on HTTP error', async () => {
			mockFetchError(401, 'Unauthorized');

			await expect(service.getDeviceInfo('192.168.1.100')).rejects.toThrow(DevicesShellyV1Exception);
			await expect(service.getDeviceInfo('192.168.1.100')).rejects.toThrow('HTTP request failed: 401 Unauthorized');
		});

		it('should throw exception on network timeout', async () => {
			mockFetchTimeout();

			await expect(service.getDeviceInfo('192.168.1.100', 50)).rejects.toThrow(DevicesShellyV1Exception);
			await expect(service.getDeviceInfo('192.168.1.100', 50)).rejects.toThrow('Request timeout');
		});

		it('should throw exception on network error', async () => {
			(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

			await expect(service.getDeviceInfo('192.168.1.100')).rejects.toThrow(DevicesShellyV1Exception);
			await expect(service.getDeviceInfo('192.168.1.100')).rejects.toThrow('HTTP request failed: Network error');
		});

		it('should handle non-Error exceptions', async () => {
			(global.fetch as jest.Mock).mockRejectedValue('String error');

			await expect(service.getDeviceInfo('192.168.1.100')).rejects.toThrow(DevicesShellyV1Exception);
			await expect(service.getDeviceInfo('192.168.1.100')).rejects.toThrow('HTTP request failed: String error');
		});
	});

	describe('Request construction', () => {
		it('should construct correct URL', async () => {
			mockFetchSuccess({} as ShellyInfoResponse);

			await service.getDeviceInfo('192.168.1.100');

			expect(global.fetch).toHaveBeenCalledWith('http://192.168.1.100/shelly', expect.any(Object));
		});

		it('should set correct content type header', async () => {
			mockFetchSuccess({} as ShellyInfoResponse);

			await service.getDeviceInfo('192.168.1.100');

			expect(global.fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						'Content-Type': 'application/json',
					}),
				}),
			);
		});

		it('should use GET method', async () => {
			mockFetchSuccess({} as ShellyInfoResponse);

			await service.getDeviceInfo('192.168.1.100');

			expect(global.fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					method: 'GET',
				}),
			);
		});

		it('should include abort signal for timeout', async () => {
			mockFetchSuccess({} as ShellyInfoResponse);

			await service.getDeviceInfo('192.168.1.100');

			expect(global.fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					signal: expect.any(AbortSignal),
				}),
			);
		});
	});

	describe('Authentication header construction', () => {
		it('should correctly encode username and password', async () => {
			mockFetchSuccess({} as Partial<ShellySettingsResponse>);

			await service.getDeviceSettings('192.168.1.100', undefined, 'testuser', 'testpass');

			const expectedAuth = Buffer.from('testuser:testpass').toString('base64');

			expect(global.fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: `Basic ${expectedAuth}`,
					}),
				}),
			);
		});

		it('should handle special characters in password', async () => {
			mockFetchSuccess({} as Partial<ShellySettingsResponse>);

			await service.getDeviceSettings('192.168.1.100', undefined, 'admin', 'p@ssw0rd!#$');

			const expectedAuth = Buffer.from('admin:p@ssw0rd!#$').toString('base64');

			expect(global.fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: `Basic ${expectedAuth}`,
					}),
				}),
			);
		});

		it('should only add auth header when both username and password provided', async () => {
			mockFetchSuccess({} as Partial<ShellySettingsResponse>);

			// Only username
			await service.getDeviceSettings('192.168.1.100', undefined, 'admin', undefined);

			let fetchCall = (global.fetch as jest.Mock).mock.calls[0][1];

			expect(fetchCall.headers.Authorization).toBeUndefined();

			jest.clearAllMocks();

			// Only password
			await service.getDeviceSettings('192.168.1.100', undefined, undefined, 'password');

			fetchCall = (global.fetch as jest.Mock).mock.calls[0][1];

			expect(fetchCall.headers.Authorization).toBeUndefined();
		});
	});
});
