import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventType } from '../config.constants';

import { handleConfigChangeEvent } from './config-change-event';

describe('handleConfigChangeEvent', (): void => {
	const makeStore = () => ({ get: vi.fn((payload: { type: string }): Promise<unknown> => Promise.resolve(payload)) });

	const makeLogger = () => ({
		warn: vi.fn((message: string, ...args: unknown[]): void => void [message, args]),
		error: vi.fn((message: string, ...args: unknown[]): void => void [message, args]),
	});

	let configModulesStore: ReturnType<typeof makeStore>;
	let configPluginsStore: ReturnType<typeof makeStore>;
	let logger: ReturnType<typeof makeLogger>;

	const targets = () => ({ configModulesStore, configPluginsStore, logger });

	beforeEach((): void => {
		configModulesStore = makeStore();
		configPluginsStore = makeStore();
		logger = makeLogger();
	});

	// These two payloads are exactly what config.service.spec.ts pins the backend
	// to emit. The handler previously read `payload.modules` / `payload.plugins`,
	// arrays the backend has never sent, so every config change was dropped in
	// silence and the admin only caught up on reload.
	it('refetches the module whose config changed', (): void => {
		handleConfigChangeEvent(
			{ event: EventType.CONFIG_UPDATED, payload: { source: 'mock-module', type: 'module' } },
			targets()
		);

		expect(configModulesStore.get).toHaveBeenCalledWith({ type: 'mock-module' });
		expect(configPluginsStore.get).not.toHaveBeenCalled();
	});

	it('refetches the plugin whose config changed', (): void => {
		handleConfigChangeEvent({ event: EventType.CONFIG_UPDATED, payload: { source: 'mock', type: 'plugin' } }, targets());

		expect(configPluginsStore.get).toHaveBeenCalledWith({ type: 'mock' });
		expect(configModulesStore.get).not.toHaveBeenCalled();
	});

	// The whole point of the announcement carrying only a name: it reaches panel
	// displays too, and plugin configs hold API keys and passwords.
	it('never expects the configuration itself in the payload', (): void => {
		handleConfigChangeEvent(
			{
				event: EventType.CONFIG_UPDATED,
				payload: { source: 'devices-zigbee2mqtt-plugin', type: 'plugin', mqtt: { password: 'secret' } },
			},
			targets()
		);

		// Read back through the authenticated endpoint, not taken off the wire.
		expect(configPluginsStore.get).toHaveBeenCalledWith({ type: 'devices-zigbee2mqtt-plugin' });
	});

	it('ignores events from other modules', (): void => {
		handleConfigChangeEvent({ event: 'DevicesModule.Device.Created', payload: { source: 'x', type: 'module' } }, targets());

		expect(configModulesStore.get).not.toHaveBeenCalled();
		expect(configPluginsStore.get).not.toHaveBeenCalled();
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it('warns rather than throwing when the source is missing', (): void => {
		handleConfigChangeEvent({ event: EventType.CONFIG_UPDATED, payload: { type: 'module' } }, targets());

		expect(configModulesStore.get).not.toHaveBeenCalled();
		expect(logger.warn).toHaveBeenCalled();
	});

	it('warns rather than guessing when the target type is unknown', (): void => {
		handleConfigChangeEvent(
			{ event: EventType.CONFIG_UPDATED, payload: { source: 'mock', type: 'something-else' } },
			targets()
		);

		expect(configModulesStore.get).not.toHaveBeenCalled();
		expect(configPluginsStore.get).not.toHaveBeenCalled();
		expect(logger.warn).toHaveBeenCalled();
	});

	// A failed refetch must not surface as an unhandled rejection on the socket
	// callback, which has no caller to catch it.
	it('reports a failed refetch instead of rejecting', async (): Promise<void> => {
		configModulesStore.get.mockRejectedValue(new Error('offline'));

		handleConfigChangeEvent(
			{ event: EventType.CONFIG_UPDATED, payload: { source: 'mock-module', type: 'module' } },
			targets()
		);

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(logger.error).toHaveBeenCalled();
	});
});
