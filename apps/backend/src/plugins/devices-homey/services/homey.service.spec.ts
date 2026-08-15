import { ConfigService } from '../../../modules/config/services/config.service';
import { HomeyConnectorFactory } from '../connectors/homey-connector.factory';
import { HomeyConnector } from '../connectors/homey-connector.interface';
import { HomeyEventListener } from '../connectors/homey-connector.types';
import {
	DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
	DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
	DEVICES_HOMEY_CONNECTOR_SERVICE_ID,
	DEVICES_HOMEY_PLUGIN_NAME,
	HomeyConnectionState,
} from '../devices-homey.constants';
import {
	HomeyConnectorError,
	HomeyConnectorErrorCategory,
	HomeyConnectorOperation,
} from '../errors/homey-connector.error';
import { HomeyConfigModel } from '../models/config.model';
import { HomeyDevice } from '../models/homey-device.model';
import { HomeyEventType } from '../models/homey-event.model';
import { HomeySystemInfo } from '../models/homey-system-info.model';
import { HomeyZone } from '../models/homey-zone.model';

import { HomeyService } from './homey.service';

const systemInfo: HomeySystemInfo = {
	id: 'homey-system',
	name: 'Homey Pro',
	version: '13.4.0',
	tier: 'pro',
	model: 'Homey Pro',
};

const zones: readonly HomeyZone[] = [
	{ id: 'zone-living', name: 'Living room', parentId: null, active: true, path: ['Living room'] },
];

const staleDevice: HomeyDevice = {
	id: 'device-light',
	name: 'Light',
	class: 'light',
	zoneId: 'zone-living',
	zoneName: 'Living room',
	zonePath: ['Living room'],
	available: true,
	availabilityMessage: null,
	driverId: 'homey:app:driver:light',
	manufacturer: 'Example',
	model: 'Light',
	energy: null,
	capabilities: [],
};

function createConnectorMock(onSubscribe: (listener: HomeyEventListener) => void, unsubscribe: jest.Mock) {
	return {
		connect: jest.fn().mockResolvedValue(undefined),
		disconnect: jest.fn().mockResolvedValue(undefined),
		getSystemInfo: jest.fn().mockResolvedValue(systemInfo),
		getZones: jest.fn().mockResolvedValue(zones),
		getDevices: jest.fn().mockResolvedValue([staleDevice]),
		getDevice: jest.fn().mockResolvedValue(staleDevice),
		setCapabilityValue: jest.fn().mockResolvedValue(undefined),
		subscribe: jest.fn().mockImplementation((nextListener: HomeyEventListener) => {
			onSubscribe(nextListener);

			return Promise.resolve(unsubscribe);
		}),
	} satisfies jest.Mocked<HomeyConnector>;
}

describe('HomeyService', () => {
	let config: HomeyConfigModel;
	let configService: jest.Mocked<Pick<ConfigService, 'getPluginConfig'>>;
	let connector: jest.Mocked<HomeyConnector>;
	let connectorFactory: jest.Mocked<HomeyConnectorFactory>;
	let listener: HomeyEventListener | null;
	let unsubscribe: jest.Mock;
	let service: HomeyService;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(Math, 'random').mockReturnValue(0.5);
		listener = null;
		unsubscribe = jest.fn();
		config = Object.assign(new HomeyConfigModel(), {
			enabled: true,
			url: 'http://homey.local:4859',
			apiKey: 'configured-secret',
			connectionTimeout: DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
			reconciliationInterval: DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
		});
		configService = { getPluginConfig: jest.fn().mockReturnValue(config) };
		connector = createConnectorMock((nextListener) => {
			listener = nextListener;
		}, unsubscribe);
		connectorFactory = { create: jest.fn().mockReturnValue(connector) };
		service = new HomeyService(configService as unknown as ConfigService, connectorFactory);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('exposes the managed connector identity and starts stopped', () => {
		expect(service.pluginName).toBe(DEVICES_HOMEY_PLUGIN_NAME);
		expect(service.serviceId).toBe(DEVICES_HOMEY_CONNECTOR_SERVICE_ID);
		expect(service.getState()).toBe('stopped');
	});

	it('connects, subscribes before inventory, and stops idempotently', async () => {
		const order: string[] = [];
		connector.connect.mockImplementation(() => {
			order.push('connect');
			return Promise.resolve();
		});
		connector.getSystemInfo.mockImplementation(() => {
			order.push('system');
			return Promise.resolve(systemInfo);
		});
		connector.getZones.mockImplementation(() => {
			order.push('zones');
			return Promise.resolve(zones);
		});
		connector.subscribe.mockImplementation((nextListener: HomeyEventListener) => {
			order.push('subscribe');
			listener = nextListener;
			return Promise.resolve(unsubscribe);
		});
		connector.getDevices.mockImplementation(() => {
			order.push('devices');
			return Promise.resolve([staleDevice]);
		});

		await service.start();
		await service.start();

		expect(order).toEqual(['connect', 'system', 'zones', 'subscribe', 'devices']);
		expect(connectorFactory.create.mock.calls[0]?.[0]).toEqual({
			url: config.url,
			apiKey: config.apiKey,
			connectionTimeout: config.connectionTimeout,
		});
		expect(service.getState()).toBe('started');
		expect(await service.isHealthy()).toBe(true);
		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.CONNECTED);

		await service.stop();
		await service.stop();

		expect(unsubscribe).toHaveBeenCalledTimes(1);
		expect(connector.disconnect.mock.calls).toHaveLength(1);
		expect(service.getState()).toBe('stopped');
		expect(await service.isHealthy()).toBe(false);
	});

	it('recovers from a retryable initial startup failure without a config change', async () => {
		const replacementConnector = createConnectorMock(() => undefined, jest.fn());
		connector.connect.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.CONNECT),
		);
		connectorFactory.create.mockReset().mockReturnValueOnce(connector).mockReturnValueOnce(replacementConnector);

		await service.start();

		expect(service.getStatus()).toMatchObject({
			serviceState: 'started',
			connectionState: HomeyConnectionState.RECONNECTING,
			healthy: false,
			lastError: 'Homey connection is temporarily unavailable',
		});
		expect(jest.getTimerCount()).toBe(1);

		await jest.advanceTimersByTimeAsync(1000);

		expect(replacementConnector.connect.mock.calls).toHaveLength(1);
		expect(service.getStatus()).toMatchObject({
			serviceState: 'started',
			connectionState: HomeyConnectionState.CONNECTED,
			healthy: true,
			lastError: null,
		});

		await service.stop();
	});

	it('performs a targeted authoritative read for an event received during the startup snapshot', async () => {
		const freshDevice = { ...staleDevice, available: false, availabilityMessage: 'Offline' };
		connector.getDevice.mockResolvedValue(freshDevice);
		connector.getDevices.mockImplementation(async () => {
			await listener?.({
				type: HomeyEventType.DEVICE_AVAILABILITY_CHANGED,
				deviceId: staleDevice.id,
				available: false,
				availabilityMessage: 'Offline',
				occurredAt: null,
				sequence: null,
			});

			return [staleDevice];
		});

		await service.start();

		expect(connector.subscribe.mock.invocationCallOrder[0]).toBeLessThan(
			connector.getDevices.mock.invocationCallOrder[0],
		);
		expect(connector.getDevice.mock.calls).toContainEqual([staleDevice.id]);
		expect(await service.isHealthy()).toBe(true);

		await service.stop();
	});

	it('serializes periodic reconciliation and does not schedule an overlapping run', async () => {
		let resolveInventory: ((devices: readonly HomeyDevice[]) => void) | null = null;

		await service.start();
		connector.getDevices.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveInventory = resolve;
				}),
		);

		jest.advanceTimersByTime(config.reconciliationInterval);
		await Promise.resolve();
		await Promise.resolve();

		expect(connector.getDevices.mock.calls).toHaveLength(2);

		jest.advanceTimersByTime(config.reconciliationInterval * 2);
		await Promise.resolve();

		expect(connector.getDevices.mock.calls).toHaveLength(2);

		resolveInventory?.([staleDevice]);

		for (let index = 0; index < 10; index += 1) {
			await Promise.resolve();
		}

		expect(jest.getTimerCount()).toBe(1);

		await service.stop();
	});

	it('waits for every periodic inventory read to settle before reconnecting', async () => {
		const replacementConnector = createConnectorMock(() => undefined, jest.fn());
		connectorFactory.create.mockReset().mockReturnValueOnce(connector).mockReturnValueOnce(replacementConnector);
		await service.start();

		let rejectZones: (error: Error) => void = () => undefined;
		let resolveDevices: (devices: readonly HomeyDevice[]) => void = () => undefined;
		connector.getZones.mockImplementationOnce(
			() =>
				new Promise<readonly HomeyZone[]>((_, reject) => {
					rejectZones = reject;
				}),
		);
		connector.getDevices.mockImplementationOnce(
			() =>
				new Promise<readonly HomeyDevice[]>((resolve) => {
					resolveDevices = resolve;
				}),
		);

		jest.advanceTimersByTime(config.reconciliationInterval);
		await Promise.resolve();
		await Promise.resolve();
		rejectZones(new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_ZONES));

		for (let index = 0; index < 10; index += 1) {
			await Promise.resolve();
		}

		expect(jest.getTimerCount()).toBe(0);
		expect(connector.disconnect.mock.calls).toHaveLength(0);

		resolveDevices([staleDevice]);

		for (let index = 0; index < 10; index += 1) {
			await Promise.resolve();
		}

		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.RECONNECTING);
		expect(jest.getTimerCount()).toBe(1);

		await jest.advanceTimersByTimeAsync(1000);

		expect(connector.disconnect.mock.calls).toHaveLength(1);
		expect(replacementConnector.connect.mock.calls).toHaveLength(1);

		await service.stop();
	});

	it('replaces the connector after a transient live synchronization failure', async () => {
		let replacementListener: HomeyEventListener | null = null;
		const replacementUnsubscribe = jest.fn();
		const replacementConnector = createConnectorMock((nextListener) => {
			replacementListener = nextListener;
		}, replacementUnsubscribe);
		connectorFactory.create.mockReset().mockReturnValueOnce(connector).mockReturnValueOnce(replacementConnector);
		await service.start();
		connector.getDevice.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_DEVICE),
		);

		await listener?.({
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		});

		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.RECONNECTING,
			healthy: false,
			lastError: 'Homey connection is temporarily unavailable',
		});
		expect(jest.getTimerCount()).toBe(1);

		await jest.advanceTimersByTimeAsync(999);
		expect(connectorFactory.create.mock.calls).toHaveLength(1);

		await jest.advanceTimersByTimeAsync(1);

		expect(connector.disconnect.mock.calls).toHaveLength(1);
		expect(replacementConnector.connect.mock.calls).toHaveLength(1);
		expect(replacementListener).not.toBeNull();
		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.CONNECTED,
			healthy: true,
			lastError: null,
		});

		await service.stop();
		expect(replacementUnsubscribe).toHaveBeenCalledTimes(1);
		expect(replacementConnector.disconnect.mock.calls).toHaveLength(1);
	});

	it('backs off exponentially after consecutive transient reconnect failures', async () => {
		const failingReplacement = createConnectorMock(() => undefined, jest.fn());
		failingReplacement.connect.mockRejectedValue(
			new HomeyConnectorError(HomeyConnectorErrorCategory.TIMEOUT, HomeyConnectorOperation.CONNECT),
		);
		const recoveredConnector = createConnectorMock(() => undefined, jest.fn());
		connectorFactory.create
			.mockReset()
			.mockReturnValueOnce(connector)
			.mockReturnValueOnce(failingReplacement)
			.mockReturnValueOnce(recoveredConnector);
		await service.start();
		connector.getDevice.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_DEVICE),
		);

		await listener?.({
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		});
		await jest.advanceTimersByTimeAsync(1000);

		expect(connectorFactory.create.mock.calls).toHaveLength(2);
		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.RECONNECTING);

		await jest.advanceTimersByTimeAsync(1999);
		expect(connectorFactory.create.mock.calls).toHaveLength(2);

		await jest.advanceTimersByTimeAsync(1);

		expect(connectorFactory.create.mock.calls).toHaveLength(3);
		expect(recoveredConnector.connect.mock.calls).toHaveLength(1);
		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.CONNECTED);

		await service.stop();
	});

	it('cancels a pending reconnect when authoritative traffic recovers', async () => {
		await service.start();
		connector.getDevice
			.mockRejectedValueOnce(
				new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_DEVICE),
			)
			.mockResolvedValue(staleDevice);
		const event = {
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		} as const;

		await listener?.(event);
		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.RECONNECTING);

		await listener?.(event);
		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.CONNECTED);
		expect(jest.getTimerCount()).toBe(1);

		await jest.advanceTimersByTimeAsync(1000);

		expect(connectorFactory.create.mock.calls).toHaveLength(1);
		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.CONNECTED);

		await service.stop();
	});

	it('does not retry authentication failures encountered while reconnecting', async () => {
		const rejectedConnector = createConnectorMock(() => undefined, jest.fn());
		rejectedConnector.connect.mockRejectedValue(
			new HomeyConnectorError(HomeyConnectorErrorCategory.AUTHORIZATION, HomeyConnectorOperation.CONNECT),
		);
		connectorFactory.create.mockReset().mockReturnValueOnce(connector).mockReturnValueOnce(rejectedConnector);
		await service.start();
		connector.getDevice.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_DEVICE),
		);

		await listener?.({
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		});
		await jest.advanceTimersByTimeAsync(1000);

		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.AUTHENTICATION_FAILED,
			healthy: false,
			lastError: 'Homey authentication or authorization failed',
		});
		expect(jest.getTimerCount()).toBe(0);

		await service.stop();
	});

	it('stops periodic work after a live authentication failure', async () => {
		await service.start();
		connector.getDevice.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.AUTHENTICATION, HomeyConnectorOperation.GET_DEVICE),
		);

		await listener?.({
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		});

		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.AUTHENTICATION_FAILED);
		expect(jest.getTimerCount()).toBe(0);

		await service.stop();
	});

	it('coalesces concurrent reconnect requests and cancels the pending attempt on stop', async () => {
		await service.start();
		connector.getDevice.mockRejectedValue(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_DEVICE),
		);
		const event = {
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		} as const;

		await Promise.all([listener?.(event), listener?.(event)]);

		expect(jest.getTimerCount()).toBe(1);
		expect(connectorFactory.create.mock.calls).toHaveLength(1);

		await service.stop();
		await jest.advanceTimersByTimeAsync(30000);

		expect(connectorFactory.create.mock.calls).toHaveLength(1);
		expect(service.getStatus().connectionState).toBe(HomeyConnectionState.STOPPED);
	});

	it('drains an active reconciliation before disconnecting for reconnect', async () => {
		const replacementConnector = createConnectorMock(() => undefined, jest.fn());
		connectorFactory.create.mockReset().mockReturnValueOnce(connector).mockReturnValueOnce(replacementConnector);
		await service.start();
		connector.getDevice.mockRejectedValueOnce(
			new HomeyConnectorError(HomeyConnectorErrorCategory.UNAVAILABLE, HomeyConnectorOperation.GET_DEVICE),
		);
		const event = {
			type: HomeyEventType.DEVICE_UPDATED,
			deviceId: staleDevice.id,
			occurredAt: null,
			sequence: null,
		} as const;

		await listener?.(event);

		let rejectRead: (error: Error) => void = () => undefined;
		connector.getDevice.mockImplementationOnce(
			() =>
				new Promise((_, reject) => {
					rejectRead = reject;
				}),
		);
		const activeReconciliation = listener?.(event);

		await jest.advanceTimersByTimeAsync(1000);

		expect(unsubscribe).toHaveBeenCalledTimes(1);
		expect(connector.disconnect.mock.calls).toHaveLength(0);

		rejectRead(new Error('in-flight read ended'));
		await activeReconciliation;

		for (let index = 0; index < 10; index += 1) {
			await Promise.resolve();
		}

		expect(connector.disconnect.mock.calls).toHaveLength(1);
		expect(replacementConnector.connect.mock.calls).toHaveLength(1);

		await service.stop();
	});

	it('refreshes device zone paths after a live zone change', async () => {
		await service.start();
		connector.getZones.mockClear();
		connector.getDevices.mockClear();

		await listener?.({
			type: HomeyEventType.ZONE_UPDATED,
			zoneId: zones[0].id,
			occurredAt: null,
			sequence: null,
		});

		expect(connector.getZones.mock.calls).toHaveLength(1);
		expect(connector.getDevices.mock.calls).toHaveLength(1);

		await service.stop();
	});

	it('categorizes authentication failures and cleans up partial startup', async () => {
		connector.connect.mockRejectedValue(
			new HomeyConnectorError(HomeyConnectorErrorCategory.AUTHENTICATION, HomeyConnectorOperation.CONNECT),
		);

		await expect(service.start()).rejects.toThrow('Homey authentication or authorization failed');
		expect(connector.disconnect.mock.calls).toHaveLength(1);
		expect(service.getStatus()).toMatchObject({
			serviceState: 'error',
			connectionState: HomeyConnectionState.AUTHENTICATION_FAILED,
			healthy: false,
			lastError: 'Homey authentication or authorization failed',
		});
	});

	it('cleans up a subscription after a failed inventory snapshot without exposing raw details', async () => {
		connector.getDevices.mockRejectedValue(new Error('configured-secret at http://homey.local:4859'));

		await expect(service.start()).rejects.toThrow('Homey service failed to start');
		expect(unsubscribe).toHaveBeenCalledTimes(1);
		expect(connector.disconnect.mock.calls).toHaveLength(1);
		expect(JSON.stringify(service.getStatus())).not.toContain('configured-secret');
		expect(JSON.stringify(service.getStatus())).not.toContain('homey.local');
	});

	it('retries connector cleanup after a sanitized stop failure', async () => {
		await service.start();
		connector.disconnect.mockRejectedValueOnce(new Error('configured-secret cleanup detail'));

		await expect(service.stop()).rejects.toThrow('Homey service failed to stop');
		expect(service.getState()).toBe('error');
		expect(service.getStatus().lastError).toBe('Homey service failed to stop');

		await service.stop();

		expect(connector.disconnect.mock.calls).toHaveLength(2);
		expect(service.getState()).toBe('stopped');
	});

	it('fails safely when the production connector factory is not registered', async () => {
		service = new HomeyService(configService as unknown as ConfigService);

		await expect(service.start()).rejects.toThrow('Homey service failed to start');
		expect(service.getStatus()).toMatchObject({
			connectionState: HomeyConnectionState.ERROR,
			healthy: false,
			lastError: 'Homey service failed to start',
		});
	});

	it('does not create a connector from incomplete saved configuration', async () => {
		config.apiKey = null;

		await expect(service.start()).rejects.toThrow('Homey service failed to start');
		expect(connectorFactory.create.mock.calls).toHaveLength(0);
		expect(service.getStatus()).toMatchObject({ configured: false, healthy: false });
	});

	it('reports configuration without exposing its URL or API key', () => {
		const status = service.getStatus();

		expect(status).toMatchObject({
			serviceState: 'stopped',
			connectionState: HomeyConnectionState.STOPPED,
			enabled: true,
			configured: true,
			healthy: false,
			lastError: null,
		});
		expect(status).not.toHaveProperty('apiKey');
		expect(status).not.toHaveProperty('url');
	});

	it('reads current configuration for each status snapshot while stopped', () => {
		expect(service.getStatus()).toMatchObject({ enabled: true, configured: true });

		configService.getPluginConfig.mockReturnValue(
			Object.assign(new HomeyConfigModel(), {
				enabled: false,
				url: null,
				apiKey: null,
			}),
		);

		expect(service.getStatus()).toMatchObject({ enabled: false, configured: false });
		expect(configService.getPluginConfig).toHaveBeenCalledTimes(2);
	});

	it('requests a restart only when connector configuration changes', async () => {
		await service.start();

		expect(await service.onConfigChanged()).toEqual({ restartRequired: false });

		configService.getPluginConfig.mockReturnValue(
			Object.assign(new HomeyConfigModel(), config, { apiKey: 'next-key' }),
		);

		expect(await service.onConfigChanged()).toEqual({ restartRequired: true });

		await service.stop();
	});
});
