import { v4 as uuid } from 'uuid';
import { describe, expect, it, vi } from 'vitest';

import { DevicesModuleDeviceCategory } from '../../../openapi';
import { DevicesValidationException } from '../devices.exceptions';

import { DeviceCreateReqSchema, DeviceSchema, DeviceUpdateReqSchema } from './devices.store.schemas';
import type { IDeviceRes, IDevicesAddActionPayload, IDevicesEditActionPayload } from './devices.store.types';
import { transformDeviceCreateRequest, transformDeviceResponse, transformDeviceUpdateRequest } from './devices.transformers';

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warning: vi.fn(),
			log: vi.fn(),
		},
	};
});

const deviceId = uuid();

const validDeviceResponse: IDeviceRes = {
	id: deviceId.toString(),
	type: 'some-device',
	category: DevicesModuleDeviceCategory.generic,
	identifier: null,
	name: 'Some device',
	description: 'With description',
	enabled: true,
	created_at: '2024-03-01T12:00:00Z',
	updated_at: '2024-03-02T12:00:00Z',
	controls: [],
	channels: [],
};

const validDeviceCreatePayload: IDevicesAddActionPayload['data'] = {
	type: 'some-device',
	category: DevicesModuleDeviceCategory.generic,
	name: 'Device name',
};

const validDeviceUpdatePayload: IDevicesEditActionPayload['data'] = {
	type: 'some-device',
	name: 'Device title',
};

describe('Devices Transformers', (): void => {
	describe('transformDeviceResponse', (): void => {
		it('should transform a valid device response', (): void => {
			const result = transformDeviceResponse(validDeviceResponse, DeviceSchema);

			expect(result).toEqual({
				id: deviceId.toString(),
				type: 'some-device',
				category: DevicesModuleDeviceCategory.generic,
				identifier: null,
				name: 'Some device',
				description: 'With description',
				enabled: true,
				draft: false,
				createdAt: new Date('2024-03-01T12:00:00Z'),
				updatedAt: new Date('2024-03-02T12:00:00Z'),
			});
		});

		it('should throw an error for an invalid device response', (): void => {
			expect(() => transformDeviceResponse({ ...validDeviceResponse, id: null } as unknown as IDeviceRes, DeviceSchema)).toThrow(
				DevicesValidationException
			);
		});
	});

	describe('transformDeviceCreateRequest', (): void => {
		it('should transform a valid device create request', (): void => {
			const result = transformDeviceCreateRequest(validDeviceCreatePayload, DeviceCreateReqSchema);

			expect(result).toEqual({
				type: 'some-device',
				category: DevicesModuleDeviceCategory.generic,
				name: 'Device name',
			});
		});

		it('should throw an error for an invalid device create request', (): void => {
			expect(() =>
				transformDeviceCreateRequest(
					{ ...validDeviceCreatePayload, type: undefined } as unknown as IDevicesAddActionPayload['data'],
					DeviceCreateReqSchema
				)
			).toThrow(DevicesValidationException);
		});
	});

	describe('transformDeviceUpdateRequest', (): void => {
		it('should transform a valid device update request', (): void => {
			const result = transformDeviceUpdateRequest(validDeviceUpdatePayload, DeviceUpdateReqSchema);

			expect(result).toEqual({
				type: 'some-device',
				name: 'Device title',
			});
		});

		it('should throw an error for an invalid device update request', (): void => {
			expect(() =>
				transformDeviceUpdateRequest(
					{
						...validDeviceUpdatePayload,
						type: undefined,
					} as unknown as IDevicesEditActionPayload['data'],
					DeviceUpdateReqSchema
				)
			).toThrow(DevicesValidationException);
		});
	});
});
