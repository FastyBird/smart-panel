import { Injectable, OnModuleInit } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConnectionState, DeviceCategory } from '../../../modules/devices/devices.constants';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { ExtensionActionRegistryService } from '../../../modules/extensions/services/extension-action-registry.service';
import {
	ActionCategory,
	ActionParameterType,
	type IActionResult,
	IExtensionAction,
} from '../../../modules/extensions/services/extension-action.interface';
import { GenerateDeviceDto } from '../dto/generate-device.dto';
import { SimulatorDeviceEntity } from '../entities/simulator.entity';
import { SIMULATOR_PLUGIN_NAME, SIMULATOR_TYPE } from '../simulator.constants';

import { DeviceGeneratorService } from './device-generator.service';
import { ScenarioExecutorService } from './scenario-executor.service';
import { ScenarioLoaderService } from './scenario-loader.service';
import { SimulationService } from './simulation.service';

/**
 * Registers extension actions for the Simulator plugin.
 *
 * Makes CLI-only functionality accessible from the admin UI:
 * - Load scenario (with dynamic scenario list)
 * - Generate devices
 * - Simulate all devices
 * - Start/stop auto-simulation
 * - Set connection state for all devices
 */
@Injectable()
export class SimulatorActionsService implements OnModuleInit {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		SIMULATOR_PLUGIN_NAME,
		'SimulatorActionsService',
	);

	constructor(
		private readonly actionRegistry: ExtensionActionRegistryService,
		private readonly scenarioLoader: ScenarioLoaderService,
		private readonly scenarioExecutor: ScenarioExecutorService,
		private readonly simulationService: SimulationService,
		private readonly deviceGeneratorService: DeviceGeneratorService,
		private readonly devicesService: DevicesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
	) {}

	onModuleInit(): void {
		this.registerActions();
	}

	private registerActions(): void {
		const actions: IExtensionAction[] = [
			this.createLoadScenarioAction(),
			this.createGenerateDeviceAction(),
			this.createSimulateAllAction(),
			this.createStartAutoSimulationAction(),
			this.createStopAutoSimulationAction(),
			this.createSetConnectionStateAction(),
		];

		for (const action of actions) {
			this.actionRegistry.register(SIMULATOR_PLUGIN_NAME, action);
		}

		this.logger.log(`Registered ${actions.length} actions`);
	}

	private createLoadScenarioAction(): IExtensionAction {
		return {
			id: 'load-scenario',
			label: 'Load Scenario',
			description: 'Load a predefined or custom device scenario from YAML files',
			icon: 'mdi:file-document-outline',
			category: ActionCategory.DATA,
			mode: 'immediate',
			parameters: [
				{
					name: 'scenario',
					label: 'Scenario',
					description: 'Select a scenario to load',
					type: ActionParameterType.SELECT,
					required: true,
					resolveOptions: () => {
						const scenarios = this.scenarioLoader.getAvailableScenarios();

						return Promise.resolve(
							scenarios.map((s) => ({
								label: `${s.name} (${s.source})`,
								value: s.name,
							})),
						);
					},
				},
				{
					name: 'truncate',
					label: 'Remove existing devices',
					description: 'Remove all existing simulator devices before loading the scenario',
					type: ActionParameterType.BOOLEAN,
					default: false,
				},
				{
					name: 'rooms',
					label: 'Create rooms',
					description: 'Create rooms defined in the scenario',
					type: ActionParameterType.BOOLEAN,
					default: true,
				},
				{
					name: 'scenes',
					label: 'Create scenes',
					description: 'Create scenes defined in the scenario',
					type: ActionParameterType.BOOLEAN,
					default: true,
				},
				{
					name: 'roles',
					label: 'Apply domain roles',
					description: 'Apply default domain roles (lighting, climate, sensor, covers) and media bindings',
					type: ActionParameterType.BOOLEAN,
					default: true,
				},
			],
			execute: async (params) => {
				const scenarioName = params.scenario as string;
				const truncate = params.truncate as boolean | undefined;
				const createRooms = params.rooms as boolean | undefined;
				const createScenes = params.scenes as boolean | undefined;
				const applyRoles = params.roles as boolean | undefined;

				this.logger.log(`Loading scenario '${scenarioName}'`);

				// Truncate existing devices if requested
				if (truncate) {
					const devices = await this.devicesService.findAll<SimulatorDeviceEntity>(SIMULATOR_TYPE);

					for (const device of devices) {
						await this.devicesService.remove(device.id);
					}

					this.logger.log(`Removed ${devices.length} existing simulator devices`);
				}

				const result = await this.scenarioExecutor.executeByName(scenarioName, {
					createRooms: createRooms ?? true,
					createScenes: createScenes ?? true,
					applyRoles: applyRoles ?? true,
				});

				return {
					success: true,
					message: `Scenario '${scenarioName}' loaded: ${result.devicesCreated} devices, ${result.roomsCreated} rooms, ${result.scenesCreated} scenes`,
					data: {
						devices_created: result.devicesCreated,
						rooms_created: result.roomsCreated,
						scenes_created: result.scenesCreated,
						roles_applied: result.rolesApplied,
					},
				};
			},
		};
	}

	private createGenerateDeviceAction(): IExtensionAction {
		return {
			id: 'generate-device',
			label: 'Generate Device',
			description: 'Generate a simulated device with all channels and properties',
			icon: 'mdi:plus-circle-outline',
			category: ActionCategory.DATA,
			mode: 'immediate',
			parameters: [
				{
					name: 'category',
					label: 'Device Category',
					description: 'Type of device to generate',
					type: ActionParameterType.SELECT,
					required: true,
					options: Object.values(DeviceCategory).map((cat) => ({
						label: cat
							.split('_')
							.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
							.join(' '),
						value: cat,
					})),
				},
				{
					name: 'name',
					label: 'Device Name',
					description: 'Custom name for the device (leave empty for auto-generated)',
					type: ActionParameterType.STRING,
				},
				{
					name: 'count',
					label: 'Count',
					description: 'Number of devices to generate',
					type: ActionParameterType.NUMBER,
					default: 1,
					validation: { min: 1, max: 50 },
				},
				{
					name: 'auto_simulate',
					label: 'Auto-simulate',
					description: 'Enable automatic value simulation for the device',
					type: ActionParameterType.BOOLEAN,
					default: false,
				},
			],
			execute: async (params) => {
				const category = params.category as DeviceCategory;
				const name = (params.name as string) || undefined;
				const count = (params.count as number) || 1;
				const autoSimulate = params.auto_simulate as boolean | undefined;

				const createdDevices: string[] = [];

				for (let i = 0; i < count; i++) {
					const deviceName = name ? (count > 1 ? `${name} ${i + 1}` : name) : `Simulated ${category} ${Date.now()}`;

					const dto = new GenerateDeviceDto();
					dto.category = category;
					dto.name = deviceName;
					dto.auto_simulate = autoSimulate ?? false;

					const generatedData = this.deviceGeneratorService.generateDevice(dto);

					const device = await this.devicesService.create<SimulatorDeviceEntity, any>({
						...generatedData,
					});

					await this.deviceConnectivityService.setConnectionState(device.id, {
						state: ConnectionState.CONNECTED,
						reason: 'Simulator device generated via action',
					});

					createdDevices.push(device.id);
				}

				return {
					success: true,
					message: `Generated ${createdDevices.length} ${category} device(s)`,
					data: { device_ids: createdDevices },
				};
			},
		};
	}

	private createSimulateAllAction(): IExtensionAction {
		return {
			id: 'simulate-all',
			label: 'Simulate All Devices',
			description: 'Generate realistic values for all simulator devices once',
			icon: 'mdi:refresh',
			category: ActionCategory.SIMULATION,
			mode: 'immediate',
			execute: async () => {
				const result = await this.simulationService.simulateAllDevices();

				return {
					success: true,
					message: `Simulated ${result.devicesSimulated} devices, updated ${result.propertiesUpdated} properties`,
					data: {
						devices_simulated: result.devicesSimulated,
						properties_updated: result.propertiesUpdated,
					},
				};
			},
		};
	}

	private createStartAutoSimulationAction(): IExtensionAction {
		return {
			id: 'start-auto-simulation',
			label: 'Start Auto-Simulation',
			description: 'Start automatic periodic simulation of all devices',
			icon: 'mdi:play',
			category: ActionCategory.SIMULATION,
			mode: 'immediate',
			parameters: [
				{
					name: 'interval',
					label: 'Interval (ms)',
					description: 'How often to update simulated values (in milliseconds)',
					type: ActionParameterType.NUMBER,
					default: 5000,
					validation: { min: 1000, max: 300000 },
				},
			],
			execute: (params): Promise<IActionResult> => {
				const interval = (params.interval as number) || 5000;

				this.simulationService.configure({ simulationInterval: interval });
				this.simulationService.startAutoSimulation();

				return Promise.resolve({
					success: true,
					message: `Auto-simulation started with ${interval}ms interval`,
				});
			},
		};
	}

	private createStopAutoSimulationAction(): IExtensionAction {
		return {
			id: 'stop-auto-simulation',
			label: 'Stop Auto-Simulation',
			description: 'Stop automatic periodic simulation',
			icon: 'mdi:stop',
			category: ActionCategory.SIMULATION,
			mode: 'immediate',
			execute: (): Promise<IActionResult> => {
				this.simulationService.stopAutoSimulation();

				return Promise.resolve({
					success: true,
					message: 'Auto-simulation stopped',
				});
			},
		};
	}

	private createSetConnectionStateAction(): IExtensionAction {
		return {
			id: 'set-connection-state',
			label: 'Set Connection State',
			description: 'Change the connection state of all simulator devices',
			icon: 'mdi:connection',
			category: ActionCategory.SIMULATION,
			mode: 'immediate',
			dangerous: true,
			parameters: [
				{
					name: 'state',
					label: 'Connection State',
					description: 'Target connection state for all simulator devices',
					type: ActionParameterType.SELECT,
					required: true,
					options: Object.values(ConnectionState).map((state) => ({
						label: state.charAt(0).toUpperCase() + state.slice(1),
						value: state,
					})),
				},
			],
			execute: async (params) => {
				const state = params.state as ConnectionState;
				const devices = await this.devicesService.findAll<SimulatorDeviceEntity>(SIMULATOR_TYPE);

				for (const device of devices) {
					await this.deviceConnectivityService.setConnectionState(device.id, {
						state,
						reason: `Set via admin action`,
					});
				}

				return {
					success: true,
					message: `Set ${devices.length} devices to '${state}'`,
					data: { devices_updated: devices.length },
				};
			},
		};
	}
}
