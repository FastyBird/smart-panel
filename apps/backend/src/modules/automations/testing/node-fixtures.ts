/**
 * What the tests of the built-in cards share. Never used by the application.
 */
import { DataTypeType, PermissionType } from '../../devices/devices.constants';
import { AutomationRunContext } from '../graph/node-type';
import { DevicePropertyInfo, DevicePropertyLookup } from '../nodes/device-property.utils';

export const DEVICE_A = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0a000001';
export const DEVICE_B = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0a000002';
export const CHANNEL_A = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0b000001';
export const CHANNEL_B = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0b000002';
export const PROPERTY_BOOL = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c000001';
export const PROPERTY_NUMBER = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c000002';
export const PROPERTY_ENUM = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c000003';
export const PROPERTY_READ_ONLY = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c000004';
export const PROPERTY_OTHER_DEVICE = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c000005';
export const PROPERTY_LEVEL = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c000006';
export const PROPERTY_MISSING = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0c0000ff';
export const SCENE_ID = '0d9f0a3e-6f5c-4d7e-9a43-1f1f0d000001';

const property = (
	id: string,
	dataType: DataTypeType,
	overrides: Partial<DevicePropertyInfo> = {},
): DevicePropertyInfo => ({
	id,
	channelId: CHANNEL_A,
	deviceId: DEVICE_A,
	dataType,
	format: null,
	invalid: null,
	step: null,
	permissions: [PermissionType.READ_WRITE],
	...overrides,
});

/** A small house: every property but one belongs to channel A of device A */
export const FIXTURE_PROPERTIES: DevicePropertyInfo[] = [
	property(PROPERTY_BOOL, DataTypeType.BOOL),
	property(PROPERTY_NUMBER, DataTypeType.FLOAT),
	property(PROPERTY_ENUM, DataTypeType.ENUM, { format: ['off', 'heat', 'cool'] }),
	property(PROPERTY_READ_ONLY, DataTypeType.BOOL, { permissions: [PermissionType.READ_ONLY] }),
	property(PROPERTY_OTHER_DEVICE, DataTypeType.BOOL, { channelId: CHANNEL_B, deviceId: DEVICE_B }),
	// A whole number from 0 to 100 in steps of 5, where 0 stands for "no reading"
	property(PROPERTY_LEVEL, DataTypeType.UCHAR, { format: [0, 100], step: 5, invalid: 0 }),
];

export const fixtureFindProperty: DevicePropertyLookup = (propertyId) =>
	Promise.resolve(FIXTURE_PROPERTIES.find((item) => item.id === propertyId) ?? null);

export const target = (
	propertyId: string,
	deviceId = DEVICE_A,
	channelId = CHANNEL_A,
): { device_id: string; channel_id: string; property_id: string } => ({
	device_id: deviceId,
	channel_id: channelId,
	property_id: propertyId,
});

export const runContext = (overrides: Partial<AutomationRunContext> = {}): AutomationRunContext => ({
	automationId: 'automation-1',
	runId: 'run-1',
	nodeId: 'node-1',
	signal: new AbortController().signal,
	trigger: { nodeId: 'trigger-1', data: {}, manual: false },
	...overrides,
});

export const abortedSignal = (): AbortSignal => {
	const controller = new AbortController();

	controller.abort();

	return controller.signal;
};
