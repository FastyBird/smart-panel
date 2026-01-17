import inquirer from 'inquirer';
import { Command, CommandRunner, Option } from 'nest-commander';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_SIMULATOR_PLUGIN_NAME, DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';

interface SetConnectionStateOptions {
	device?: string;
	state?: ConnectionState;
	all?: boolean;
	list?: boolean;
}

@Command({
	name: 'simulator:connection',
	description: 'Set connection state for simulated devices',
})
@Injectable()
export class SetConnectionStateCommand extends CommandRunner {
	private readonly logger = createExtensionLogger(DEVICES_SIMULATOR_PLUGIN_NAME, 'SetConnectionStateCommand');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
	) {
		super();
	}

	@Option({
		flags: '-d, --device <deviceId>',
		description: 'Specific device ID to update',
	})
	parseDevice(val: string): string {
		return val;
	}

	@Option({
		flags: '-s, --state <state>',
		description: 'Connection state to set (connected, disconnected, lost, alert, etc.)',
	})
	parseState(val: string): ConnectionState | undefined {
		const validStates = Object.values(ConnectionState);
		if (validStates.includes(val as ConnectionState)) {
			return val as ConnectionState;
		}
		console.error(`\n\x1b[31m❌ Invalid connection state: ${val}\x1b[0m`);
		console.log(`\nValid states: ${validStates.join(', ')}\n`);
		process.exit(1);
	}

	@Option({
		flags: '-a, --all',
		description: 'Update all simulator devices',
		defaultValue: false,
	})
	parseAll(): boolean {
		return true;
	}

	@Option({
		flags: '-l, --list',
		description: 'List all simulator devices with their current connection state',
		defaultValue: false,
	})
	parseList(): boolean {
		return true;
	}

	async run(_passedParams: string[], options?: SetConnectionStateOptions): Promise<void> {
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

		let devicesToUpdate: SimulatorDeviceEntity[] = [];
		let connectionState: ConnectionState | undefined = options?.state;

		if (options?.all) {
			// Update all devices
			devicesToUpdate = allDevices;
		} else if (options?.device) {
			// Find specific device
			const device = allDevices.find((d) => d.id === options.device);

			if (!device) {
				console.error(`\n\x1b[31m❌ Device not found: ${options.device}\x1b[0m\n`);
				console.log('Use --list to see available simulator devices.\n');
				process.exit(1);
			}

			devicesToUpdate = [device];
		} else {
			// Interactive mode - let user select devices
			const choices = allDevices.map((device) => ({
				name: `${device.name} (${device.category}) - ${device.id} [${device.status.status}]`,
				value: device.id,
			}));

			const answers = await inquirer.prompt<{ deviceIds: string[] }>([
				{
					type: 'checkbox',
					name: 'deviceIds',
					message: 'Select devices to update connection state:',
					choices: [{ name: 'All devices', value: '__all__' }, new inquirer.Separator(), ...choices],
					pageSize: 15,
					validate: (input) => input.length > 0 || 'Please select at least one device',
				},
			]);

			if (answers.deviceIds.includes('__all__')) {
				devicesToUpdate = allDevices;
			} else {
				devicesToUpdate = allDevices.filter((d) => answers.deviceIds.includes(d.id));
			}
		}

		// If state not provided, ask interactively
		if (!connectionState) {
			const stateChoices = Object.values(ConnectionState).map((state) => ({
				name: this.formatStateName(state),
				value: state,
			}));

			const stateAnswer = await inquirer.prompt<{ state: ConnectionState }>([
				{
					type: 'list',
					name: 'state',
					message: 'Select connection state:',
					choices: stateChoices,
					default: ConnectionState.CONNECTED,
				},
			]);

			connectionState = stateAnswer.state;
		}

		console.log(
			`\n\x1b[36m🔗 Setting connection state to "${connectionState}" for ${devicesToUpdate.length} device(s)...\x1b[0m\n`,
		);

		let successCount = 0;

		for (const device of devicesToUpdate) {
			try {
				await this.deviceConnectivityService.setConnectionState(device.id, {
					state: connectionState,
					reason: 'Connection state set via CLI',
				});

				console.log(`  \x1b[32m✓\x1b[0m ${device.name} - ${connectionState}`);
				successCount++;
			} catch (error) {
				const err = error as Error;
				console.error(`  \x1b[31m✗\x1b[0m ${device.name} - Failed: ${err.message}`);
				this.logger.warn(`Failed to set connection state for device ${device.id}: ${err.message}`);
			}
		}

		console.log(
			`\n\x1b[32m✅ Successfully updated ${successCount}/${devicesToUpdate.length} device(s) to "${connectionState}"\x1b[0m\n`,
		);
	}

	private listDevices(devices: SimulatorDeviceEntity[]): void {
		console.log('\n\x1b[36m📋 Simulator Devices:\x1b[0m\n');

		for (const device of devices) {
			const statusColor = device.status.online ? '\x1b[32m' : '\x1b[31m';
			const statusIcon = device.status.online ? '●' : '○';

			console.log(`  \x1b[1m${device.name}\x1b[0m`);
			console.log(`    ID: ${device.id}`);
			console.log(`    Category: ${device.category}`);
			console.log(`    Status: ${statusColor}${statusIcon} ${device.status.status}\x1b[0m`);
			console.log('');
		}

		console.log('\x1b[36mAvailable connection states:\x1b[0m');
		Object.values(ConnectionState).forEach((state) => {
			console.log(`  • ${state}`);
		});
		console.log('');

		console.log('\x1b[36mUsage examples:\x1b[0m');
		console.log('  pnpm run cli simulator:connection --all --state connected        # Set all devices to connected');
		console.log('  pnpm run cli simulator:connection --device <id> --state lost     # Set specific device to lost');
		console.log('  pnpm run cli simulator:connection                                # Interactive mode\n');
	}

	private formatStateName(state: ConnectionState): string {
		const stateIcons: Record<ConnectionState, string> = {
			[ConnectionState.CONNECTED]: '🟢',
			[ConnectionState.DISCONNECTED]: '⚫',
			[ConnectionState.INIT]: '🔄',
			[ConnectionState.READY]: '🟡',
			[ConnectionState.RUNNING]: '🔵',
			[ConnectionState.SLEEPING]: '😴',
			[ConnectionState.STOPPED]: '🛑',
			[ConnectionState.LOST]: '❌',
			[ConnectionState.ALERT]: '⚠️',
			[ConnectionState.UNKNOWN]: '❓',
		};

		return `${stateIcons[state]} ${state}`;
	}
}
