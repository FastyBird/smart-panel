import inquirer from 'inquirer';
import { Command, CommandRunner, Option } from 'nest-commander';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { getAllProperties } from '../../../modules/devices/utils/schema.utils';
import { DEVICES_SIMULATOR_PLUGIN_NAME, DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';
import { DeviceGeneratorService } from '../services/device-generator.service';

interface PopulateValuesOptions {
	device?: string;
	all?: boolean;
	list?: boolean;
}

@Command({
	name: 'simulator:populate',
	description: 'Populate simulated devices with random property values',
})
@Injectable()
export class PopulateValuesCommand extends CommandRunner {
	private readonly logger = createExtensionLogger(DEVICES_SIMULATOR_PLUGIN_NAME, 'PopulateValuesCommand');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceGeneratorService: DeviceGeneratorService,
	) {
		super();
	}

	@Option({
		flags: '-d, --device <deviceId>',
		description: 'Specific device ID to populate',
	})
	parseDevice(val: string): string {
		return val;
	}

	@Option({
		flags: '-a, --all',
		description: 'Populate all simulator devices',
		defaultValue: false,
	})
	parseAll(): boolean {
		return true;
	}

	@Option({
		flags: '-l, --list',
		description: 'List all simulator devices',
		defaultValue: false,
	})
	parseList(): boolean {
		return true;
	}

	async run(_passedParams: string[], options?: PopulateValuesOptions): Promise<void> {
		// Get all simulator devices
		const allDevices = await this.devicesService.findAll<SimulatorDeviceEntity>(DEVICES_SIMULATOR_TYPE);

		if (allDevices.length === 0) {
			console.log('\n\x1b[33m⚠️  No simulator devices found.\x1b[0m');
			console.log('Use \x1b[36msimulator:generate\x1b[0m to create simulated devices first.\n');
			return;
		}

		// List devices if requested
		if (options?.list) {
			this.listDevices(allDevices);
			return;
		}

		let devicesToPopulate: SimulatorDeviceEntity[] = [];

		if (options?.all) {
			// Populate all devices
			devicesToPopulate = allDevices;
		} else if (options?.device) {
			// Find specific device
			const device = allDevices.find((d) => d.id === options.device);

			if (!device) {
				console.error(`\n\x1b[31m❌ Device not found: ${options.device}\x1b[0m\n`);
				console.log('Use --list to see available simulator devices.\n');
				process.exit(1);
			}

			devicesToPopulate = [device];
		} else {
			// Interactive mode - let user select devices
			const choices = allDevices.map((device) => ({
				name: `${device.name} (${device.category}) - ${device.id}`,
				value: device.id,
			}));

			const answers = await inquirer.prompt<{ deviceIds: string[] }>([
				{
					type: 'checkbox',
					name: 'deviceIds',
					message: 'Select devices to populate with random values:',
					choices: [{ name: 'All devices', value: '__all__' }, new inquirer.Separator(), ...choices],
					pageSize: 15,
					validate: (input) => input.length > 0 || 'Please select at least one device',
				},
			]);

			if (answers.deviceIds.includes('__all__')) {
				devicesToPopulate = allDevices;
			} else {
				devicesToPopulate = allDevices.filter((d) => answers.deviceIds.includes(d.id));
			}
		}

		console.log(`\n\x1b[36m🎲 Populating ${devicesToPopulate.length} device(s) with random values...\x1b[0m\n`);

		let totalPropertiesUpdated = 0;

		for (const device of devicesToPopulate) {
			const propertiesUpdated = await this.populateDevice(device);
			totalPropertiesUpdated += propertiesUpdated;
		}

		console.log(
			`\n\x1b[32m✅ Successfully updated ${totalPropertiesUpdated} properties across ${devicesToPopulate.length} device(s)\x1b[0m\n`,
		);
	}

	private async populateDevice(device: SimulatorDeviceEntity): Promise<number> {
		console.log(`  \x1b[36m→\x1b[0m ${device.name} (${device.category})`);

		let propertiesUpdated = 0;

		for (const channel of device.channels ?? []) {
			const allProperties = getAllProperties(channel.category);

			for (const property of channel.properties ?? []) {
				const propMeta = allProperties.find((p) => p.category === property.category);

				if (propMeta) {
					const value = this.deviceGeneratorService.generateRandomValue(propMeta);

					if (value !== null) {
						try {
							await this.channelsPropertiesService.update(property.id, {
								type: property.type,
								value,
							});

							propertiesUpdated++;
						} catch (error) {
							const err = error as Error;
							this.logger.warn(`Failed to update property ${property.id}: ${err.message}`);
						}
					}
				}
			}
		}

		console.log(`    \x1b[32m✓\x1b[0m Updated ${propertiesUpdated} properties`);

		return propertiesUpdated;
	}

	private listDevices(devices: SimulatorDeviceEntity[]): void {
		console.log('\n\x1b[36m📋 Simulator Devices:\x1b[0m\n');

		for (const device of devices) {
			const channelCount = device.channels?.length || 0;
			const propertyCount = device.channels?.reduce((sum, ch) => sum + (ch.properties?.length || 0), 0) || 0;

			console.log(`  \x1b[1m${device.name}\x1b[0m`);
			console.log(`    ID: ${device.id}`);
			console.log(`    Category: ${device.category}`);
			console.log(`    Channels: ${channelCount}`);
			console.log(`    Properties: ${propertyCount}`);
			console.log('');
		}

		console.log('\x1b[36mUsage examples:\x1b[0m');
		console.log('  pnpm run cli simulator:populate --all                    # Populate all devices');
		console.log('  pnpm run cli simulator:populate --device <device-id>     # Populate specific device');
		console.log('  pnpm run cli simulator:populate                          # Interactive mode\n');
	}
}
