import { describe, expect, it } from 'vitest';

import { DevicesModuleDeviceConnectionStatus } from '../../openapi.constants';
import type { IDevice } from '../devices/store/devices.store.types';

import { CamerasException } from './cameras.exceptions';
import { buildLiveSocketUrl, isCameraCategory, isDeviceOffline, isModuleDisabledError, readErrorMessage } from './cameras.utils';

const deviceWith = (status: DevicesModuleDeviceConnectionStatus): IDevice =>
	({ status: { online: false, status, lastChanged: null } }) as unknown as IDevice;

describe('cameras.utils', (): void => {
	describe('buildLiveSocketUrl', (): void => {
		const path = '/api/v1/modules/cameras/live?session=T';

		it('uses wss on https', (): void => {
			expect(buildLiveSocketUrl(path, { origin: 'https://x.ts.net', pathname: '/cameras', protocol: 'https:' })).toBe(
				'wss://x.ts.net/api/v1/modules/cameras/live?session=T'
			);
		});

		it('uses ws on http and keeps the ingress prefix', (): void => {
			expect(buildLiveSocketUrl(path, { origin: 'http://ha:8123', pathname: '/api/hassio_ingress/abc/cameras', protocol: 'http:' })).toBe(
				'ws://ha:8123/api/hassio_ingress/abc/api/v1/modules/cameras/live?session=T'
			);
		});

		it('rejects anything but a path', (): void => {
			const loc = { origin: 'https://x.ts.net', pathname: '/cameras', protocol: 'https:' };

			expect(() => buildLiveSocketUrl('https://evil.example/live?session=T', loc)).toThrow(CamerasException);
			expect(() => buildLiveSocketUrl('//evil.example/live?session=T', loc)).toThrow(CamerasException);
		});

		it('does not leak the token in the error message', (): void => {
			expect.assertions(1);

			try {
				buildLiveSocketUrl('https://evil.example/live?session=SECRET', { origin: 'https://x', pathname: '/', protocol: 'https:' });
			} catch (error) {
				expect((error as Error).message).not.toContain('SECRET');
			}
		});
	});

	describe('isCameraCategory', (): void => {
		it('accepts camera and doorbell only', (): void => {
			expect(isCameraCategory('camera')).toBe(true);
			expect(isCameraCategory('doorbell')).toBe(true);
			expect(isCameraCategory('sensor')).toBe(false);
		});
	});

	describe('readErrorMessage', (): void => {
		it('reads a top-level message (Nest default body)', (): void => {
			expect(readErrorMessage({ message: 'Live view relay is not available', error: 'Service Unavailable', statusCode: 503 })).toBe(
				'Live view relay is not available'
			);
		});

		it('reads the first details[].reason', (): void => {
			expect(readErrorMessage({ error: { details: [{ reason: 'Cameras module is disabled' }] } })).toBe('Cameras module is disabled');
		});

		it('reads the real 404 body of NotFoundExceptionFilter (details is an object)', (): void => {
			expect(
				readErrorMessage({
					status: 'error',
					error: { code: 'NotFoundError', message: 'Cameras module is disabled', details: { reason: 'Cameras module is disabled' } },
				})
			).toBe('Cameras module is disabled');
		});

		it('returns null when there is nothing readable', (): void => {
			expect(readErrorMessage(undefined)).toBeNull();
			expect(readErrorMessage('boom')).toBeNull();
			expect(readErrorMessage({ error: { details: [] } })).toBeNull();
		});
	});

	describe('isModuleDisabledError', (): void => {
		const body = { error: { code: 'NotFoundError', message: 'Cameras module is disabled', details: { reason: 'Cameras module is disabled' } } };

		it('matches a 404 with the disabled message', (): void => {
			expect(isModuleDisabledError(404, body)).toBe(true);
		});

		it('does not match other statuses or messages', (): void => {
			expect(isModuleDisabledError(503, body)).toBe(false);
			expect(isModuleDisabledError(404, { message: 'Camera not found' })).toBe(false);
		});
	});

	describe('isDeviceOffline', (): void => {
		it('is null for an unknown device or status', (): void => {
			expect(isDeviceOffline(null)).toBeNull();
			expect(isDeviceOffline(undefined)).toBeNull();
			expect(isDeviceOffline(deviceWith(DevicesModuleDeviceConnectionStatus.unknown))).toBeNull();
		});

		it('is true for disconnected and lost', (): void => {
			expect(isDeviceOffline(deviceWith(DevicesModuleDeviceConnectionStatus.disconnected))).toBe(true);
			expect(isDeviceOffline(deviceWith(DevicesModuleDeviceConnectionStatus.lost))).toBe(true);
		});

		it('is false when connected', (): void => {
			expect(isDeviceOffline(deviceWith(DevicesModuleDeviceConnectionStatus.connected))).toBe(false);
		});
	});
});
