import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import {
	CameraOfflineException,
	CameraProfileUnavailableException,
	CameraRateLimitedException,
	CameraUpstreamException,
	CamerasNotFoundException,
} from '../cameras.exceptions';
import { CameraModel } from '../models/camera.model';
import { CameraSnapshotService } from '../services/camera-snapshot.service';
import { CamerasService } from '../services/cameras.service';

import { CamerasController } from './cameras.controller';

describe('CamerasController', () => {
	const userReq = { auth: { type: 'user', id: 'u1', role: UserRole.USER } } as never;
	const thirdPartyReq = {
		auth: { type: 'token', tokenId: 't', ownerType: TokenOwnerType.THIRD_PARTY, ownerId: 'x', role: UserRole.USER },
	} as never;
	const id = '8f0f2a3c-5c1e-4a56-9d3b-1c2d3e4f5a6b';

	let service: { findAll: jest.Mock; getOneOrThrow: jest.Mock; toModel: jest.Mock };
	let snapshots: { getSnapshot: jest.Mock };
	let controller: CamerasController;

	beforeEach(() => {
		service = { findAll: jest.fn(), getOneOrThrow: jest.fn(), toModel: jest.fn() };
		snapshots = { getSnapshot: jest.fn() };
		controller = new CamerasController(
			service as unknown as CamerasService,
			snapshots as unknown as CameraSnapshotService,
		);
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

	describe('snapshot', () => {
		const data = Buffer.from([0xff, 0xd8, 1]);
		let res: { header: jest.Mock; send: jest.Mock };

		beforeEach(() => {
			res = { header: jest.fn().mockReturnThis(), send: jest.fn().mockReturnThis() };
		});

		const headers = () => Object.fromEntries(res.header.mock.calls.map(([k, v]: [string, string]) => [k, v]));

		it('sends the image with its headers and no age header when fresh', async () => {
			snapshots.getSnapshot.mockResolvedValue({ contentType: 'image/jpeg', data, ageMs: 0, stale: false });

			await controller.getSnapshot(userReq, id, { profile: 'package', hq: 'true' }, res as never);

			expect(snapshots.getSnapshot).toHaveBeenCalledWith(id, { profileId: 'package', highQuality: true });
			expect(headers()).toEqual({
				'Content-Type': 'image/jpeg',
				'Content-Length': '3',
				'Cache-Control': 'no-store',
			});
			expect(res.send).toHaveBeenCalledWith(data);
		});

		it('treats a missing hq as false and a missing profile as undefined', async () => {
			snapshots.getSnapshot.mockResolvedValue({ contentType: 'image/jpeg', data, ageMs: 0, stale: false });

			await controller.getSnapshot(userReq, id, {}, res as never);

			expect(snapshots.getSnapshot).toHaveBeenCalledWith(id, { profileId: undefined, highQuality: false });
		});

		it('adds X-Snapshot-Age in whole seconds for a stale image', async () => {
			snapshots.getSnapshot.mockResolvedValue({ contentType: 'image/jpeg', data, ageMs: 7000, stale: true });

			await controller.getSnapshot(userReq, id, {}, res as never);

			expect(headers()['X-Snapshot-Age']).toBe('7');
		});

		it('maps a missing camera and an unknown profile to NotFoundException', async () => {
			snapshots.getSnapshot.mockRejectedValueOnce(new CamerasNotFoundException('x'));
			await expect(controller.getSnapshot(userReq, id, {}, res as never)).rejects.toBeInstanceOf(NotFoundException);

			snapshots.getSnapshot.mockRejectedValueOnce(new CameraProfileUnavailableException('x'));
			await expect(controller.getSnapshot(userReq, id, { profile: 'nope' }, res as never)).rejects.toBeInstanceOf(
				NotFoundException,
			);
			expect(res.send).not.toHaveBeenCalled();
		});

		it('maps an offline camera to 503 Camera is offline', async () => {
			snapshots.getSnapshot.mockRejectedValue(new CameraOfflineException('x'));

			const error = await controller.getSnapshot(userReq, id, {}, res as never).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ServiceUnavailableException);
			expect((error as ServiceUnavailableException).message).toBe('Camera is offline');
			expect(headers()['Retry-After']).toBeUndefined();
		});

		it('maps rate limiting without a cached image to 503 Camera is busy with Retry-After', async () => {
			snapshots.getSnapshot.mockRejectedValue(new CameraRateLimitedException('x'));

			const error = await controller.getSnapshot(userReq, id, {}, res as never).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ServiceUnavailableException);
			expect((error as ServiceUnavailableException).message).toBe('Camera is busy');
			expect(headers()['Retry-After']).toBe('2');
		});

		it('maps an upstream failure to 503 Camera did not respond', async () => {
			snapshots.getSnapshot.mockRejectedValue(new CameraUpstreamException('x'));

			const error = await controller.getSnapshot(userReq, id, {}, res as never).catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ServiceUnavailableException);
			expect((error as ServiceUnavailableException).message).toBe('Camera did not respond');
		});

		it('rethrows unexpected errors and rejects a forbidden caller before reading the camera', async () => {
			const boom = new Error('boom');

			snapshots.getSnapshot.mockRejectedValue(boom);
			await expect(controller.getSnapshot(userReq, id, {}, res as never)).rejects.toBe(boom);

			snapshots.getSnapshot.mockClear();
			await expect(controller.getSnapshot(thirdPartyReq, id, {}, res as never)).rejects.toBeInstanceOf(
				ForbiddenException,
			);
			expect(snapshots.getSnapshot).not.toHaveBeenCalled();
		});
	});
});
