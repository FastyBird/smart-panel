import { DevicesValidationException } from '../devices.exceptions';

import {
	DeviceControlCreateReqSchema,
	DeviceControlSchema,
	type IDeviceControl,
	type IDeviceControlCreateReq,
	type IDeviceControlRes,
	type IDevicesControlsAddActionPayload,
} from './devices.controls.store.types';

export function transformDeviceControlResponse(response: IDeviceControlRes): IDeviceControl {
	const parsedDeviceControl = DeviceControlSchema.safeParse({
		id: response.id,
		device: response.device,
		name: response.name,
		createdAt: response.created_at,
		updatedAt: response.updated_at,
	});

	if (!parsedDeviceControl.success) {
		throw new DevicesValidationException('Failed to validate received device control data.');
	}

	return parsedDeviceControl.data;
}

export function transformDeviceControlCreateRequest(
	control: IDevicesControlsAddActionPayload['data'] & { id?: string; device: string }
): IDeviceControlCreateReq {
	const parsedRequest = DeviceControlCreateReqSchema.safeParse({
		id: control.id,
		device: control.device,
		name: control.name,
	});

	if (!parsedRequest.success) {
		throw new DevicesValidationException('Failed to validate create device control request.');
	}

	return parsedRequest.data;
}
