import { ForbiddenException, NotFoundException, ServiceUnavailableException, ValidationPipe } from '@nestjs/common';

import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import {
	CameraOfflineException,
	CameraProfileUnavailableException,
	CameraRateLimitedException,
	CameraUpstreamException,
	CamerasNotFoundException,
} from '../cameras.exceptions';
import { resolveCameraOwner } from '../cameras.utils';
import { ReqCreateCameraSessionDto } from '../dto/create-session.dto';
import { CameraModel } from '../models/camera.model';
import { CameraSessionService } from '../services/camera-session.service';
import { CameraSnapshotService } from '../services/camera-snapshot.service';
import { CameraProviderTimeoutError, CamerasService } from '../services/cameras.service';

import { CamerasController } from './cameras.controller';

describe('CamerasController', () => {
	const userReq = { auth: { type: 'user', id: 'u1', role: UserRole.USER } } as never;
	const thirdPartyReq = {
		auth: { type: 'token', tokenId: 't', ownerType: TokenOwnerType.THIRD_PARTY, ownerId: 'x', role: UserRole.USER },
	} as never;
	const id = '8f0f2a3c-5c1e-4a56-9d3b-1c2d3e4f5a6b';

	let service: {
		findAll: jest.Mock;
		getOneOrThrow: jest.Mock;
		toModel: jest.Mock;
		getProviderOrThrow: jest.Mock;
		resolveProfile: jest.Mock;
	};
	let sessions: { create: jest.Mock };
	let snapshots: { getSnapshot: jest.Mock };
	let controller: CamerasController;

	beforeEach(() => {
		service = {
			findAll: jest.fn(),
			getOneOrThrow: jest.fn(),
			toModel: jest.fn(),
			getProviderOrThrow: jest.fn(),
			resolveProfile: jest.fn(),
		};
		sessions = { create: jest.fn() };
		snapshots = { getSnapshot: jest.fn() };
		controller = new CamerasController(
			service as unknown as CamerasService,
			snapshots as unknown as CameraSnapshotService,
			sessions as unknown as CameraSessionService,
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

	describe('createSession', () => {
		const device = { id };
		const provider = {};
		const body = { data: { profile: 'medium', transport: 'mse' } } as ReqCreateCameraSessionDto;
		const expiresAt = Date.now() + 60_000;

		beforeEach(() => {
			service.getProviderOrThrow.mockResolvedValue({ device, provider });
			service.resolveProfile.mockResolvedValue({ id: 'medium', available: true });
			sessions.create.mockReturnValue({ session: { id: 'sid', expiresAt }, token: 'tok' });
		});

		it('creates a session for the resolved profile and owner', async () => {
			const response = await controller.createSession(userReq, id, body);

			expect(service.resolveProfile).toHaveBeenCalledWith(device, provider, 'medium');
			expect(sessions.create).toHaveBeenCalledWith({
				deviceId: id,
				profileId: 'medium',
				transport: 'mse',
				owner: resolveCameraOwner(userReq),
			});
			expect(response.data.sessionId).toBe('sid');
			expect(response.data.url).toBe('/api/v1/modules/cameras/live?session=tok');
			expect(response.data.expiresAt).toBe(new Date(expiresAt).toISOString());
		});

		it('defaults the profile through resolveProfile', async () => {
			service.resolveProfile.mockResolvedValue({ id: 'high', available: true });

			await controller.createSession(userReq, id, { data: { transport: 'mse' } } as ReqCreateCameraSessionDto);

			expect(service.resolveProfile).toHaveBeenCalledWith(device, provider, undefined);
			expect(sessions.create).toHaveBeenCalledWith(expect.objectContaining({ profileId: 'high' }));
		});

		it.each([
			['an unknown camera or one without a provider', new CamerasNotFoundException('x'), 'getProviderOrThrow'],
			['an unavailable profile', new CameraProfileUnavailableException('x'), 'resolveProfile'],
		])('maps %s to 404', async (_name, error, method) => {
			(service as unknown as Record<string, jest.Mock>)[method].mockRejectedValue(error);

			await expect(controller.createSession(userReq, id, body)).rejects.toBeInstanceOf(NotFoundException);
			expect(sessions.create).not.toHaveBeenCalled();
		});

		it.each([new CameraProviderTimeoutError(), new CameraUpstreamException('x'), new CameraOfflineException('x')])(
			'maps the provider failure %#  to 503',
			async (error) => {
				service.resolveProfile.mockRejectedValue(error);

				await expect(controller.createSession(userReq, id, body)).rejects.toBeInstanceOf(ServiceUnavailableException);
			},
		);

		it('rejects a third-party token with 403 before touching the camera', async () => {
			await expect(controller.createSession(thirdPartyReq, id, body)).rejects.toBeInstanceOf(ForbiddenException);
			expect(service.getProviderOrThrow).not.toHaveBeenCalled();
		});

		it('rejects transport hls through the validation pipe', async () => {
			const pipe = new ValidationPipe({
				transform: true,
				whitelist: true,
				forbidNonWhitelisted: true,
				transformOptions: { enableImplicitConversion: true },
			});

			await expect(
				pipe.transform({ data: { transport: 'hls' } }, { type: 'body', metatype: ReqCreateCameraSessionDto }),
			).rejects.toBeDefined();
			await expect(
				pipe.transform(
					{ data: { profile: 'medium', transport: 'mse' } },
					{ type: 'body', metatype: ReqCreateCameraSessionDto },
				),
			).resolves.toBeDefined();
		});
	});
});
