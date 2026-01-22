import inquirer from 'inquirer';
import { Command, CommandRunner, Option } from 'nest-commander';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConnectionState, DeviceCategory } from '../../../modules/devices/devices.constants';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { getDeviceSpec } from '../../../modules/devices/utils/schema.utils';
import { DEVICES_SIMULATOR_PLUGIN_NAME } from '../devices-simulator.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';
import { DeviceGeneratorService } from '../services/device-generator.service';

interface GenerateDeviceOptions {
	category?: string;
	name?: string;
	count?: number;
	requiredOnly?: boolean;
	autoSimulate?: boolean;
	interval?: number;
	list?: boolean;
}

@Command({
	name: 'simulator:generate',
	description: 'Generate simulated devices for testing',
})
@Injectable()
export class GenerateDeviceCommand extends CommandRunner {
	private readonly logger = createExtensionLogger(DEVICES_SIMULATOR_PLUGIN_NAME, 'GenerateDeviceCommand');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly deviceGeneratorService: DeviceGeneratorService,
	) {
		super();
	}

	@Option({
		flags: '-c, --category <category>',
		description: 'Device category to generate (e.g., lighting, thermostat, sensor)',
	})
	parseCategory(val: string): string {
		return val.toLowerCase();
	}

	@Option({
		flags: '-n, --name <name>',
		description: 'Name for the generated device',
	})
	parseName(val: string): string {
		return val;
	}

	@Option({
		flags: '--count <count>',
		description: 'Number of devices to generate (default: 1)',
		defaultValue: 1,
	})
	parseCount(val: string): number {
		return parseInt(val, 10);
	}

	@Option({
		flags: '--required-only',
		description: 'Only include required channels and properties',
		defaultValue: false,
	})
	parseRequiredOnly(): boolean {
		return true;
	}

	@Option({
		flags: '--auto-simulate',
		description: 'Enable auto-simulation of values',
		defaultValue: false,
	})
	parseAutoSimulate(): boolean {
		return true;
	}

	@Option({
		flags: '--interval <ms>',
		description: 'Auto-simulation interval in milliseconds (default: 5000)',
		defaultValue: 5000,
	})
	parseInterval(val: string): number {
		return parseInt(val, 10);
	}

	@Option({
		flags: '-l, --list',
		description: 'List all available device categories',
		defaultValue: false,
	})
	parseList(): boolean {
		return true;
	}

	async run(_passedParams: string[], options?: GenerateDeviceOptions): Promise<void> {
		// List categories if requested
		if (options?.list) {
			this.listCategories();
			return;
		}

		let category = options?.category;
		let name = options?.name;
		const count = options?.count || 1;

		// Interactive mode if category not provided
		if (!category) {
			const categories = Object.values(DeviceCategory);

			const answers = await inquirer.prompt<{ category: DeviceCategory; name: string; count: number }>([
				{
					type: 'list',
					name: 'category',
					message: 'Select device category:',
					choices: categories.map((cat) => ({
						name: `${this.formatCategoryName(cat)} (${cat})`,
						value: cat,
					})),
					pageSize: 15,
				},
				{
					type: 'input',
					name: 'name',
					message: 'Device name (leave empty for auto-generated):',
					default: '',
				},
				{
					type: 'number',
					name: 'count',
					message: 'How many devices to generate?',
					default: 1,
					validate: (input) => (input > 0 && input <= 100) || 'Please enter a number between 1 and 100',
				},
			]);

			category = answers.category;
			name = answers.name || undefined;
			options = { ...options, count: answers.count };
		}

		// Validate category
		const deviceCategory = category as DeviceCategory;
		if (!Object.values(DeviceCategory).includes(deviceCategory)) {
			console.error(`\n\x1b[31m❌ Invalid category: ${category}\x1b[0m`);
			console.log('\nUse --list to see available categories\n');
			process.exit(1);
		}

		console.log(`\n\x1b[36m🔧 Generating ${options?.count || count} simulated ${category} device(s)...\x1b[0m\n`);

		const createdDevices: SimulatorDeviceEntity[] = [];

		for (let i = 0; i < (options?.count || count); i++) {
			const deviceName = name || `Simulated ${this.formatCategoryName(deviceCategory)} ${i + 1}`;

			try {
				const generatedData = this.deviceGeneratorService.generateDevice({
					category: deviceCategory,
					name: deviceName,
					required_channels_only: options?.requiredOnly || false,
					required_properties_only: options?.requiredOnly || false,
					auto_simulate: options?.autoSimulate || false,
					simulate_interval: options?.interval || 5000,
				});

				const device = await this.devicesService.create<SimulatorDeviceEntity, any>(generatedData);

				// Set initial connection state
				await this.deviceConnectivityService.setConnectionState(device.id, {
					state: ConnectionState.CONNECTED,
					reason: 'Simulator device created via CLI',
				});

				createdDevices.push(device);

				console.log(`  \x1b[32m✓\x1b[0m Created: \x1b[1m${deviceName}\x1b[0m (${device.id})`);
				console.log(`    Channels: ${device.channels.length}`);

				const propertyCount = device.channels.reduce((sum, ch) => sum + (ch.properties?.length || 0), 0);
				console.log(`    Properties: ${propertyCount}`);
			} catch (error) {
				const err = error as Error;
				console.error(`  \x1b[31m✗\x1b[0m Failed to create ${deviceName}: ${err.message}`);
				this.logger.error(`Failed to generate device: ${err.message}`, { stack: err.stack });
			}
		}

		if (createdDevices.length > 0) {
			console.log(`\n\x1b[32m✅ Successfully created ${createdDevices.length} simulated device(s)\x1b[0m\n`);

			// Show summary table
			console.log('\x1b[36mDevice IDs:\x1b[0m');
			createdDevices.forEach((device) => {
				console.log(`  • ${device.id} - ${device.name}`);
			});
			console.log('');
		}
	}

	private listCategories(): void {
		console.log('\n\x1b[36m📋 Available Device Categories:\x1b[0m\n');

		const categories = Object.values(DeviceCategory);

		for (const category of categories) {
			const spec = getDeviceSpec(category);
			const channelCount = spec?.channels ? Object.keys(spec.channels).length : 0;

			console.log(`  \x1b[1m${category}\x1b[0m`);
			console.log(`    Name: ${this.formatCategoryName(category)}`);
			console.log(`    Channels: ${channelCount}`);
			console.log('');
		}

		console.log('\x1b[36mUsage examples:\x1b[0m');
		console.log('  pnpm run cli simulator:generate --category lighting --name "Test Light"');
		console.log('  pnpm run cli simulator:generate --category thermostat --count 3');
		console.log('  pnpm run cli simulator:generate  # Interactive mode\n');
	}

	private formatCategoryName(category: DeviceCategory): string {
		return category
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}
}
