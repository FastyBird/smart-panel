import { BadRequestException } from '@nestjs/common';

import { ManagedServiceManagerService } from '../../../modules/extensions/services/managed-service-manager.service';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';
import { HaMdnsDiscovererService } from '../services/ha-mdns-discoverer.service';

import { HomeAssistantDiscoveryController } from './home-assistant-discovery.controller';

describe('HomeAssistantDiscoveryController', () => {
	it('restarts the always-active managed discovery runtime on refresh', async () => {
		const discoverer = {
			getDiscoveredInstances: jest.fn().mockReturnValue([]),
		};
		const managedServiceManager = {
			restartService: jest.fn().mockResolvedValue(true),
		};
		const controller = new HomeAssistantDiscoveryController(
			discoverer as unknown as HaMdnsDiscovererService,
			managedServiceManager as unknown as ManagedServiceManagerService,
		);

		await controller.refreshDiscovery();

		expect(managedServiceManager.restartService).toHaveBeenCalledWith(
			'plugin',
			DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
			'discovery',
		);
	});

	it('rejects refresh when the managed discovery service cannot be restarted', async () => {
		const discoverer = {
			getDiscoveredInstances: jest.fn().mockReturnValue([]),
		};
		const managedServiceManager = {
			restartService: jest.fn().mockResolvedValue(false),
		};
		const controller = new HomeAssistantDiscoveryController(
			discoverer as unknown as HaMdnsDiscovererService,
			managedServiceManager as unknown as ManagedServiceManagerService,
		);

		await expect(controller.refreshDiscovery()).rejects.toThrow(BadRequestException);
		expect(discoverer.getDiscoveredInstances).not.toHaveBeenCalled();
	});
});
