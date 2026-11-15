import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';

import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { ProtectReqMappingPreviewDto } from '../dto/protect-mapping-preview.dto';
import {
	ProtectConsoleUnavailableError,
	ProtectDeviceNotFoundError,
	ProtectUnsupportedDeviceError,
} from '../errors/protect-adoption.error';
import { ProtectMappingPreviewModel } from '../models/protect-mapping-preview.model';
import { ProtectMappingPreviewService } from '../services/protect-mapping-preview.service';

import { ProtectAdoptionController } from './protect-adoption.controller';

const body = (data: unknown): ProtectReqMappingPreviewDto =>
	plainToInstance(ProtectReqMappingPreviewDto, { data }, { enableImplicitConversion: true });

const dto = (): ProtectReqMappingPreviewDto => body({ device_id: '600cefafd5f365d6f83c4ef3', model_key: 'camera' });

describe('ProtectAdoptionController', () => {
	let previews: { preview: jest.Mock };
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
		controller = new ProtectAdoptionController(previews as unknown as ProtectMappingPreviewService);
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
});
