import type { StatusTagStatus } from '../../common';
import { DevicesModuleDeviceConnectionStatus } from '../../openapi.constants';

/** The `status-tag` colour of a device connection state: running is ok, paused is a warning, lost is danger */
export const deviceStatusTag = (status: DevicesModuleDeviceConnectionStatus | null | undefined): StatusTagStatus => {
	switch (status) {
		case DevicesModuleDeviceConnectionStatus.connected:
		case DevicesModuleDeviceConnectionStatus.ready:
		case DevicesModuleDeviceConnectionStatus.running:
			return 'ok';
		case DevicesModuleDeviceConnectionStatus.disconnected:
		case DevicesModuleDeviceConnectionStatus.stopped:
		case DevicesModuleDeviceConnectionStatus.sleeping:
			return 'warn';
		case DevicesModuleDeviceConnectionStatus.lost:
		case DevicesModuleDeviceConnectionStatus.alert:
			return 'danger';
		default:
			// init and unknown: nothing to act on yet
			return 'info';
	}
};
