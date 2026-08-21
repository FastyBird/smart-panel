import { instanceToPlain } from 'class-transformer';

import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { HomeyAdoptionResultModel, HomeyAdoptionStatus } from '../models/adoption.model';
import { HomeyDeviceAdoptionService } from '../services/homey-device-adoption.service';

import { HomeyAdoptionController } from './homey-adoption.controller';

const result = (deviceId: string, status = HomeyAdoptionStatus.CREATED): HomeyAdoptionResultModel =>
	Object.assign(new HomeyAdoptionResultModel(), {
		deviceId,
		status,
		panelDeviceId: '18f0e92d-b7bd-4eb0-a851-36303a1a50c7',
		failureCode: null,
		message: null,
	});

describe('HomeyAdoptionController', () => {
	let adoptionService: jest.Mocked<Pick<HomeyDeviceAdoptionService, 'adoptOne' | 'adoptBatch'>>;
	let controller: HomeyAdoptionController;

	beforeEach(() => {
		adoptionService = {
			adoptOne: jest.fn().mockResolvedValue(result('homey-light')),
			adoptBatch: jest.fn().mockResolvedValue([result('first'), result('second', HomeyAdoptionStatus.SKIPPED)]),
		};
		controller = new HomeyAdoptionController(adoptionService as unknown as HomeyDeviceAdoptionService);
	});

	it('wraps a single result in the standard response envelope', async () => {
		const request = { deviceId: 'homey-light' };
		const response = await controller.adopt(request);

		expect(adoptionService.adoptOne).toHaveBeenCalledWith(request);
		expect(instanceToPlain(response)).toMatchObject({
			data: {
				device_id: 'homey-light',
				status: 'created',
				panel_device_id: '18f0e92d-b7bd-4eb0-a851-36303a1a50c7',
				failure_code: null,
			},
		});
	});

	it('wraps ordered batch outcomes without collapsing partial success', async () => {
		const devices = [{ deviceId: 'first' }, { deviceId: 'second' }];
		const response = await controller.adoptBatch({ devices });

		expect(adoptionService.adoptBatch).toHaveBeenCalledWith(devices);
		expect(instanceToPlain(response)).toMatchObject({
			data: {
				results: [
					{ device_id: 'first', status: 'created' },
					{ device_id: 'second', status: 'skipped' },
				],
			},
		});
	});

	it('restricts both mutations to owners and administrators', () => {
		// Metadata inspection intentionally references unbound controller methods.
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const single = HomeyAdoptionController.prototype.adopt;
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const batch = HomeyAdoptionController.prototype.adoptBatch;

		expect(Reflect.getMetadata(ROLES_KEY, single)).toEqual([UserRole.OWNER, UserRole.ADMIN]);
		expect(Reflect.getMetadata(ROLES_KEY, batch)).toEqual([UserRole.OWNER, UserRole.ADMIN]);
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, single)).toBe(HttpStatus.OK);
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, batch)).toBe(HttpStatus.OK);
	});
});
