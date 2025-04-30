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

export const transformDeviceResponse = <T extends IDevice = IDevice>(response: IDeviceRes, schema: typeof DeviceSchema): T => {
	const parsed = schema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		console.error('Schema validation failed with:', parsed.error);

		throw new DevicesValidationException('Failed to validate received device data.');
	}

	return parsed.data as T;
};

export const transformDeviceCreateRequest = <T extends IDeviceCreateReq = IDeviceCreateReq>(
	data: IDevicesAddActionPayload['data'],
	schema: typeof DeviceCreateReqSchema
): T => {
	const parsed = schema.safeParse(camelToSnake(data));

	if (!parsed.success) {
		console.error('Schema validation failed with:', parsed.error);

		throw new DevicesValidationException('Failed to validate create device request.');
	}

	return parsed.data as T;
};

export const transformDeviceUpdateRequest = <T extends IDeviceUpdateReq = IDeviceUpdateReq>(
	data: IDevicesEditActionPayload['data'],
	schema: typeof DeviceUpdateReqSchema
): T => {
	const parsed = schema.safeParse(camelToSnake(data));

	if (!parsed.success) {
		console.error('Schema validation failed with:', parsed.error);

		throw new DevicesValidationException('Failed to validate update device request.');
	}

	return parsed.data as T;
};
