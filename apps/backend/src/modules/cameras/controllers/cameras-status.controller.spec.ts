import { instanceToPlain } from 'class-transformer';

import { ForbiddenException } from '@nestjs/common';

import { TokenOwnerType } from '../../auth/auth.constants';
import { UserRole } from '../../users/users.constants';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';
import { LiveStreamGateway } from '../gateway/live-stream.gateway';
import { CamerasConfigModel } from '../models/config.model';
import { GO2RTC_RELAY_REASONS, GO2RTC_RELAY_STATES } from '../models/status.model';
import { Go2rtcRelayStatus, Go2rtcService } from '../services/go2rtc.service';

import { CamerasStatusController } from './cameras-status.controller';

describe('CamerasStatusController', () => {
	const userReq = { auth: { type: 'user', id: 'u1', role: UserRole.USER } } as never;
	const displayReq = {
		auth: { type: 'token', tokenId: 't', ownerType: TokenOwnerType.DISPLAY, ownerId: 'd1', role: UserRole.USER },
	} as never;
	const thirdPartyReq = {
		auth: { type: 'token', tokenId: 't', ownerType: TokenOwnerType.THIRD_PARTY, ownerId: 'x', role: UserRole.USER },
	} as never;

	let go2rtc: { getStatus: jest.Mock<Go2rtcRelayStatus, []> };
	let gateway: { getActiveCount: jest.Mock<number, []> };
	let controller: CamerasStatusController;

	beforeEach(() => {
		go2rtc = { getStatus: jest.fn<Go2rtcRelayStatus, []>() };
		gateway = { getActiveCount: jest.fn<number, []>().mockReturnValue(0) };

		const configService = {
			getModuleConfig: jest.fn((type: string) => {
				expect(type).toBe(CAMERAS_MODULE_NAME);

				return new CamerasConfigModel();
			}),
		};

		controller = new CamerasStatusController(
			configService as never,
			go2rtc as unknown as Go2rtcService,
			gateway as unknown as LiveStreamGateway,
		);
	});

	it('reports relay state, version and sessions', () => {
		go2rtc.getStatus.mockReturnValue({
			mode: 'managed',
			state: 'running',
			reason: null,
			version: '1.9.9',
			generation: 4,
		});
		gateway.getActiveCount.mockReturnValue(3);

		const { data } = controller.getStatus(userReq);

		expect(instanceToPlain(data)).toEqual({
			relay: { mode: 'managed', state: 'running', reason: null, version: '1.9.9' },
			sessions: { active: 3, max: 8, max_per_camera: 4 },
		});
	});

	it('reports an unavailable relay with its reason and without the generation', () => {
		go2rtc.getStatus.mockReturnValue({
			mode: 'managed',
			state: 'unavailable',
			reason: 'binary_missing',
			version: null,
			generation: 7,
		});

		const plain = instanceToPlain(controller.getStatus(displayReq).data);

		expect(plain).toEqual({
			relay: { mode: 'managed', state: 'unavailable', reason: 'binary_missing', version: null },
			sessions: { active: 0, max: 8, max_per_camera: 4 },
		});
		expect(JSON.stringify(plain)).not.toContain('generation');
	});

	it('lists every relay state and reason the service can produce', () => {
		expect(GO2RTC_RELAY_STATES.sort()).toEqual(['disabled', 'error', 'running', 'starting', 'unavailable']);
		expect(GO2RTC_RELAY_REASONS).toContain('start_timeout');
		expect(GO2RTC_RELAY_REASONS).toHaveLength(10);
	});

	it('refuses third-party tokens without reading the relay', () => {
		expect(() => controller.getStatus(thirdPartyReq)).toThrow(ForbiddenException);
		expect(go2rtc.getStatus).not.toHaveBeenCalled();
	});
});
