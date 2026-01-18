import inquirer from 'inquirer';
import { Command, CommandRunner, Option } from 'nest-commander';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_SIMULATOR_PLUGIN_NAME, DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';
import { SimulationService } from '../services/simulation.service';

interface SimulateCommandOptions {
	device?: string;
	all?: boolean;
	list?: boolean;
	config?: boolean;
	start?: boolean;
	stop?: boolean;
	interval?: number;
	latitude?: number;
	updateOnStart?: boolean;
}

@Command({
	name: 'simulator:simulate',
	description: 'Run realistic device simulation with time-based and environmental patterns',
})
@Injectable()
export class SimulateCommand extends CommandRunner {
	private readonly logger = createExtensionLogger(DEVICES_SIMULATOR_PLUGIN_NAME, 'SimulateCommand');

	constructor(
		private readonly simulationService: SimulationService,
		private readonly devicesService: DevicesService,
	) {
		super();
	}

	@Option({
		flags: '-d, --device <deviceId>',
		description: 'Simulate a specific device by ID',
	})
	parseDevice(val: string): string {
		return val;
	}

	@Option({
		flags: '-a, --all',
		description: 'Simulate all simulator devices',
		defaultValue: false,
	})
	parseAll(): boolean {
		return true;
	}

	@Option({
		flags: '-l, --list',
		description: 'List all simulator devices and their supported simulators',
		defaultValue: false,
	})
	parseList(): boolean {
		return true;
	}

	@Option({
		flags: '-c, --config',
		description: 'Show current simulation configuration',
		defaultValue: false,
	})
	parseConfig(): boolean {
		return true;
	}

	@Option({
		flags: '--start',
		description: 'Start automatic simulation',
		defaultValue: false,
	})
	parseStart(): boolean {
		return true;
	}

	@Option({
		flags: '--stop',
		description: 'Stop automatic simulation',
		defaultValue: false,
	})
	parseStop(): boolean {
		return true;
	}

	@Option({
		flags: '-i, --interval <ms>',
		description: 'Set simulation interval in milliseconds (use with --start)',
	})
	parseInterval(val: string): number {
		const num = parseInt(val, 10);
		if (isNaN(num) || num < 0) {
			console.error('\n\x1b[31m❌ Interval must be a non-negative number\x1b[0m\n');
			process.exit(1);
		}
		return num;
	}

	@Option({
		flags: '--latitude <degrees>',
		description: 'Set latitude for location-based simulation (-90 to 90)',
	})
	parseLatitude(val: string): number {
		const num = parseFloat(val);
		if (isNaN(num) || num < -90 || num > 90) {
			console.error('\n\x1b[31m❌ Latitude must be between -90 and 90\x1b[0m\n');
			process.exit(1);
		}
		return num;
	}

	@Option({
		flags: '--update-on-start <boolean>',
		description: 'Set whether to update values on service start',
	})
	parseUpdateOnStart(val: string): boolean {
		return val.toLowerCase() === 'true' || val === '1';
	}

	async run(_passedParams: string[], options?: SimulateCommandOptions): Promise<void> {
		// Show configuration
		if (options?.config) {
			this.showConfig();
			return;
		}

		// Start auto-simulation
		if (options?.start) {
			await this.startAutoSimulation(options);
			return;
		}

		// Stop auto-simulation
		if (options?.stop) {
			this.stopAutoSimulation();
			return;
		}

		// Get all simulator devices
		const allDevices = await this.devicesService.findAll<SimulatorDeviceEntity>(DEVICES_SIMULATOR_TYPE);

		if (allDevices.length === 0) {
			console.log('\n\x1b[33m⚠️  No simulator devices found.\x1b[0m');
			console.log('Use \x1b[36msimulator:generate\x1b[0m to create simulated devices first.\n');
			return;
		}

		// List devices
		if (options?.list) {
			this.listDevices(allDevices);
			return;
		}

		// Update configuration if provided
		if (options?.interval !== undefined || options?.latitude !== undefined || options?.updateOnStart !== undefined) {
			this.simulationService.configure({
				...(options.interval !== undefined && { simulationInterval: options.interval }),
				...(options.latitude !== undefined && { latitude: options.latitude }),
				...(options.updateOnStart !== undefined && { updateOnStart: options.updateOnStart }),
			});
			console.log('\n\x1b[32m✓ Configuration updated\x1b[0m');
			this.showConfig();
		}

		// Simulate specific device
		if (options?.device) {
			const device = allDevices.find((d) => d.id === options.device);
			if (!device) {
				console.error(`\n\x1b[31m❌ Device not found: ${options.device}\x1b[0m\n`);
				console.log('Use --list to see available simulator devices.\n');
				process.exit(1);
			}
			await this.simulateDevice(device);
			return;
		}

		// Simulate all devices
		if (options?.all) {
			await this.simulateAllDevices();
			return;
		}

		// Interactive mode
		await this.interactiveMode(allDevices);
	}

	private showConfig(): void {
		const config = this.simulationService.getConfig();
		const supportedCategories = this.simulationService.getSupportedCategories();
		const isRunning = this.simulationService.isAutoSimulationRunning();

		console.log('\n\x1b[36m⚙️  Simulation Configuration:\x1b[0m\n');
		console.log(`  Update on start:    ${config.updateOnStart ? '\x1b[32mYes\x1b[0m' : '\x1b[33mNo\x1b[0m'}`);
		console.log(
			`  Simulation interval: ${config.simulationInterval > 0 ? `${config.simulationInterval}ms` : '\x1b[33mDisabled\x1b[0m'}`,
		);
		console.log(`  Latitude:           ${config.latitude}°`);
		console.log(`  Smooth transitions: ${config.smoothTransitions ? '\x1b[32mYes\x1b[0m' : '\x1b[33mNo\x1b[0m'}`);
		console.log(`  Auto-simulation:    ${isRunning ? '\x1b[32mRunning\x1b[0m' : '\x1b[33mStopped\x1b[0m'}`);
		console.log(`\n\x1b[36m📋 Supported Device Categories:\x1b[0m\n`);
		console.log(`  ${supportedCategories.join(', ')}\n`);
	}

	private async startAutoSimulation(options: SimulateCommandOptions): Promise<void> {
		// Configure interval if provided
		if (options.interval !== undefined) {
			this.simulationService.configure({ simulationInterval: options.interval });
		}

		const config = this.simulationService.getConfig();
		if (config.simulationInterval <= 0) {
			console.error('\n\x1b[31m❌ Cannot start auto-simulation: interval must be greater than 0\x1b[0m');
			console.log('Use --interval <ms> to set the simulation interval.\n');
			process.exit(1);
		}

		// Run initial simulation
		console.log('\n\x1b[36m🎲 Running initial simulation...\x1b[0m\n');
		const result = await this.simulationService.simulateAllDevices();
		console.log(
			`\x1b[32m✓\x1b[0m Simulated ${result.devicesSimulated} devices, updated ${result.propertiesUpdated} properties`,
		);

		// Start auto-simulation
		this.simulationService.startAutoSimulation();
		console.log(`\n\x1b[32m✓ Auto-simulation started with interval: ${config.simulationInterval}ms\x1b[0m\n`);
		console.log('Press Ctrl+C to stop the process.\n');

		// Keep the process alive
		await new Promise(() => {
			// This promise never resolves, keeping the process running
		});
	}

	private stopAutoSimulation(): void {
		if (!this.simulationService.isAutoSimulationRunning()) {
			console.log('\n\x1b[33m⚠️  Auto-simulation is not running.\x1b[0m\n');
			return;
		}

		this.simulationService.stopAutoSimulation();
		console.log('\n\x1b[32m✓ Auto-simulation stopped.\x1b[0m\n');
	}

	private listDevices(devices: SimulatorDeviceEntity[]): void {
		console.log('\n\x1b[36m📋 Simulator Devices:\x1b[0m\n');

		const supportedCategories = this.simulationService.getSupportedCategories();

		for (const device of devices) {
			const channelCount = device.channels?.length || 0;
			const propertyCount = device.channels?.reduce((sum, ch) => sum + (ch.properties?.length || 0), 0) || 0;
			const hasSimulator = this.simulationService.hasSimulator(device.category);

			console.log(`  \x1b[1m${device.name}\x1b[0m`);
			console.log(`    ID:        ${device.id}`);
			console.log(`    Category:  ${device.category}`);
			console.log(`    Simulator: ${hasSimulator ? '\x1b[32mRealistic\x1b[0m' : '\x1b[33mGeneric\x1b[0m'}`);
			console.log(`    Channels:  ${channelCount}`);
			console.log(`    Props:     ${propertyCount}`);
			console.log('');
		}

		console.log('\x1b[36mCategories with realistic simulators:\x1b[0m');
		console.log(`  ${supportedCategories.join(', ')}\n`);

		console.log('\x1b[36mUsage examples:\x1b[0m');
		console.log('  pnpm run cli simulator:simulate --all                    # Simulate all devices once');
		console.log('  pnpm run cli simulator:simulate --device <id>            # Simulate specific device');
		console.log('  pnpm run cli simulator:simulate --config                 # Show configuration');
		console.log('  pnpm run cli simulator:simulate --start --interval 5000  # Start auto-simulation (5s)');
		console.log('  pnpm run cli simulator:simulate --stop                   # Stop auto-simulation');
		console.log('  pnpm run cli simulator:simulate                          # Interactive mode\n');
	}

	private async simulateDevice(device: SimulatorDeviceEntity): Promise<void> {
		const hasSimulator = this.simulationService.hasSimulator(device.category);

		console.log(`\n\x1b[36m🎲 Simulating ${device.name} (${device.category})...\x1b[0m`);
		console.log(`   Using: ${hasSimulator ? '\x1b[32mRealistic simulator\x1b[0m' : '\x1b[33mGeneric values\x1b[0m'}\n`);

		const result = await this.simulationService.simulateDevice(device);

		if (result.success) {
			console.log(`\x1b[32m✓ Updated ${result.propertiesUpdated} properties\x1b[0m\n`);
		} else {
			console.error(`\x1b[31m✗ Simulation failed\x1b[0m\n`);
		}
	}

	private async simulateAllDevices(): Promise<void> {
		console.log('\n\x1b[36m🎲 Simulating all devices with realistic patterns...\x1b[0m\n');

		const result = await this.simulationService.simulateAllDevices();

		console.log(
			`\n\x1b[32m✅ Simulation complete: ${result.devicesSimulated} devices, ${result.propertiesUpdated} properties updated\x1b[0m\n`,
		);
	}

	private async interactiveMode(devices: SimulatorDeviceEntity[]): Promise<void> {
		const deviceChoices = devices.map((device) => {
			const hasSimulator = this.simulationService.hasSimulator(device.category);
			const simulatorLabel = hasSimulator ? '\x1b[32m[Realistic]\x1b[0m' : '\x1b[33m[Generic]\x1b[0m';
			return {
				name: `${device.name} (${device.category}) ${simulatorLabel}`,
				value: device.id,
			};
		});

		const answers = await inquirer.prompt<{ action: string; deviceIds?: string[] }>([
			{
				type: 'list',
				name: 'action',
				message: 'What would you like to do?',
				choices: [
					{ name: 'Simulate all devices', value: 'all' },
					{ name: 'Simulate specific devices', value: 'select' },
					{ name: 'Show configuration', value: 'config' },
					{ name: 'Start auto-simulation', value: 'start' },
					new inquirer.Separator(),
					{ name: 'Cancel', value: 'cancel' },
				],
			},
			{
				type: 'checkbox',
				name: 'deviceIds',
				message: 'Select devices to simulate:',
				choices: deviceChoices,
				when: (answers) => answers.action === 'select',
				pageSize: 15,
				validate: (input) => input.length > 0 || 'Please select at least one device',
			},
		]);

		switch (answers.action) {
			case 'all':
				await this.simulateAllDevices();
				break;
			case 'select':
				for (const deviceId of answers.deviceIds || []) {
					const device = devices.find((d) => d.id === deviceId);
					if (device) {
						await this.simulateDevice(device);
					}
				}
				break;
			case 'config':
				this.showConfig();
				break;
			case 'start': {
				const intervalAnswer = await inquirer.prompt<{ interval: number }>([
					{
						type: 'number',
						name: 'interval',
						message: 'Simulation interval in milliseconds:',
						default: 5000,
						validate: (input) => (input > 0 ? true : 'Interval must be greater than 0'),
					},
				]);
				this.simulationService.configure({ simulationInterval: intervalAnswer.interval });
				await this.startAutoSimulation({ interval: intervalAnswer.interval });
				break;
			}
			case 'cancel':
			default:
				console.log('\n\x1b[33mOperation cancelled.\x1b[0m\n');
		}
	}
}
