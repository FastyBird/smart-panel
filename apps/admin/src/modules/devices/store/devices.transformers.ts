import { camelToSnake, snakeToCamel } from '../../../common';
import { DevicesValidationException } from '../devices.exceptions';

import { DeviceCreateReqSchema, DeviceSchema, DeviceUpdateReqSchema } from './devices.store.schemas';
import type {
	IDevice,
	IDeviceCreateReq,
	IDeviceRes,
	IDeviceUpdateReq,
	IDevicesAddActionPayload,
	IDevicesEditActionPayload,
} from './devices.store.types';

export const transformDeviceResponse = (response: IDeviceRes, schema: typeof DeviceSchema): IDevice => {
	const parsedDevice = schema.safeParse(snakeToCamel(response));

	if (!parsedDevice.success) {
		console.error('Schema validation failed with:', parsedDevice.error);

		throw new DevicesValidationException('Failed to validate received device data.');
	}

	return parsedDevice.data;
};

export const transformDeviceCreateRequest = (
	device: IDevicesAddActionPayload['data'] & { id?: string },
	schema: typeof DeviceCreateReqSchema
): IDeviceCreateReq => {
	const parsedRequest = schema.safeParse(camelToSnake(device));

	if (!parsedRequest.success) {
		console.error('Schema validation failed with:', parsedRequest.error);

		throw new DevicesValidationException('Failed to validate create device request.');
	}

	return parsedRequest.data;
};

export const transformDeviceUpdateRequest = (
	device: IDevicesEditActionPayload['data'],
	type: string,
	schema: typeof DeviceUpdateReqSchema
): IDeviceUpdateReq => {
	const parsedRequest = schema.safeParse(camelToSnake(device));

	if (!parsedRequest.success) {
		console.error('Schema validation failed with:', parsedRequest.error);

		throw new DevicesValidationException('Failed to validate update device request.');
	}

	return parsedRequest.data;
};
