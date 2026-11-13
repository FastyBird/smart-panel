import { DataTypeType, PermissionType } from '../../devices/devices.constants';
import { normalizeAutomationNodeType } from '../graph/node-type';
import { CHANNEL_A, CHANNEL_B, DEVICE_A, PROPERTY_MISSING, target } from '../testing/node-fixtures';

import { ButtonOccurrence } from './bus-events.types';
import { DEVICE_BUTTON_PRESSED_NODE_TYPE, createDeviceButtonPressedNodeType } from './device-button-pressed.node-type';
import { DevicePropertyInfo } from './device-property.utils';

const BUTTON = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c0000b1';
const FREE_BUTTON = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c0000b2';
const SWITCH = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c0000b3';

const PROPERTIES: DevicePropertyInfo[] = [
	{
		id: BUTTON,
		channelId: CHANNEL_A,
		deviceId: DEVICE_A,
		dataType: DataTypeType.ENUM,
		format: ['press', 'long_press', 'double_press'],
		invalid: null,
		step: null,
		permissions: [PermissionType.EVENT_ONLY],
	},
	{
		// A button whose integration does not list its gestures
		id: FREE_BUTTON,
		channelId: CHANNEL_A,
		deviceId: DEVICE_A,
		dataType: DataTypeType.STRING,
		format: null,
		invalid: null,
		step: null,
		permissions: [PermissionType.EVENT_ONLY],
	},
	{
		id: SWITCH,
		channelId: CHANNEL_A,
		deviceId: DEVICE_A,
		dataType: DataTypeType.BOOL,
		format: null,
		invalid: null,
		step: null,
		permissions: [PermissionType.READ_WRITE],
	},
];

describe('device.button.pressed', () => {
	let listeners: Set<(occurrence: ButtonOccurrence) => void>;

	const source = {
		onButtonOccurrence: (listener: (occurrence: ButtonOccurrence) => void) => {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},
	};

	const card = () =>
		createDeviceButtonPressedNodeType({
			source,
			findProperty: (id) => Promise.resolve(PROPERTIES.find((item) => item.id === id) ?? null),
		});

	const press = (event: string, propertyId = BUTTON): void => {
		for (const listener of [...listeners]) {
			listener({ id: `occurrence-${event}`, deviceId: DEVICE_A, channelId: CHANNEL_A, propertyId, event });
		}
	};

	beforeEach(() => {
		listeners = new Set();
	});

	it('is a trigger that refers to the device, the channel and the property of the button', () => {
		const registered = normalizeAutomationNodeType(card());

		expect(registered).toMatchObject({
			type: DEVICE_BUTTON_PRESSED_NODE_TYPE,
			kind: 'trigger',
			ports: { inputs: [], outputs: ['out'] },
		});
		expect(registered.references(target(BUTTON))).toEqual([
			{ kind: 'device', id: DEVICE_A },
			{ kind: 'channel', id: CHANNEL_A },
			{ kind: 'property', id: BUTTON },
		]);
	});

	it('takes a button and optionally the presses to start on', async () => {
		expect(await card().validateConfig(target(BUTTON))).toEqual([]);
		expect(await card().validateConfig({ ...target(BUTTON), events: ['long_press'] })).toEqual([]);
		// A free-form button takes any press
		expect(await card().validateConfig({ ...target(FREE_BUTTON), events: ['hold'] })).toEqual([]);
		// A property that is gone is not refused here: the engine marks the automation invalid
		expect(await card().validateConfig(target(PROPERTY_MISSING))).toEqual([]);
	});

	it.each([
		[{ events: [] }, 'events'],
		[{ events: ['press', 'press'] }, 'events'],
		[{ events: [''] }, 'events'],
		[{ events: 'press' }, 'events'],
		[{ hold_seconds: 2 }, 'hold_seconds'],
	])('refuses %j', async (extra, field) => {
		const problems = await card().validateConfig({ ...target(BUTTON), ...extra });

		expect(problems.map((problem) => problem.field)).toEqual([field]);
	});

	it('refuses a press the button does not report, a property that reports none and the wrong channel', async () => {
		expect(await card().validateConfig({ ...target(BUTTON), events: ['press', 'triple_press'] })).toEqual([
			{ field: 'events.1', reason: 'This button does not report this press.' },
		]);
		expect(await card().validateConfig(target(SWITCH))).toEqual([
			{ field: 'property_id', reason: 'This property does not report button presses.' },
		]);
		expect(await card().validateConfig(target(BUTTON, DEVICE_A, CHANNEL_B))).toEqual([
			{ field: 'channel_id', reason: 'The property does not belong to this channel.' },
		]);
	});

	it('starts on every press of the button, also the same press twice', () => {
		const fire = jest.fn();

		card().subscribe(target(BUTTON), fire);

		press('press');
		press('press');
		press('long_press');
		press('press', FREE_BUTTON);

		expect(fire).toHaveBeenCalledTimes(3);
		expect(fire).toHaveBeenLastCalledWith({
			device_id: DEVICE_A,
			channel_id: CHANNEL_A,
			property_id: BUTTON,
			event: 'long_press',
			occurrence_id: 'occurrence-long_press',
		});
	});

	it('starts only on the chosen presses', () => {
		const fire = jest.fn();

		card().subscribe({ ...target(BUTTON), events: ['long_press', 'double_press'] }, fire);

		press('press');
		press('double_press');

		expect(fire).toHaveBeenCalledTimes(1);
		expect(fire).toHaveBeenCalledWith(expect.objectContaining({ event: 'double_press' }));
	});

	it('stops listening when it is released', () => {
		const fire = jest.fn();

		const release = card().subscribe(target(BUTTON), fire);

		release();
		press('press');

		expect(fire).not.toHaveBeenCalled();
		expect(listeners.size).toBe(0);
	});
});
