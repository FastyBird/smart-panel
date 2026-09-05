import { Characteristic, Service } from '@homebridge/hap-nodejs';

import { PermissionType } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { HomeKitCommandDispatcher } from '../services/homekit-command.dispatcher';

import { HomeKitMapperContext, PropertyEventListener } from './homekit-mapper.interface';
import { ThermostatCoordinator } from './thermostat-coordinator';

describe('ThermostatCoordinator', () => {
	let device: DeviceEntity;
	let service: Service;
	let commandDispatcher: { dispatch: jest.Mock; dispatchBatch: jest.Mock };
	let registeredListeners: PropertyEventListener[];
	let context: HomeKitMapperContext;

	let ambientChannel: ChannelEntity;
	let ambientProp: ChannelPropertyEntity;

	let heaterChannel: ChannelEntity;
	let heaterOnProp: ChannelPropertyEntity;
	let heaterTempProp: ChannelPropertyEntity;
	let heaterStatusProp: ChannelPropertyEntity;

	let coolerChannel: ChannelEntity;
	let coolerOnProp: ChannelPropertyEntity;
	let coolerTempProp: ChannelPropertyEntity;
	let coolerStatusProp: ChannelPropertyEntity;

	beforeEach(() => {
		device = new DeviceEntity();
		device.id = 'dev-climate-1';
		device.name = 'Climate Master';

		service = new Service.Thermostat('Climate Master');

		commandDispatcher = {
			dispatch: jest.fn().mockResolvedValue(undefined),
			dispatchBatch: jest.fn().mockResolvedValue(undefined),
		};

		registeredListeners = [];
		context = {
			commandDispatcher: commandDispatcher as unknown as HomeKitCommandDispatcher,
			registerBinding: jest.fn(),
			registerPropertyListener: (listener) => registeredListeners.push(listener),
		};

		// Ambient temperature (read-only)
		ambientChannel = new ChannelEntity();
		ambientChannel.id = 'chan-ambient';
		ambientProp = new ChannelPropertyEntity();
		ambientProp.id = 'prop-ambient-temp';
		ambientProp.permissions = [PermissionType.READ_ONLY];
		ambientProp.value = new PropertyValueState(21.5);

		// Heater
		heaterChannel = new ChannelEntity();
		heaterChannel.id = 'chan-heater';
		heaterOnProp = new ChannelPropertyEntity();
		heaterOnProp.id = 'prop-heater-on';
		heaterOnProp.permissions = [PermissionType.READ_WRITE];
		heaterOnProp.value = new PropertyValueState(true);

		heaterTempProp = new ChannelPropertyEntity();
		heaterTempProp.id = 'prop-heater-temp';
		heaterTempProp.permissions = [PermissionType.READ_WRITE];
		heaterTempProp.value = new PropertyValueState(22.0);

		heaterStatusProp = new ChannelPropertyEntity();
		heaterStatusProp.id = 'prop-heater-status';
		heaterStatusProp.permissions = [PermissionType.READ_ONLY];
		heaterStatusProp.value = new PropertyValueState(false);

		// Cooler
		coolerChannel = new ChannelEntity();
		coolerChannel.id = 'chan-cooler';
		coolerOnProp = new ChannelPropertyEntity();
		coolerOnProp.id = 'prop-cooler-on';
		coolerOnProp.permissions = [PermissionType.READ_WRITE];
		coolerOnProp.value = new PropertyValueState(false);

		coolerTempProp = new ChannelPropertyEntity();
		coolerTempProp.id = 'prop-cooler-temp';
		coolerTempProp.permissions = [PermissionType.READ_WRITE];
		coolerTempProp.value = new PropertyValueState(24.0);

		coolerStatusProp = new ChannelPropertyEntity();
		coolerStatusProp.id = 'prop-cooler-status';
		coolerStatusProp.permissions = [PermissionType.READ_ONLY];
		coolerStatusProp.value = new PropertyValueState(false);
	});

	it('should configure validValues for heating-only thermostat', () => {
		new ThermostatCoordinator({
			device,
			service,
			context,
			ambientTempChannel: ambientChannel,
			ambientTempProperty: ambientProp,
			heaterChannel,
			heaterOnProperty: heaterOnProp,
			heaterTempProperty: heaterTempProp,
		});

		const targetStateChar = service.getCharacteristic(Characteristic.TargetHeatingCoolingState);
		expect(targetStateChar.props.validValues).toEqual([
			Characteristic.TargetHeatingCoolingState.OFF,
			Characteristic.TargetHeatingCoolingState.HEAT,
		]);
	});

	it('should configure validValues for cooling-only thermostat', () => {
		new ThermostatCoordinator({
			device,
			service,
			context,
			ambientTempChannel: ambientChannel,
			ambientTempProperty: ambientProp,
			coolerChannel,
			coolerOnProperty: coolerOnProp,
			coolerTempProperty: coolerTempProp,
		});

		const targetStateChar = service.getCharacteristic(Characteristic.TargetHeatingCoolingState);
		expect(targetStateChar.props.validValues).toEqual([
			Characteristic.TargetHeatingCoolingState.OFF,
			Characteristic.TargetHeatingCoolingState.COOL,
		]);
	});

	it('should configure validValues for dual heating and cooling thermostat', () => {
		new ThermostatCoordinator({
			device,
			service,
			context,
			ambientTempChannel: ambientChannel,
			ambientTempProperty: ambientProp,
			heaterChannel,
			heaterOnProperty: heaterOnProp,
			heaterTempProperty: heaterTempProp,
			coolerChannel,
			coolerOnProperty: coolerOnProp,
			coolerTempProperty: coolerTempProp,
		});

		const targetStateChar = service.getCharacteristic(Characteristic.TargetHeatingCoolingState);
		expect(targetStateChar.props.validValues).toEqual([
			Characteristic.TargetHeatingCoolingState.OFF,
			Characteristic.TargetHeatingCoolingState.HEAT,
			Characteristic.TargetHeatingCoolingState.COOL,
			Characteristic.TargetHeatingCoolingState.AUTO,
		]);
	});

	it('should use authoritative boolean status over temperature comparison', () => {
		heaterStatusProp.value = new PropertyValueState(false);

		new ThermostatCoordinator({
			device,
			service,
			context,
			ambientTempChannel: ambientChannel,
			ambientTempProperty: ambientProp,
			heaterChannel,
			heaterOnProperty: heaterOnProp,
			heaterTempProperty: heaterTempProp,
			heaterStatusProperty: heaterStatusProp,
		});

		const currentStateChar = service.getCharacteristic(Characteristic.CurrentHeatingCoolingState);
		expect(currentStateChar.value).toBe(Characteristic.CurrentHeatingCoolingState.OFF);

		heaterStatusProp.value = new PropertyValueState(true);
		for (const listener of registeredListeners) {
			listener.onPropertyChanged(heaterStatusProp, true);
		}
		expect(currentStateChar.value).toBe(Characteristic.CurrentHeatingCoolingState.HEAT);
	});

	it('should use authoritative string status over temperature comparison', () => {
		heaterStatusProp.value = new PropertyValueState('idle');

		new ThermostatCoordinator({
			device,
			service,
			context,
			ambientTempChannel: ambientChannel,
			ambientTempProperty: ambientProp,
			heaterChannel,
			heaterOnProperty: heaterOnProp,
			heaterTempProperty: heaterTempProp,
			heaterStatusProperty: heaterStatusProp,
		});

		const currentStateChar = service.getCharacteristic(Characteristic.CurrentHeatingCoolingState);
		expect(currentStateChar.value).toBe(Characteristic.CurrentHeatingCoolingState.OFF);

		for (const listener of registeredListeners) {
			listener.onPropertyChanged(heaterStatusProp, 'heating');
		}
		expect(currentStateChar.value).toBe(Characteristic.CurrentHeatingCoolingState.HEAT);
	});

	it('should fall back to temperature heuristic ONLY when status property is absent', () => {
		ambientProp.value = new PropertyValueState(18.0);
		heaterOnProp.value = new PropertyValueState(true);
		heaterTempProp.value = new PropertyValueState(22.0);

		new ThermostatCoordinator({
			device,
			service,
			context,
			ambientTempChannel: ambientChannel,
			ambientTempProperty: ambientProp,
			heaterChannel,
			heaterOnProperty: heaterOnProp,
			heaterTempProperty: heaterTempProp,
		});

		const currentStateChar = service.getCharacteristic(Characteristic.CurrentHeatingCoolingState);
		expect(currentStateChar.value).toBe(Characteristic.CurrentHeatingCoolingState.HEAT);

		for (const listener of registeredListeners) {
			listener.onPropertyChanged(ambientProp, 22.5);
		}
		expect(currentStateChar.value).toBe(Characteristic.CurrentHeatingCoolingState.OFF);
	});

	it('should isolate ambient temperature strictly as read-only from setpoints', () => {
		new ThermostatCoordinator({
			device,
			service,
			context,
			ambientTempChannel: ambientChannel,
			ambientTempProperty: ambientProp,
			heaterChannel,
			heaterOnProperty: heaterOnProp,
			heaterTempProperty: heaterTempProp,
		});

		const currentTempChar = service.getCharacteristic(Characteristic.CurrentTemperature);
		expect(currentTempChar.value).toBe(21.5);

		for (const listener of registeredListeners) {
			listener.onPropertyChanged(ambientProp, 20.0);
		}
		expect(currentTempChar.value).toBe(20.0);
	});

	it('should dispatch atomic batch command when TargetHeatingCoolingState changes', () => {
		new ThermostatCoordinator({
			device,
			service,
			context,
			ambientTempChannel: ambientChannel,
			ambientTempProperty: ambientProp,
			heaterChannel,
			heaterOnProperty: heaterOnProp,
			heaterTempProperty: heaterTempProp,
			coolerChannel,
			coolerOnProperty: coolerOnProp,
			coolerTempProperty: coolerTempProp,
		});

		const targetStateChar = service.getCharacteristic(Characteristic.TargetHeatingCoolingState);

		targetStateChar.setValue(Characteristic.TargetHeatingCoolingState.COOL);

		expect(commandDispatcher.dispatchBatch).toHaveBeenCalledWith([
			{ propertyId: 'prop-heater-on', value: false },
			{ propertyId: 'prop-cooler-on', value: true },
		]);

		targetStateChar.setValue(Characteristic.TargetHeatingCoolingState.OFF);

		expect(commandDispatcher.dispatchBatch).toHaveBeenCalledWith([
			{ propertyId: 'prop-heater-on', value: false },
			{ propertyId: 'prop-cooler-on', value: false },
		]);
	});

	it('should support AUTO mode with heating and cooling threshold temperatures', () => {
		new ThermostatCoordinator({
			device,
			service,
			context,
			ambientTempChannel: ambientChannel,
			ambientTempProperty: ambientProp,
			heaterChannel,
			heaterOnProperty: heaterOnProp,
			heaterTempProperty: heaterTempProp,
			coolerChannel,
			coolerOnProperty: coolerOnProp,
			coolerTempProperty: coolerTempProp,
		});

		const heatingThresholdChar = service.getCharacteristic(Characteristic.HeatingThresholdTemperature);
		const coolingThresholdChar = service.getCharacteristic(Characteristic.CoolingThresholdTemperature);

		expect(heatingThresholdChar).toBeDefined();
		expect(coolingThresholdChar).toBeDefined();

		heatingThresholdChar.setValue(20.0);
		expect(commandDispatcher.dispatch).toHaveBeenCalledWith('prop-heater-temp', 20.0);

		coolingThresholdChar.setValue(25.0);
		expect(commandDispatcher.dispatch).toHaveBeenCalledWith('prop-cooler-temp', 25.0);
	});

	it('should bind child lock controls when lockedProperty is present', () => {
		const lockedProp = new ChannelPropertyEntity();
		lockedProp.id = 'prop-climate-locked';
		lockedProp.permissions = [PermissionType.READ_WRITE];
		lockedProp.value = new PropertyValueState(false);

		new ThermostatCoordinator({
			device,
			service,
			context,
			ambientTempChannel: ambientChannel,
			ambientTempProperty: ambientProp,
			heaterChannel,
			heaterOnProperty: heaterOnProp,
			heaterTempProperty: heaterTempProp,
			lockedProperty: lockedProp,
		});

		const lockChar = service.getCharacteristic(Characteristic.LockPhysicalControls);
		expect(lockChar).toBeDefined();
		expect(lockChar.value).toBe(Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED);

		lockChar.setValue(Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED);
		expect(commandDispatcher.dispatch).toHaveBeenCalledWith('prop-climate-locked', true);

		for (const listener of registeredListeners) {
			listener.onPropertyChanged(lockedProp, false);
		}
		expect(lockChar.value).toBe(Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED);
	});
});
