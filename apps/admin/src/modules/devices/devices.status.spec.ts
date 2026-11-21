import { describe, expect, it } from 'vitest';

import { DevicesModuleDeviceConnectionStatus } from '../../openapi.constants';

import { deviceStatusTag } from './devices.status';

describe('deviceStatusTag', () => {
	it.each([
		[DevicesModuleDeviceConnectionStatus.connected, 'ok'],
		[DevicesModuleDeviceConnectionStatus.ready, 'ok'],
		[DevicesModuleDeviceConnectionStatus.running, 'ok'],
		[DevicesModuleDeviceConnectionStatus.disconnected, 'warn'],
		[DevicesModuleDeviceConnectionStatus.stopped, 'warn'],
		[DevicesModuleDeviceConnectionStatus.sleeping, 'warn'],
		[DevicesModuleDeviceConnectionStatus.lost, 'danger'],
		[DevicesModuleDeviceConnectionStatus.alert, 'danger'],
		[DevicesModuleDeviceConnectionStatus.init, 'info'],
		[DevicesModuleDeviceConnectionStatus.unknown, 'info'],
		[undefined, 'info'],
	])('shows %s as %s', (status, tag) => {
		expect(deviceStatusTag(status)).toBe(tag);
	});
});
