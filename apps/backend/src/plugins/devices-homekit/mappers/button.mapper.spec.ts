import { Categories, Characteristic, Service } from '@homebridge/hap-nodejs';

import { ChannelCategory, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelInputOccurrencePayload } from '../../../modules/devices/models/channel-input-occurrence.model';
import { HomeKitCommandDispatcher } from '../services/homekit-command.dispatcher';

import { ButtonMapper } from './button.mapper';
import {
	CharacteristicBinding,
	HomeKitMapperContext,
	InputOccurrenceListener,
	PropertyEventListener,
} from './homekit-mapper.interface';

describe('ButtonMapper', () => {
	let mapper: ButtonMapper;
	let mockDispatcher: jest.Mocked<HomeKitCommandDispatcher>;
	let registeredBindings: CharacteristicBinding[];
	let registeredPropertyListeners: PropertyEventListener[];
	let registeredOccurrenceListeners: InputOccurrenceListener[];
	let context: HomeKitMapperContext;

	beforeEach(() => {
		mapper = new ButtonMapper();
		mockDispatcher = {
			dispatch: jest.fn(),
		} as unknown as jest.Mocked<HomeKitCommandDispatcher>;
		registeredBindings = [];
		registeredPropertyListeners = [];
		registeredOccurrenceListeners = [];

		context = {
			commandDispatcher: mockDispatcher,
			registerBinding: (b) => registeredBindings.push(b),
			registerPropertyListener: (l) => registeredPropertyListeners.push(l),
			registerOccurrenceListener: (l) => registeredOccurrenceListeners.push(l),
		};
	});

	const createMockProperty = (
		id: string,
		category: PropertyCategory,
		permissions: PermissionType[],
		format?: string[],
	): ChannelPropertyEntity => {
		const prop = new ChannelPropertyEntity();
		prop.id = id;
		prop.category = category;
		prop.permissions = permissions;
		prop.format = format ?? ['press', 'double_press', 'long_press'];
		return prop;
	};

	const createMockChannel = (
		id: string,
		category: ChannelCategory,
		name: string,
		properties: ChannelPropertyEntity[],
	): ChannelEntity => {
		const chan = new ChannelEntity();
		chan.id = id;
		chan.category = category;
		chan.name = name;
		chan.properties = properties;
		return chan;
	};

	const createMockDevice = (channels: ChannelEntity[]): DeviceEntity => {
		const dev = new DeviceEntity();
		dev.id = 'dev-1';
		dev.name = 'Smart Switch';
		dev.channels = channels;
		return dev;
	};

	describe('canMap', () => {
		it('returns true for devices with button channels', () => {
			const channel = createMockChannel('ch-1', ChannelCategory.BUTTON, 'Button 1', []);
			const device = createMockDevice([channel]);
			expect(mapper.canMap(device)).toBe(true);
		});

		it('returns true for devices with binary_input channels that have an event property', () => {
			const prop = createMockProperty('prop-1', PropertyCategory.EVENT, [PermissionType.EVENT_ONLY]);
			const channel = createMockChannel('ch-1', ChannelCategory.BINARY_INPUT, 'Input 1', [prop]);
			const device = createMockDevice([channel]);
			expect(mapper.canMap(device)).toBe(true);
		});

		it('returns false for devices without button or event-capable binary_input channels', () => {
			const channel = createMockChannel('ch-1', ChannelCategory.SWITCHER, 'Relay 1', []);
			const device = createMockDevice([channel]);
			expect(mapper.canMap(device)).toBe(false);
		});
	});

	describe('getSuggestedServiceType', () => {
		it('returns button', () => {
			const device = createMockDevice([]);
			expect(mapper.getSuggestedServiceType(device)).toBe('button');
		});
	});

	describe('buildAccessory', () => {
		it('builds a single-button accessory without ServiceLabel', () => {
			const prop = createMockProperty('prop-1', PropertyCategory.EVENT, [PermissionType.EVENT_ONLY]);
			const channel = createMockChannel('ch-1', ChannelCategory.BUTTON, 'Main Button', [prop]);
			const device = createMockDevice([channel]);

			const accessory = mapper.buildAccessory(device, context);
			expect(accessory).not.toBeNull();
			expect(accessory?.getService(Service.ServiceLabel)).toBeUndefined();

			const switchService = accessory?.getService(Service.StatelessProgrammableSwitch);
			expect(switchService).toBeDefined();
			expect(switchService?.testCharacteristic(Characteristic.ServiceLabelIndex)).toBe(false);

			expect(registeredOccurrenceListeners.length).toBe(1);
			expect(registeredOccurrenceListeners[0].propertyId).toBe('prop-1');
		});

		it('builds a multi-button accessory with ServiceLabel and ServiceLabelIndex', () => {
			const prop1 = createMockProperty('prop-1', PropertyCategory.EVENT, [PermissionType.EVENT_ONLY]);
			const prop2 = createMockProperty('prop-2', PropertyCategory.EVENT, [PermissionType.EVENT_ONLY]);
			const ch1 = createMockChannel('ch-1', ChannelCategory.BUTTON, 'Button 1', [prop1]);
			const ch2 = createMockChannel('ch-2', ChannelCategory.BUTTON, 'Button 2', [prop2]);
			const device = createMockDevice([ch1, ch2]);

			const accessory = mapper.buildAccessory(device, context);
			expect(accessory).not.toBeNull();

			const labelService = accessory?.getService(Service.ServiceLabel);
			expect(labelService).toBeDefined();

			const switch1 = accessory?.getServiceById(Service.StatelessProgrammableSwitch, 'ch-1');
			const switch2 = accessory?.getServiceById(Service.StatelessProgrammableSwitch, 'ch-2');
			expect(switch1).toBeDefined();
			expect(switch2).toBeDefined();

			expect(switch1?.getCharacteristic(Characteristic.ServiceLabelIndex).value).toBe(1);
			expect(switch2?.getCharacteristic(Characteristic.ServiceLabelIndex).value).toBe(2);

			expect(registeredOccurrenceListeners.length).toBe(2);
		});

		it('returns null when device has no button channels', () => {
			const device = createMockDevice([]);
			const accessory = mapper.buildAccessory(device, context);
			expect(accessory).toBeNull();
		});
	});

	describe('occurrence event delivery and mapping', () => {
		it('maps single, double, and long press events correctly to HAP notifications', () => {
			const prop = createMockProperty('prop-1', PropertyCategory.EVENT, [PermissionType.EVENT_ONLY]);
			const channel = createMockChannel('ch-1', ChannelCategory.BUTTON, 'Button', [prop]);
			const device = createMockDevice([channel]);

			const accessory = mapper.buildAccessory(device, context);
			const switchService = accessory?.getService(Service.StatelessProgrammableSwitch);
			const char = switchService?.getCharacteristic(Characteristic.ProgrammableSwitchEvent);

			const sendSpy = jest.spyOn(char, 'sendEventNotification');

			const listener = registeredOccurrenceListeners[0];

			// Single press
			listener.onOccurrence({
				id: 'occ-1',
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				channelCategory: ChannelCategory.BUTTON,
				propertyCategory: PropertyCategory.EVENT,
				event: 'press',
				timestamp: new Date().toISOString(),
			} as ChannelInputOccurrencePayload);
			expect(sendSpy).toHaveBeenCalledWith(Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);

			// Double press
			listener.onOccurrence({
				id: 'occ-2',
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				channelCategory: ChannelCategory.BUTTON,
				propertyCategory: PropertyCategory.EVENT,
				event: 'double_press',
				timestamp: new Date().toISOString(),
			} as ChannelInputOccurrencePayload);
			expect(sendSpy).toHaveBeenCalledWith(Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS);

			// Long press
			listener.onOccurrence({
				id: 'occ-3',
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				channelCategory: ChannelCategory.BUTTON,
				propertyCategory: PropertyCategory.EVENT,
				event: 'long_press',
				timestamp: new Date().toISOString(),
			} as ChannelInputOccurrencePayload);
			expect(sendSpy).toHaveBeenCalledWith(Characteristic.ProgrammableSwitchEvent.LONG_PRESS);
		});

		it('delivers repeated identical occurrences without suppression', () => {
			const prop = createMockProperty('prop-1', PropertyCategory.EVENT, [PermissionType.EVENT_ONLY]);
			const channel = createMockChannel('ch-1', ChannelCategory.BUTTON, 'Button', [prop]);
			const device = createMockDevice([channel]);

			const accessory = mapper.buildAccessory(device, context);
			const switchService = accessory?.getService(Service.StatelessProgrammableSwitch);
			const char = switchService?.getCharacteristic(Characteristic.ProgrammableSwitchEvent);
			const sendSpy = jest.spyOn(char, 'sendEventNotification');

			const listener = registeredOccurrenceListeners[0];

			for (let i = 0; i < 3; i++) {
				listener.onOccurrence({
					id: `occ-${i}`,
					deviceId: 'dev-1',
					channelId: 'ch-1',
					propertyId: 'prop-1',
					channelCategory: ChannelCategory.BUTTON,
					propertyCategory: PropertyCategory.EVENT,
					event: 'press',
					timestamp: new Date().toISOString(),
				} as ChannelInputOccurrencePayload);
			}

			expect(sendSpy).toHaveBeenCalledTimes(3);
			expect(sendSpy).toHaveBeenNthCalledWith(1, Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
			expect(sendSpy).toHaveBeenNthCalledWith(2, Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
			expect(sendSpy).toHaveBeenNthCalledWith(3, Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
		});

		it('drops unsupported events like triple_press or rotary without coercion', () => {
			const prop = createMockProperty('prop-1', PropertyCategory.EVENT, [PermissionType.EVENT_ONLY]);
			const channel = createMockChannel('ch-1', ChannelCategory.BUTTON, 'Button', [prop]);
			const device = createMockDevice([channel]);

			const accessory = mapper.buildAccessory(device, context);
			const switchService = accessory?.getService(Service.StatelessProgrammableSwitch);
			const char = switchService?.getCharacteristic(Characteristic.ProgrammableSwitchEvent);
			const sendSpy = jest.spyOn(char, 'sendEventNotification');

			const listener = registeredOccurrenceListeners[0];

			listener.onOccurrence({
				id: 'occ-triple',
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				channelCategory: ChannelCategory.BUTTON,
				propertyCategory: PropertyCategory.EVENT,
				event: 'triple_press',
				timestamp: new Date().toISOString(),
			} as ChannelInputOccurrencePayload);

			listener.onOccurrence({
				id: 'occ-release',
				deviceId: 'dev-1',
				channelId: 'ch-1',
				propertyId: 'prop-1',
				channelCategory: ChannelCategory.BUTTON,
				propertyCategory: PropertyCategory.EVENT,
				event: 'release',
				timestamp: new Date().toISOString(),
			} as ChannelInputOccurrencePayload);

			expect(sendSpy).not.toHaveBeenCalled();
		});

		it('returns null on GET request to avoid replaying old persistent state', async () => {
			const prop = createMockProperty('prop-1', PropertyCategory.EVENT, [PermissionType.EVENT_ONLY]);
			const channel = createMockChannel('ch-1', ChannelCategory.BUTTON, 'Button', [prop]);
			const device = createMockDevice([channel]);

			const accessory = mapper.buildAccessory(device, context);
			const switchService = accessory?.getService(Service.StatelessProgrammableSwitch);
			const char = switchService?.getCharacteristic(Characteristic.ProgrammableSwitchEvent);

			const getValue = await char?.handleGetRequest();
			expect(getValue).toBeNull();
		});
	});

	describe('mixed device attachment', () => {
		it('attaches button service to an existing switch accessory', () => {
			const switchProp = createMockProperty('prop-sw', PropertyCategory.ON, [PermissionType.READ_WRITE]);
			const switchChan = createMockChannel('ch-sw', ChannelCategory.SWITCHER, 'Relay', [switchProp]);

			const btnProp = createMockProperty('prop-btn', PropertyCategory.EVENT, [PermissionType.EVENT_ONLY]);
			const btnChan = createMockChannel('ch-btn', ChannelCategory.BUTTON, 'Button 1', [btnProp]);

			const device = createMockDevice([switchChan, btnChan]);

			// Suppose accessory was created by SwitchMapper
			const accessory = mapper['createBaseAccessory'](device, Categories.SWITCH);
			accessory.addService(Service.Switch, 'Relay', 'ch-sw');

			ButtonMapper.attachButtonServices(accessory, device, context);

			expect(accessory.getServiceById(Service.Switch, 'ch-sw')).toBeDefined();
			expect(accessory.getServiceById(Service.StatelessProgrammableSwitch, 'ch-btn')).toBeDefined();
			expect(registeredOccurrenceListeners.length).toBe(1);
			expect(registeredOccurrenceListeners[0].propertyId).toBe('prop-btn');
		});
	});
});
