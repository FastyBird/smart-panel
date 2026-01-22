/**
 * Scenario Command
 *
 * CLI command to load predefined device scenarios for testing.
 */
import inquirer from 'inquirer';
import { Command, CommandRunner, Option } from 'nest-commander';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_SIMULATOR_PLUGIN_NAME, DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';
import { ScenarioLoadResult } from '../scenarios/scenario.types';
import { ScenarioExecutorService } from '../services/scenario-executor.service';
import { ScenarioLoaderService } from '../services/scenario-loader.service';

interface ScenarioCommandOptions {
	list?: boolean;
	scenario?: string;
	file?: string;
	truncate?: boolean;
	noRooms?: boolean;
	dryRun?: boolean;
}

@Command({
	name: 'simulator:scenario',
	description: 'Load a predefined device scenario for testing',
})
@Injectable()
export class ScenarioCommand extends CommandRunner {
	private readonly logger = createExtensionLogger(DEVICES_SIMULATOR_PLUGIN_NAME, 'ScenarioCommand');

	constructor(
		private readonly scenarioLoader: ScenarioLoaderService,
		private readonly scenarioExecutor: ScenarioExecutorService,
		private readonly devicesService: DevicesService,
	) {
		super();
	}

	@Option({
		flags: '-l, --list',
		description: 'List available scenarios',
		defaultValue: false,
	})
	parseList(): boolean {
		return true;
	}

	@Option({
		flags: '-s, --scenario <name>',
		description: 'Scenario name to load (e.g., small-apartment, penthouse)',
	})
	parseScenario(val: string): string {
		return val;
	}

	@Option({
		flags: '-f, --file <path>',
		description: 'Path to custom YAML scenario file',
	})
	parseFile(val: string): string {
		return val;
	}

	@Option({
		flags: '--truncate',
		description: 'Remove all existing simulator devices before loading',
		defaultValue: false,
	})
	parseTruncate(): boolean {
		return true;
	}

	@Option({
		flags: '--no-rooms',
		description: 'Skip creating rooms defined in scenario',
		defaultValue: false,
	})
	parseNoRooms(): boolean {
		return true;
	}

	@Option({
		flags: '--dry-run',
		description: 'Show what would be created without making changes',
		defaultValue: false,
	})
	parseDryRun(): boolean {
		return true;
	}

	async run(_passedParams: string[], options?: ScenarioCommandOptions): Promise<void> {
		// List scenarios if requested
		if (options?.list) {
			this.listScenarios();
			return;
		}

		// If no scenario specified, enter interactive mode
		if (!options?.scenario && !options?.file) {
			await this.runInteractive();
			return;
		}

		// Execute scenario
		await this.executeScenario(options);
	}

	/**
	 * List all available scenarios
	 */
	private listScenarios(): void {
		const scenarios = this.scenarioLoader.getAvailableScenarios();

		console.log('\n\x1b[36m📋 Available Scenarios:\x1b[0m\n');

		if (scenarios.length === 0) {
			console.log('  No scenarios found.\n');
			console.log(`  Builtin path: ${this.scenarioLoader.getBuiltinScenariosPath()}`);
			console.log(`  User path: ${this.scenarioLoader.getUserScenariosPath()}\n`);
			return;
		}

		// Group by source
		const builtin = scenarios.filter((s) => s.source === 'builtin');
		const user = scenarios.filter((s) => s.source === 'user');

		if (builtin.length > 0) {
			console.log('  \x1b[1mBuiltin Scenarios:\x1b[0m');
			for (const scenario of builtin) {
				console.log(`    • ${scenario.name}`);
			}
			console.log('');
		}

		if (user.length > 0) {
			console.log('  \x1b[1mUser Scenarios:\x1b[0m');
			for (const scenario of user) {
				console.log(`    • ${scenario.name}`);
			}
			console.log('');
		}

		console.log('\x1b[36mUsage:\x1b[0m');
		console.log('  pnpm run cli simulator:scenario -s small-apartment');
		console.log('  pnpm run cli simulator:scenario -f /path/to/custom.yaml');
		console.log('  pnpm run cli simulator:scenario  # Interactive mode\n');
	}

	/**
	 * Interactive mode for scenario selection
	 */
	private async runInteractive(): Promise<void> {
		const scenarios = this.scenarioLoader.getAvailableScenarios();

		if (scenarios.length === 0) {
			console.log('\n\x1b[33m⚠ No scenarios available.\x1b[0m');
			console.log(`  Check paths: ${this.scenarioLoader.getBuiltinScenariosPath()}\n`);
			return;
		}

		// Get current simulator device count
		const existingDevices = await this.devicesService.findAll<SimulatorDeviceEntity>(DEVICES_SIMULATOR_TYPE);

		const answers = await inquirer.prompt<{
			scenario: string;
			truncate: boolean;
			createRooms: boolean;
			confirm: boolean;
		}>([
			{
				type: 'list',
				name: 'scenario',
				message: 'Select a scenario to load:',
				choices: scenarios.map((s) => ({
					name: `${s.name} (${s.source})`,
					value: s.name,
				})),
				pageSize: 15,
			},
			{
				type: 'confirm',
				name: 'truncate',
				message: `Remove existing simulator devices (${existingDevices.length} found)?`,
				default: false,
				when: () => existingDevices.length > 0,
			},
			{
				type: 'confirm',
				name: 'createRooms',
				message: 'Create rooms defined in the scenario?',
				default: true,
			},
			{
				type: 'confirm',
				name: 'confirm',
				message: 'Proceed with loading the scenario?',
				default: true,
			},
		]);

		if (!answers.confirm) {
			console.log('\n\x1b[33mCancelled.\x1b[0m\n');
			return;
		}

		await this.executeScenario({
			scenario: answers.scenario,
			truncate: answers.truncate,
			noRooms: !answers.createRooms,
		});
	}

	/**
	 * Execute the scenario based on options
	 */
	private async executeScenario(options: ScenarioCommandOptions): Promise<void> {
		// Truncate existing devices if requested
		if (options.truncate) {
			await this.truncateSimulatorDevices(options.dryRun);
		}

		// Load and show preview
		let loadResult: ScenarioLoadResult;
		if (options.file) {
			loadResult = this.scenarioLoader.loadScenarioFile(options.file);
		} else if (options.scenario) {
			loadResult = this.scenarioLoader.loadScenarioByName(options.scenario);
		} else {
			console.error('\n\x1b[31m❌ No scenario specified\x1b[0m\n');
			return;
		}

		if (!loadResult.success || !loadResult.config) {
			console.error('\n\x1b[31m❌ Failed to load scenario:\x1b[0m');
			for (const error of loadResult.errors ?? []) {
				console.error(`  • ${error}`);
			}
			console.log('');
			return;
		}

		const scenarioConfig = loadResult.config;

		// Show preview
		const preview = this.scenarioExecutor.preview(scenarioConfig);
		console.log(`\n\x1b[36m📦 Scenario: ${scenarioConfig.name}\x1b[0m`);
		if (scenarioConfig.description) {
			console.log(`  ${scenarioConfig.description}`);
		}
		console.log('');

		if (preview.rooms.length > 0 && !options.noRooms) {
			console.log(`  \x1b[1mRooms (${preview.rooms.length}):\x1b[0m`);
			for (const room of preview.rooms) {
				console.log(`    • ${room.name}`);
			}
			console.log('');
		}

		console.log(`  \x1b[1mDevices (${preview.devices.length}):\x1b[0m`);
		for (const device of preview.devices) {
			console.log(
				`    • ${device.name} (${device.category}) - ${device.channelCount} channels, ${device.propertyCount} properties`,
			);
		}
		console.log('');

		if (options.dryRun) {
			console.log('\x1b[33m[DRY RUN] No changes made.\x1b[0m\n');
			return;
		}

		// Execute
		console.log('\x1b[36m🔧 Creating devices...\x1b[0m\n');

		const result = await this.scenarioExecutor.execute(scenarioConfig, {
			createRooms: !options.noRooms,
			dryRun: options.dryRun,
		});

		if (result.success) {
			console.log(`\x1b[32m✅ Scenario loaded successfully!\x1b[0m`);
			console.log(`  Rooms created: ${result.roomsCreated}`);
			console.log(`  Devices created: ${result.devicesCreated}\n`);

			if (result.deviceIds.length > 0) {
				console.log('\x1b[36mDevice IDs:\x1b[0m');
				for (const id of result.deviceIds) {
					console.log(`  • ${id}`);
				}
				console.log('');
			}
		} else {
			console.error(`\x1b[31m❌ Scenario completed with errors:\x1b[0m`);
			for (const error of result.errors) {
				console.error(`  • ${error}`);
			}
			console.log(`  Devices created: ${result.devicesCreated}`);
			console.log(`  Rooms created: ${result.roomsCreated}\n`);
		}
	}

	/**
	 * Remove all simulator devices
	 */
	private async truncateSimulatorDevices(dryRun?: boolean): Promise<void> {
		const devices = await this.devicesService.findAll<SimulatorDeviceEntity>(DEVICES_SIMULATOR_TYPE);

		if (devices.length === 0) {
			console.log('\n\x1b[33mNo simulator devices to remove.\x1b[0m\n');
			return;
		}

		if (dryRun) {
			console.log(`\n\x1b[33m[DRY RUN] Would remove ${devices.length} simulator devices.\x1b[0m\n`);
			return;
		}

		console.log(`\n\x1b[36m🗑 Removing ${devices.length} simulator devices...\x1b[0m\n`);

		let removed = 0;
		for (const device of devices) {
			try {
				await this.devicesService.remove(device.id);
				removed++;
				console.log(`  \x1b[32m✓\x1b[0m Removed: ${device.name}`);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`  \x1b[31m✗\x1b[0m Failed to remove ${device.name}: ${message}`);
				this.logger.error(`Failed to remove device: ${device.name}`, { error: message });
			}
		}

		console.log(`\n\x1b[32m✅ Removed ${removed} of ${devices.length} devices.\x1b[0m\n`);
	}
}
