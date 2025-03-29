import { camelToSnake, snakeToCamel } from '../../../common';
import { DevicesValidationException } from '../devices.exceptions';

import {
	DeviceCreateReqSchema,
	DeviceSchema,
	DeviceUpdateReqSchema,
	type IDevice,
	type IDeviceCreateReq,
	type IDeviceRes,
	type IDeviceUpdateReq,
	type IDevicesAddActionPayload,
	type IDevicesEditActionPayload,
} from './devices.store.types';

export function transformDeviceResponse(response: IDeviceRes, schema: typeof DeviceSchema): IDevice {
	const parsedDevice = schema.safeParse(snakeToCamel(response));

	if (!parsedDevice.success) {
		throw new DevicesValidationException('Failed to validate received device data.');
	}

	return parsedDevice.data;
}

export function transformDeviceCreateRequest(
	device: IDevicesAddActionPayload['data'] & { id?: string },
	schema: typeof DeviceCreateReqSchema
): IDeviceCreateReq {
	const parsedRequest = schema.safeParse(camelToSnake(device));

	if (!parsedRequest.success) {
		throw new DevicesValidationException('Failed to validate create device request.');
	}

	return parsedRequest.data;
}

export function transformDeviceUpdateRequest(
	device: IDevicesEditActionPayload['data'],
	type: string,
	schema: typeof DeviceUpdateReqSchema
): IDeviceUpdateReq {
	const parsedRequest = schema.safeParse(camelToSnake(device));

	if (!parsedRequest.success) {
		throw new DevicesValidationException('Failed to validate update device request.');
	}

	return parsedRequest.data;
}
