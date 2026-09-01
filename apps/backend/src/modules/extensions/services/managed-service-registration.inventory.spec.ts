import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('managed service registration inventory', () => {
	const registrations = [
		['modules/buddy/buddy.module.ts', 'this.managedServiceManager.register(this.heartbeatService)'],
		['modules/mdns/services/mdns.service.ts', 'this.managedServiceManager.register(this)'],
		['modules/weather/weather.module.ts', 'this.managedServiceManager.register(this.weatherService)'],
		[
			'plugins/devices-home-assistant/devices-home-assistant.plugin.ts',
			'this.managedServiceManager.register(this.homeAssistantWsService)',
		],
		[
			'plugins/devices-home-assistant/devices-home-assistant.plugin.ts',
			'this.managedServiceManager.register(this.haMdnsDiscovererService)',
		],
		['plugins/devices-homey/devices-homey.plugin.ts', 'this.managedServiceManager.register(this.homeyService)'],
		[
			'plugins/devices-reterminal/devices-reterminal.plugin.ts',
			'this.managedServiceManager.register(this.reTerminalService)',
		],
		[
			'plugins/devices-shelly-ng/devices-shelly-ng.plugin.ts',
			'this.managedServiceManager.register(this.shellyNgService)',
		],
		[
			'plugins/devices-shelly-v1/devices-shelly-v1.plugin.ts',
			'this.managedServiceManager.register(this.shellyV1Service)',
		],
		['plugins/devices-wled/devices-wled.plugin.ts', 'this.managedServiceManager.register(this.wledService)'],
		[
			'plugins/devices-zigbee2mqtt/devices-zigbee2mqtt.plugin.ts',
			'this.managedServiceManager.register(this.zigbee2mqttService)',
		],
		['plugins/buddy-discord/buddy-discord.plugin.ts', 'this.managedServiceManager.register(this.discordBotProvider)'],
		[
			'plugins/buddy-telegram/buddy-telegram.plugin.ts',
			'this.managedServiceManager.register(this.telegramBotProvider)',
		],
		[
			'plugins/buddy-whatsapp/buddy-whatsapp.plugin.ts',
			'this.managedServiceManager.register(this.whatsAppBotProvider)',
		],
		['plugins/influx-v1/influx-v1.plugin.ts', 'this.managedServiceManager.register(this.influxV1ManagedService)'],
		['plugins/influx-v2/influx-v2.plugin.ts', 'this.managedServiceManager.register(this.influxV2ManagedService)'],
		[
			'plugins/memory-storage/memory-storage.plugin.ts',
			'this.managedServiceManager.register(this.memoryStorageManagedService)',
		],
		[
			'plugins/logger-rotating-file/logger-rotating-file.plugin.ts',
			'this.managedServiceManager.register(this.fileLoggerService)',
		],
		['plugins/simulator/simulator.plugin.ts', 'this.managedServiceManager.register(this.simulationService)'],
		[
			'plugins/spaces-home-control/spaces-home-control.plugin.ts',
			'this.managedServiceManager.register(this.spaceSuggestionHeartbeat)',
		],
	] as const;

	it('keeps every expected owner registration wired to the manager', () => {
		expect(registrations).toHaveLength(20);

		for (const [relativeFile, marker] of registrations) {
			const source = readFileSync(resolve(__dirname, '../../../', relativeFile), 'utf8');
			expect(source).toContain(marker);
		}
	});
});
