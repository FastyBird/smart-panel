import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import { CamerasNotFoundException } from '../cameras.exceptions';
import { CameraModel } from '../models/camera.model';
import { CamerasService } from '../services/cameras.service';

import { CamerasController } from './cameras.controller';

describe('CamerasController', () => {
	const userReq = { auth: { type: 'user', id: 'u1', role: UserRole.USER } } as never;
	const thirdPartyReq = {
		auth: { type: 'token', tokenId: 't', ownerType: TokenOwnerType.THIRD_PARTY, ownerId: 'x', role: UserRole.USER },
	} as never;
	const id = '8f0f2a3c-5c1e-4a56-9d3b-1c2d3e4f5a6b';

	let service: { findAll: jest.Mock; getOneOrThrow: jest.Mock; toModel: jest.Mock };
	let controller: CamerasController;

	beforeEach(() => {
		service = { findAll: jest.fn(), getOneOrThrow: jest.fn(), toModel: jest.fn() };
		controller = new CamerasController(service as unknown as CamerasService);
	});

	it('lists cameras', async () => {
		const cameras = [new CameraModel()];

		service.findAll.mockResolvedValue(cameras);

		expect((await controller.findAll(userReq)).data).toBe(cameras);
	});

	it('returns one camera', async () => {
		const model = new CameraModel();

		service.getOneOrThrow.mockResolvedValue({ device: { id }, provider: null });
		service.toModel.mockResolvedValue(model);

		expect((await controller.findOne(userReq, id)).data).toBe(model);
	});

	it('maps a missing camera to NotFoundException', async () => {
		service.getOneOrThrow.mockRejectedValue(new CamerasNotFoundException('nope'));

		await expect(controller.findOne(userReq, id)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('maps a forbidden caller to ForbiddenException', async () => {
		await expect(controller.findAll(thirdPartyReq)).rejects.toBeInstanceOf(ForbiddenException);
		await expect(controller.findOne(thirdPartyReq, id)).rejects.toBeInstanceOf(ForbiddenException);
		expect(service.findAll).not.toHaveBeenCalled();
	});
});
