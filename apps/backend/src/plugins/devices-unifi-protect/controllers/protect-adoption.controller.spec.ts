import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';

import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { ProtectReqAdoptDeviceDto, ProtectReqBatchAdoptDevicesDto } from '../dto/protect-adoption.dto';
import { ProtectReqMappingPreviewDto } from '../dto/protect-mapping-preview.dto';
import {
	ProtectConsoleUnavailableError,
	ProtectDeviceNotFoundError,
	ProtectUnsupportedDeviceError,
} from '../errors/protect-adoption.error';
import { ProtectAdoptionResultModel } from '../models/protect-adoption.model';
import { ProtectMappingPreviewModel } from '../models/protect-mapping-preview.model';
import { ProtectAdoptionService } from '../services/protect-adoption.service';
import { ProtectMappingPreviewService } from '../services/protect-mapping-preview.service';

import { ProtectAdoptionController } from './protect-adoption.controller';

const body = (data: unknown): ProtectReqMappingPreviewDto =>
	plainToInstance(ProtectReqMappingPreviewDto, { data }, { enableImplicitConversion: true });

const dto = (): ProtectReqMappingPreviewDto => body({ device_id: '600cefafd5f365d6f83c4ef3', model_key: 'camera' });

const result = (deviceId: string, status: string): ProtectAdoptionResultModel =>
	Object.assign(new ProtectAdoptionResultModel(), {
		deviceId,
		modelKey: 'camera',
		status,
		panelDeviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
		failureCode: null,
		message: null,
		warnings: [],
	});

const adoptBody = (data: unknown): ProtectReqAdoptDeviceDto =>
	plainToInstance(ProtectReqAdoptDeviceDto, { data }, { enableImplicitConversion: true });

const batchBody = (devices: unknown): ProtectReqBatchAdoptDevicesDto =>
	plainToInstance(ProtectReqBatchAdoptDevicesDto, { data: { devices } }, { enableImplicitConversion: true });

const item = (index: number) => ({ device_id: `cam${index}`, model_key: 'camera' });
const strict = { whitelist: true, forbidNonWhitelisted: true };

describe('ProtectAdoptionController', () => {
	let previews: { preview: jest.Mock };
	let adoption: { adoptOne: jest.Mock; adoptBatch: jest.Mock };
	let controller: ProtectAdoptionController;

	beforeEach(() => {
		previews = {
			preview: jest.fn().mockResolvedValue(
				Object.assign(new ProtectMappingPreviewModel(), {
					identifier: '0cea14003a69:600cefafd5f365d6f83c4ef3',
					mappingName: 'camera',
					readyToAdopt: true,
					adoptedDeviceId: null,
				}),
			),
		};
		adoption = {
			adoptOne: jest.fn((selection: { deviceId: string }) => Promise.resolve(result(selection.deviceId, 'created'))),
			adoptBatch: jest.fn((selections: { deviceId: string }[]) =>
				Promise.resolve(selections.map((selection) => result(selection.deviceId, 'created'))),
			),
		};
		controller = new ProtectAdoptionController(
			previews as unknown as ProtectMappingPreviewService,
			adoption as unknown as ProtectAdoptionService,
		);
	});

	it('wraps the preview and maps 503, 404 and 422', async () => {
		const plain = instanceToPlain(await controller.previewMapping(dto())) as { data: Record<string, unknown> };

		expect(plain.data).toMatchObject({ mapping_name: 'camera', ready_to_adopt: true, adopted_device_id: null });
		expect(previews.preview).toHaveBeenCalledWith('600cefafd5f365d6f83c4ef3', 'camera');

		previews.preview.mockRejectedValueOnce(new ProtectConsoleUnavailableError(null));
		await expect(controller.previewMapping(dto())).rejects.toBeInstanceOf(ServiceUnavailableException);

		previews.preview.mockRejectedValueOnce(new ProtectDeviceNotFoundError());
		await expect(controller.previewMapping(dto())).rejects.toBeInstanceOf(NotFoundException);

		previews.preview.mockRejectedValueOnce(new ProtectUnsupportedDeviceError());
		await expect(controller.previewMapping(dto())).rejects.toThrow(
			new UnprocessableEntityException('The UniFi Protect device has no supported mapping'),
		);
	});

	it('passes unexpected errors through', async () => {
		const failure = new Error('boom');

		previews.preview.mockRejectedValueOnce(failure);
		await expect(controller.previewMapping(dto())).rejects.toBe(failure);
	});

	it('accepts a valid request', async () => {
		expect(await validate(dto(), { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
	});

	it.each([
		[{}],
		[{ data: { device_id: '../x', model_key: 'camera' } }],
		[{ data: { device_id: 'a', model_key: 'chime' } }],
		[{ data: { device_id: 5, model_key: 'camera' } }],
		[{ data: { device_id: 'a', model_key: 'camera', extra: 1 } }],
	])('rejects %j with 400', async (payload) => {
		const request = plainToInstance(ProtectReqMappingPreviewDto, payload, { enableImplicitConversion: true });

		expect((await validate(request, { whitelist: true, forbidNonWhitelisted: true })).length).toBeGreaterThan(0);
	});

	it('restricts the preview to owners and administrators', () => {
		// Metadata inspection intentionally references an unbound controller method.
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(Reflect.getMetadata(ROLES_KEY, ProtectAdoptionController.prototype.previewMapping)).toEqual([
			UserRole.OWNER,
			UserRole.ADMIN,
		]);
	});

	it('wraps single and batch results in the response envelope', async () => {
		const single = instanceToPlain(await controller.adopt(adoptBody({ ...item(1), name: 'Porch' }))) as {
			data: Record<string, unknown>;
		};

		expect(single.data).toMatchObject({
			device_id: 'cam1',
			model_key: 'camera',
			status: 'created',
			panel_device_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
			failure_code: null,
			message: null,
			warnings: [],
		});
		expect(adoption.adoptOne).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'cam1', name: 'Porch' }));

		const batch = instanceToPlain(await controller.adoptBatch(batchBody([item(1), item(2)]))) as {
			data: { results: { device_id: string }[] };
		};

		expect(batch.data.results.map((entry) => entry.device_id)).toEqual(['cam1', 'cam2']);
		expect(adoption.adoptBatch).toHaveBeenCalledWith([
			expect.objectContaining({ deviceId: 'cam1' }),
			expect.objectContaining({ deviceId: 'cam2' }),
		]);
	});

	it('accepts a valid request with stream options and 50 devices', async () => {
		const single = adoptBody({ ...item(1), stream: { enabled: false, quality: 'low' } });

		expect(await validate(single, strict)).toEqual([]);
		expect(await validate(batchBody(Array.from({ length: 50 }, (_, index) => item(index))), strict)).toEqual([]);
	});

	it.each([
		['an empty batch', []],
		['a batch of 51', Array.from({ length: 51 }, (_, index) => item(index))],
		['a bad device id', [{ device_id: '../x', model_key: 'camera' }]],
		['an unknown field', [{ ...item(1), extra: 1 }]],
		['a numeric enabled flag', [{ ...item(1), stream: { enabled: 1 } }]],
		['a bad quality', [{ ...item(1), stream: { quality: 'package' } }]],
		['an empty name', [{ ...item(1), name: '' }]],
	])('rejects %s with 400', async (_label, devices) => {
		expect((await validate(batchBody(devices), strict)).length).toBeGreaterThan(0);
	});

	it('rejects an invalid single adoption', async () => {
		expect((await validate(adoptBody({ device_id: 'a', model_key: 'chime' }), strict)).length).toBeGreaterThan(0);
		expect((await validate(adoptBody({ ...item(1), name: 5 }), strict)).length).toBeGreaterThan(0);
	});

	it('restricts both adoption routes to owners and administrators', () => {
		/* eslint-disable @typescript-eslint/unbound-method */
		for (const handler of [ProtectAdoptionController.prototype.adopt, ProtectAdoptionController.prototype.adoptBatch]) {
			expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.OWNER, UserRole.ADMIN]);
		}
		/* eslint-enable @typescript-eslint/unbound-method */
	});
});
