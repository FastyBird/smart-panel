import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import { Logger } from '@nestjs/common';

import {
	CameraOfflineException,
	CameraProfileUnavailableException,
	CameraRateLimitedException,
	CameraUpstreamException,
} from '../../../modules/cameras/cameras.exceptions';
import { DEVICES_UNIFI_PROTECT_TYPE } from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';

import { UnifiProtectStreamProvider } from './protect-stream.provider';

const URL_OF = (quality: string, port = 7441) =>
	`rtsps://192.0.2.10:${port}/SENTINELALIAS${quality}0123456789?enableSrtp`;

const expectedNumber: unknown = expect.any(Number);

const callArg = <T>(mock: jest.Mock, argument: number, call = 0): T =>
	(mock.mock.calls as unknown[][])[call][argument] as T;

const noStreams = { high: null, medium: null, low: null, package: null };

const availabilityOf = (enabled: string[]) => ({
	availability: {
		high: enabled.includes('high'),
		medium: enabled.includes('medium'),
		low: enabled.includes('low'),
		package: enabled.includes('package'),
	},
	readAt: Date.now(),
});

const IMAGE = { contentType: 'image/jpeg', data: Buffer.from([0xff, 0xd8, 0xff]) };

const makeDevice = (options: { packageChannel?: boolean; type?: string; nvrId?: string | null } = {}) => {
	const channels = [{ id: 'ch-main', identifier: 'camera.main' }];

	if (options.packageChannel === true) {
		channels.push({ id: 'ch-pkg', identifier: 'camera.package' });
	}

	return {
		id: 'device-1',
		type: options.type ?? DEVICES_UNIFI_PROTECT_TYPE,
		protectNvrId: options.nvrId === undefined ? 'nvr-1' : options.nvrId,
		protectDeviceId: 'cam-1',
		protectModelKey: 'camera',
		channels,
	} as never;
};

describe('UnifiProtectStreamProvider', () => {
	let provider: UnifiProtectStreamProvider;
	let connector: { getConsoleIdentity: jest.Mock; getClient: jest.Mock };
	let client: { getSnapshot: jest.Mock };
	let synchronizer: { getCachedDevice: jest.Mock };
	let availability: { getAvailability: jest.Mock; readStreams: jest.Mock; getStreamPorts: jest.Mock };
	let bridge: { getUpstreamHost: jest.Mock; getVerification: jest.Mock; prepare: jest.Mock };
	let configService: { getPluginConfig: jest.Mock };
	let overrideRead: jest.Mock;
	let defaultQuality: string;
	const logged: unknown[][] = [];

	beforeEach(() => {
		logged.length = 0;
		defaultQuality = 'medium';
		overrideRead = jest.fn();

		for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
			jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
				logged.push(args);
			});
		}

		client = { getSnapshot: jest.fn().mockResolvedValue(IMAGE) };
		connector = {
			getConsoleIdentity: jest.fn(() => ({ nvrId: 'nvr-1', nvrMacKey: 'AABBCC' })),
			getClient: jest.fn(() => client),
		};
		synchronizer = { getCachedDevice: jest.fn(() => ({ state: 'CONNECTED' })) };
		availability = {
			getAvailability: jest.fn().mockResolvedValue(availabilityOf(['high', 'medium', 'low', 'package'])),
			readStreams: jest.fn().mockResolvedValue({ ...noStreams, high: URL_OF('high') }),
			getStreamPorts: jest.fn(() => ({ high: 7441, medium: 7441, low: 7441, package: 7441 })),
		};
		bridge = {
			getUpstreamHost: jest.fn(() => '192.168.1.1'),
			getVerification: jest.fn(() => 'unknown'),
			prepare: jest.fn().mockResolvedValue({ host: '127.0.0.1', port: 40123 }),
		};
		configService = {
			getPluginConfig: jest.fn(() => ({
				get defaultStreamQuality() {
					return defaultQuality;
				},
				// The provider must not read the override: the bridge owns the upstream host rule.
				get streamHostOverride(): null {
					overrideRead();

					return null;
				},
			})),
		};

		provider = new UnifiProtectStreamProvider(
			connector as never,
			synchronizer as never,
			availability as never,
			bridge as never,
			configService as never,
		);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	describe('listProfiles', () => {
		it('lists the default quality first and the package profile last', async () => {
			availability.getAvailability.mockResolvedValue(availabilityOf(['high', 'package']));

			const profiles = await provider.listProfiles(makeDevice({ packageChannel: true }));

			expect(profiles.map((p) => p.id)).toEqual(['medium', 'high', 'low', 'package']);
			expect(profiles.map((p) => p.available)).toEqual([false, true, false, true]);
			expect(profiles.map((p) => p.unavailableReason)).toEqual([
				'stream_not_enabled',
				undefined,
				'stream_not_enabled',
				undefined,
			]);
			expect(profiles.map((p) => p.channelId)).toEqual(['ch-main', 'ch-main', 'ch-main', 'ch-pkg']);
		});

		it('orders the remaining qualities high, medium, low after the default', async () => {
			defaultQuality = 'low';

			const profiles = await provider.listProfiles(makeDevice());

			expect(profiles.map((p) => p.id)).toEqual(['low', 'high', 'medium']);
		});

		it('lists no package profile without a package channel', async () => {
			const profiles = await provider.listProfiles(makeDevice());

			expect(profiles.map((p) => p.id)).toEqual(['medium', 'high', 'low']);
		});

		it('reports console_unavailable without a request', async () => {
			connector.getConsoleIdentity.mockReturnValue(null);

			const profiles = await provider.listProfiles(makeDevice());

			expect(profiles.every((p) => !p.available && p.unavailableReason === 'console_unavailable')).toBe(true);

			connector.getConsoleIdentity.mockReturnValue({ nvrId: 'other', nvrMacKey: 'AABBCC' });

			const other = await provider.listProfiles(makeDevice());

			expect(other.every((p) => p.unavailableReason === 'console_unavailable')).toBe(true);
			expect(availability.getAvailability).not.toHaveBeenCalled();
			expect(availability.readStreams).not.toHaveBeenCalled();
		});

		it('reports camera_offline for a disconnected camera without a request', async () => {
			synchronizer.getCachedDevice.mockReturnValue({ state: 'DISCONNECTED' });

			const profiles = await provider.listProfiles(makeDevice());

			expect(profiles.every((p) => !p.available && p.unavailableReason === 'camera_offline')).toBe(true);
			expect(availability.getAvailability).not.toHaveBeenCalled();
		});

		it('reports stream_tls_unverified after a failed pre-flight', async () => {
			availability.getAvailability.mockResolvedValue(null);
			bridge.getVerification.mockReturnValue('unverified');

			const profiles = await provider.listProfiles(makeDevice());

			expect(profiles.every((p) => !p.available && p.unavailableReason === 'stream_tls_unverified')).toBe(true);
			expect(bridge.getVerification).toHaveBeenCalledWith({ host: '192.168.1.1', port: 7441 });
		});

		it('keeps a healthy profile available when another port on the same host failed verification', async () => {
			availability.getAvailability.mockResolvedValue(availabilityOf(['high', 'medium']));
			availability.getStreamPorts.mockReturnValue({ high: 7441, medium: 7442 });
			bridge.getVerification.mockImplementation(({ host, port }: { host: string; port: number }) =>
				host === '192.168.1.1' && port === 7442 ? 'unverified' : 'unknown',
			);

			const profiles = await provider.listProfiles(makeDevice());
			const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));

			expect(byId.high.available).toBe(true);
			expect(byId.medium).toMatchObject({ available: false, unavailableReason: 'stream_tls_unverified' });
		});

		it('reports camera_offline when the synchronizer has no copy of the camera', async () => {
			synchronizer.getCachedDevice.mockReturnValue(null);

			const profiles = await provider.listProfiles(makeDevice());

			expect(profiles.every((p) => !p.available && p.unavailableReason === 'camera_offline')).toBe(true);
			expect(availability.getAvailability).not.toHaveBeenCalled();
		});

		it('reports stream_tls_unverified for the package profile by its own port', async () => {
			availability.getStreamPorts.mockReturnValue({ high: 7441, package: 7443 });
			bridge.getVerification.mockImplementation(({ port }: { port: number }) =>
				port === 7443 ? 'unverified' : 'unknown',
			);

			const profiles = await provider.listProfiles(makeDevice({ packageChannel: true }));
			const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));

			expect(byId.package).toMatchObject({ available: false, unavailableReason: 'stream_tls_unverified' });
			expect(byId.high.available).toBe(true);
		});

		it('never defaults a profile without a known port to 7441', async () => {
			availability.getStreamPorts.mockReturnValue(null);
			bridge.getVerification.mockReturnValue('unverified');

			const profiles = await provider.listProfiles(makeDevice());

			expect(bridge.getVerification).not.toHaveBeenCalled();
			expect(profiles.every((p) => p.available)).toBe(true);
		});

		it('reports stream_state_unknown when availability cannot be read', async () => {
			availability.getAvailability.mockResolvedValue(null);

			const profiles = await provider.listProfiles(makeDevice());

			expect(profiles.every((p) => !p.available && p.unavailableReason === 'stream_state_unknown')).toBe(true);
		});

		it('does not report an aborted listing as stream_state_unknown and logs nothing', async () => {
			const controller = new AbortController();

			availability.getAvailability.mockImplementation(() => {
				controller.abort();

				return Promise.resolve(null);
			});

			await expect(provider.listProfiles(makeDevice(), { signal: controller.signal })).rejects.toBeInstanceOf(
				CameraUpstreamException,
			);
			expect(logged).toEqual([]);
		});

		it('lists nothing for a device that is not a Protect camera', async () => {
			await expect(provider.listProfiles(makeDevice({ type: 'devices-shelly-ng' }))).resolves.toEqual([]);
			await expect(
				provider.listProfiles({ ...(makeDevice() as object), protectModelKey: 'light' } as never),
			).resolves.toEqual([]);
			await expect(provider.listProfiles({ ...(makeDevice() as object), channels: [] } as never)).resolves.toEqual([]);
		});
	});

	describe('resolveSource', () => {
		it('resolves a plain rtsp bridge source and never rtspx', async () => {
			const source = await provider.resolveSource(makeDevice(), 'high');

			expect(bridge.prepare).toHaveBeenCalledWith(
				{ port: 7441 },
				expect.objectContaining({ deadlineMs: expectedNumber }),
			);
			expect(source).toEqual({ url: 'rtsp://127.0.0.1:40123/SENTINELALIAShigh0123456789', transport: 'rtsp' });
		});

		it('brackets an IPv6 bridge endpoint', async () => {
			bridge.prepare.mockResolvedValue({ host: '::1', port: 40123 });

			const source = await provider.resolveSource(makeDevice(), 'high');

			expect(source.url).toBe('rtsp://[::1]:40123/SENTINELALIAShigh0123456789');
		});

		it('connects to the port the console reported for that profile', async () => {
			availability.readStreams.mockResolvedValue({ ...noStreams, low: URL_OF('low', 7550) });

			await provider.resolveSource(makeDevice(), 'low');

			expect(bridge.prepare).toHaveBeenCalledWith({ port: 7550 }, expect.anything());
		});

		it('reads the console on every resolve', async () => {
			await provider.resolveSource(makeDevice(), 'high');
			await provider.resolveSource(makeDevice(), 'high');

			expect(availability.readStreams).toHaveBeenCalledTimes(2);
			expect(availability.readStreams).toHaveBeenCalledWith(
				'cam-1',
				expect.objectContaining({ deadlineMs: expectedNumber }),
			);
		});

		it('leaves the upstream host to the bridge', async () => {
			bridge.getUpstreamHost.mockReturnValue('streams.example');

			await provider.resolveSource(makeDevice(), 'high');

			expect(callArg<Record<string, unknown>>(bridge.prepare, 0)).toEqual({ port: 7441 });
			expect(overrideRead).not.toHaveBeenCalled();
		});

		it('passes only the port to the bridge', async () => {
			// The bridge plans TLS from the session's console host, not the override (R8); that is asserted in
			// protect-stream-bridge.service.spec.ts ("the stream goes to the override, but the TLS plan stays the session's").
			// What the provider owes is to name no host: verification is looked up under the bridge's own upstream host.
			bridge.getUpstreamHost.mockReturnValue('streams.example');
			bridge.getVerification.mockReturnValue('unverified');

			const profiles = await provider.listProfiles(makeDevice());

			expect(bridge.getVerification).toHaveBeenCalledWith({ host: 'streams.example', port: 7441 });
			expect(profiles.every((p) => p.unavailableReason === 'stream_tls_unverified')).toBe(true);

			bridge.getVerification.mockReturnValue('unknown');
			await provider.resolveSource(makeDevice(), 'high');

			expect(Object.keys(callArg<Record<string, unknown>>(bridge.prepare, 0))).toEqual(['port']);
			expect(overrideRead).not.toHaveBeenCalled();
		});

		it('logs a bridge TLS failure by category only', async () => {
			bridge.prepare.mockRejectedValue(new ProtectApiError(ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH, 'tls'));

			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(
				CameraProfileUnavailableException,
			);
			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(
				CameraProfileUnavailableException,
			);

			const lines = logged.map((args) => (args[0] as string).replace('[UnifiProtectStreamProvider] ', ''));

			expect(lines).toEqual(['UniFi Protect stream request failed (tls_fingerprint_mismatch)']);
			expect(JSON.stringify(logged)).not.toMatch(/SENTINELALIAS|rtsp|192\.168|127\.0/i);
		});

		it('logs a failed console read by category and an unknown error by class name', async () => {
			availability.readStreams.mockRejectedValueOnce(new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'tls'));
			availability.readStreams.mockRejectedValueOnce(new TypeError(URL_OF('high')));

			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(CameraUpstreamException);
			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(CameraUpstreamException);

			expect(logged.map((args) => (args[0] as string).replace('[UnifiProtectStreamProvider] ', ''))).toEqual([
				'UniFi Protect stream request failed (timeout)',
				'UniFi Protect stream request failed (TypeError)',
			]);
			expect(JSON.stringify(logged)).not.toMatch(/SENTINELALIAS|rtsp|192\.0/i);
		});

		it('does not log a cancelled call', async () => {
			availability.readStreams.mockRejectedValueOnce(new ProtectApiError(ProtectErrorCategory.CANCELLED, 'tls'));
			bridge.prepare.mockRejectedValueOnce(new ProtectApiError(ProtectErrorCategory.CANCELLED, 'tls'));

			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(CameraUpstreamException);
			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(CameraUpstreamException);

			expect(logged).toEqual([]);
		});

		it('treats a known profile the console answered with undefined as not enabled', async () => {
			availability.readStreams.mockResolvedValue({});

			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(
				CameraProfileUnavailableException,
			);
			expect(bridge.prepare).not.toHaveBeenCalled();
		});

		it('fails closed on an invalid stored override', async () => {
			bridge.getUpstreamHost.mockReturnValue(null);

			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(CameraUpstreamException);
			expect(bridge.prepare).not.toHaveBeenCalled();
		});

		it('fails closed when the console URL is malformed', async () => {
			availability.readStreams.mockResolvedValue({
				...noStreams,
				high: 'rtsp://192.0.2.10/SENTINELALIAShigh0123456789',
			});

			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(CameraUpstreamException);
			expect(bridge.prepare).not.toHaveBeenCalled();
		});

		it('fails closed when the bridge cannot verify the console', async () => {
			bridge.prepare.mockRejectedValue(new ProtectApiError(ProtectErrorCategory.TLS_FINGERPRINT_MISMATCH, 'tls'));

			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(
				CameraProfileUnavailableException,
			);
		});

		it('maps a bridge that has no listener to an upstream failure', async () => {
			bridge.prepare.mockRejectedValue(new ProtectApiError(ProtectErrorCategory.UNAVAILABLE, 'tls'));

			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(CameraUpstreamException);
		});

		it('refuses a profile that is not enabled or unknown', async () => {
			await expect(provider.resolveSource(makeDevice(), 'medium')).rejects.toBeInstanceOf(
				CameraProfileUnavailableException,
			);
			await expect(provider.resolveSource(makeDevice(), 'ultra')).rejects.toBeInstanceOf(
				CameraProfileUnavailableException,
			);
			await expect(provider.resolveSource(makeDevice(), 'package')).rejects.toBeInstanceOf(
				CameraProfileUnavailableException,
			);
			await expect(provider.resolveSource(makeDevice({ type: 'other' }), 'high')).rejects.toBeInstanceOf(
				CameraProfileUnavailableException,
			);
			expect(bridge.prepare).not.toHaveBeenCalled();
		});

		it('reports an offline camera or console without a request', async () => {
			synchronizer.getCachedDevice.mockReturnValue({ state: 'DISCONNECTED' });
			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(CameraOfflineException);

			synchronizer.getCachedDevice.mockReturnValue({ state: 'CONNECTED' });
			connector.getConsoleIdentity.mockReturnValue(null);
			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(CameraOfflineException);

			expect(availability.readStreams).not.toHaveBeenCalled();
		});

		it('maps console failures', async () => {
			availability.readStreams.mockRejectedValueOnce(new ProtectApiError(ProtectErrorCategory.UNAVAILABLE, 'tls'));
			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(CameraOfflineException);

			availability.readStreams.mockRejectedValueOnce(new ProtectApiError(ProtectErrorCategory.RATE_LIMITED, 'tls'));
			await expect(provider.resolveSource(makeDevice(), 'high')).rejects.toBeInstanceOf(CameraRateLimitedException);
		});

		it('never logs or throws a stream address', async () => {
			const errors: Error[] = [];
			const attempt = async (setup: () => void, profile = 'high'): Promise<void> => {
				setup();

				try {
					await provider.resolveSource(makeDevice(), profile);
				} catch (error) {
					errors.push(error as Error);
				}
			};

			await attempt(() =>
				bridge.prepare.mockRejectedValueOnce(new Error('rtsp://127.0.0.1:1/SENTINELALIAShigh0123456789')),
			);
			await attempt(() => availability.readStreams.mockRejectedValueOnce(new Error(URL_OF('high'))));
			await attempt(() => bridge.getUpstreamHost.mockReturnValueOnce(null));
			await attempt(() => undefined, 'medium');
			await provider.resolveSource(makeDevice(), 'high');

			expect(errors).toHaveLength(4);

			for (const error of errors) {
				expect(`${error.name} ${error.message} ${error.stack ?? ''}`).not.toMatch(/SENTINELALIAS|rtsp/i);
			}

			expect(JSON.stringify(logged)).not.toMatch(/SENTINELALIAS|rtsp/i);
		});

		it('does not keep the stream address in the provider', async () => {
			await provider.resolveSource(makeDevice(), 'high');

			const held = JSON.stringify(Object.values(provider as unknown as Record<string, unknown>), (key, value) =>
				typeof value === 'function' || key === 'logger' ? undefined : (value as unknown),
			);

			expect(held).not.toMatch(/SENTINELALIAS|rtsp/i);
		});

		describe('source budget', () => {
			beforeEach(() => jest.useFakeTimers());

			const settle = (promise: Promise<unknown>): { done: () => boolean; error: () => unknown } => {
				let finished = false;
				let failure: unknown;

				promise.then(
					() => {
						finished = true;
					},
					(error: unknown) => {
						finished = true;
						failure = error;
					},
				);

				return { done: () => finished, error: () => failure };
			};

			it("fits the source resolution into the core's timeout", async () => {
				// A read that ends at its own deadline and a pre-flight that only ends at its deadline.
				availability.readStreams.mockImplementation(
					(_id: string, options: { deadlineMs: number }) =>
						new Promise((resolve, reject) => {
							setTimeout(() => resolve({ ...noStreams, high: URL_OF('high') }), 4_900);
							setTimeout(
								() => reject(new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'cameras/{id}/rtsps-stream')),
								options.deadlineMs,
							);
						}),
				);
				bridge.prepare.mockImplementation(
					(_upstream: unknown, options: { deadlineMs: number }) =>
						new Promise((_resolve, reject) => {
							setTimeout(() => reject(new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'tls')), options.deadlineMs);
						}),
				);

				const outcome = settle(provider.resolveSource(makeDevice(), 'high'));

				await jest.advanceTimersByTimeAsync(9_000);
				expect(outcome.done()).toBe(true);
				expect(outcome.error()).toBeInstanceOf(CameraUpstreamException);
				expect(callArg<{ deadlineMs: unknown }>(availability.readStreams, 1).deadlineMs).toBe(5_000);
				expect(callArg<{ deadlineMs: unknown }>(bridge.prepare, 1).deadlineMs).toBe(4_100);
			});

			it('rejects a read slower than 5 s at 5 s', async () => {
				availability.readStreams.mockImplementation(
					(_id: string, options: { deadlineMs: number }) =>
						new Promise((_resolve, reject) => {
							setTimeout(
								() => reject(new ProtectApiError(ProtectErrorCategory.TIMEOUT, 'cameras/{id}/rtsps-stream')),
								options.deadlineMs,
							);
						}),
				);

				const outcome = settle(provider.resolveSource(makeDevice(), 'high'));

				await jest.advanceTimersByTimeAsync(4_999);
				expect(outcome.done()).toBe(false);
				await jest.advanceTimersByTimeAsync(1);
				expect(outcome.done()).toBe(true);
				expect(outcome.error()).toBeInstanceOf(CameraUpstreamException);
				expect(bridge.prepare).not.toHaveBeenCalled();
			});

			it("passes the caller's signal to both steps", async () => {
				const controller = new AbortController();

				await provider.resolveSource(makeDevice(), 'high', { signal: controller.signal });

				expect(callArg<{ signal: unknown }>(availability.readStreams, 1).signal).toBe(controller.signal);
				expect(callArg<{ signal: unknown }>(bridge.prepare, 1).signal).toBe(controller.signal);
			});
		});
	});

	describe('getSnapshot', () => {
		const signal = new AbortController().signal;
		const hqCapable = (flag: boolean) => {
			synchronizer.getCachedDevice.mockReturnValue({
				state: 'CONNECTED',
				featureFlags: { supportFullHdSnapshot: flag },
			});
		};

		it('takes a main snapshot without a channel parameter', async () => {
			for (const channelId of [undefined, 'ch-main']) {
				client.getSnapshot.mockClear();

				const image = await provider.getSnapshot(makeDevice(), { channelId, signal });

				expect(image).toEqual(IMAGE);
				expect(client.getSnapshot).toHaveBeenCalledWith('cam-1', { highQuality: false, signal, deadlineMs: 8000 });
			}
		});

		it('takes a package snapshot', async () => {
			await provider.getSnapshot(makeDevice({ packageChannel: true }), { channelId: 'ch-pkg', signal });

			expect(client.getSnapshot).toHaveBeenCalledWith('cam-1', {
				highQuality: false,
				channel: 'package',
				signal,
				deadlineMs: 8000,
			});
		});

		it('refuses an unknown channel without a request', async () => {
			await expect(provider.getSnapshot(makeDevice(), { channelId: 'ch-pkg' })).rejects.toBeInstanceOf(
				CameraProfileUnavailableException,
			);
			await expect(provider.getSnapshot(makeDevice(), { channelId: 'nope' })).rejects.toBeInstanceOf(
				CameraProfileUnavailableException,
			);
			expect(client.getSnapshot).not.toHaveBeenCalled();
		});

		it('refuses a device that is not a Protect camera', async () => {
			await expect(provider.getSnapshot(makeDevice({ type: 'other' }), {})).rejects.toBeInstanceOf(
				CameraProfileUnavailableException,
			);
		});

		it('requests full HD only when the camera supports it', async () => {
			hqCapable(false);
			await provider.getSnapshot(makeDevice(), { highQuality: true });
			expect(callArg<{ highQuality: boolean }>(client.getSnapshot, 1, 0).highQuality).toBe(false);

			hqCapable(true);
			await provider.getSnapshot(makeDevice(), { highQuality: true });
			expect(callArg<{ highQuality: boolean }>(client.getSnapshot, 1, 1).highQuality).toBe(true);

			await provider.getSnapshot(makeDevice(), {});
			expect(callArg<{ highQuality: boolean }>(client.getSnapshot, 1, 2).highQuality).toBe(false);
		});

		it('falls back once, within one shared deadline, when the console refuses full HD', async () => {
			hqCapable(true);
			jest.useFakeTimers({ now: 1_000_000 });
			client.getSnapshot
				.mockImplementationOnce(() => {
					jest.setSystemTime(1_003_000);

					return Promise.reject(new ProtectApiError(ProtectErrorCategory.UNSUPPORTED, 'cameras/{id}/snapshot'));
				})
				.mockResolvedValueOnce(IMAGE);

			await expect(provider.getSnapshot(makeDevice(), { highQuality: true })).resolves.toEqual(IMAGE);

			expect(client.getSnapshot).toHaveBeenCalledTimes(2);
			expect(callArg<Record<string, unknown>>(client.getSnapshot, 1, 0)).toMatchObject({
				highQuality: true,
				deadlineMs: 8000,
			});
			expect(callArg<Record<string, unknown>>(client.getSnapshot, 1, 1)).toMatchObject({
				highQuality: false,
				deadlineMs: 5000,
			});
		});

		it('fails when the fallback is refused too', async () => {
			hqCapable(true);
			client.getSnapshot.mockRejectedValue(
				new ProtectApiError(ProtectErrorCategory.UNSUPPORTED, 'cameras/{id}/snapshot'),
			);

			await expect(provider.getSnapshot(makeDevice(), { highQuality: true })).rejects.toBeInstanceOf(
				CameraUpstreamException,
			);
			expect(client.getSnapshot).toHaveBeenCalledTimes(2);
		});

		it('does not retry an unsupported answer to a request that was not full HD', async () => {
			client.getSnapshot.mockRejectedValue(
				new ProtectApiError(ProtectErrorCategory.UNSUPPORTED, 'cameras/{id}/snapshot'),
			);

			await expect(provider.getSnapshot(makeDevice(), {})).rejects.toBeInstanceOf(CameraUpstreamException);
			expect(client.getSnapshot).toHaveBeenCalledTimes(1);
		});

		it('answers offline without a request', async () => {
			connector.getClient.mockReturnValue(null);
			await expect(provider.getSnapshot(makeDevice(), {})).rejects.toBeInstanceOf(CameraOfflineException);

			connector.getClient.mockReturnValue(client);
			synchronizer.getCachedDevice.mockReturnValue({ state: 'DISCONNECTED' });
			await expect(provider.getSnapshot(makeDevice(), {})).rejects.toBeInstanceOf(CameraOfflineException);

			connector.getConsoleIdentity.mockReturnValue(null);
			await expect(provider.getSnapshot(makeDevice(), {})).rejects.toBeInstanceOf(CameraOfflineException);

			expect(client.getSnapshot).not.toHaveBeenCalled();
		});

		it('still requests a camera that is missing from the cache', async () => {
			synchronizer.getCachedDevice.mockReturnValue(null);

			await expect(provider.getSnapshot(makeDevice(), {})).resolves.toEqual(IMAGE);
		});

		it.each([
			['unavailable', CameraOfflineException],
			['not_found', CameraOfflineException],
			['rate_limited', CameraRateLimitedException],
			['timeout', CameraUpstreamException],
		])('maps a snapshot failure %s', async (category, expected) => {
			client.getSnapshot.mockRejectedValue(
				new ProtectApiError(category as ProtectErrorCategory, 'cameras/{id}/snapshot'),
			);

			await expect(provider.getSnapshot(makeDevice(), {})).rejects.toBeInstanceOf(expected);
		});

		it('logs a failure as a category only', async () => {
			client.getSnapshot.mockRejectedValue(new Error('https://192.0.2.10/SENTINELALIAS'));

			await expect(provider.getSnapshot(makeDevice(), {})).rejects.toBeInstanceOf(CameraUpstreamException);

			expect(JSON.stringify(logged)).toContain('Error');
			expect(JSON.stringify(logged)).not.toMatch(/SENTINELALIAS|192\.0|https/);
		});

		it('does not log a cancelled snapshot', async () => {
			client.getSnapshot.mockRejectedValue(
				new ProtectApiError(ProtectErrorCategory.CANCELLED, 'cameras/{id}/snapshot'),
			);

			await expect(provider.getSnapshot(makeDevice(), {})).rejects.toBeInstanceOf(CameraUpstreamException);
			expect(logged).toEqual([]);
		});

		it('reports the configured snapshot interval', () => {
			const set = (value: unknown) => configService.getPluginConfig.mockReturnValue({ snapshotMinIntervalMs: value });

			set(5000);
			expect(provider.getSnapshotMinIntervalMs(makeDevice())).toBe(5000);
			set(undefined);
			expect(provider.getSnapshotMinIntervalMs(makeDevice())).toBe(2000);
			set(100);
			expect(provider.getSnapshotMinIntervalMs(makeDevice())).toBe(500);
			set(999999);
			expect(provider.getSnapshotMinIntervalMs(makeDevice())).toBe(60000);
			set('x');
			expect(provider.getSnapshotMinIntervalMs(makeDevice())).toBe(2000);
			configService.getPluginConfig.mockImplementation(() => {
				throw new Error('no config');
			});
			expect(provider.getSnapshotMinIntervalMs(makeDevice())).toBe(2000);
		});

		it('never uses the bridge for snapshots', async () => {
			await provider.getSnapshot(makeDevice(), {});

			expect(bridge.prepare).not.toHaveBeenCalled();
			expect(availability.readStreams).not.toHaveBeenCalled();
		});
	});

	it('produces no insecure transport anywhere in the plugin', () => {
		const root = join(__dirname, '..');
		const files: string[] = [];
		const walk = (dir: string): void => {
			for (const name of readdirSync(dir)) {
				const path = join(dir, name);

				if (statSync(path).isDirectory()) {
					if (name !== '__fixtures__') {
						walk(path);
					}
				} else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) {
					files.push(path);
				}
			}
		};

		walk(root);

		// The redactor still masks `rtspx://` if one ever appears in a log; it never produces one.
		const offenders = files
			.filter((file) => !file.endsWith(join('client', 'protect-redaction.ts')))
			.filter((file) => /rtspx|rtsps-insecure/.test(readFileSync(file, 'utf8')));

		expect(offenders).toEqual([]);
	});
});
