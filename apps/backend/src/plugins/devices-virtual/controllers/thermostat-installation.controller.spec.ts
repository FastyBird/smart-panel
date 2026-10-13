import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedRequest } from '../../../modules/auth/guards/auth.guard';
import { RolesGuard } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { StageThermostatInstallationDto } from '../dto/thermostat-installation.dto';
import { ThermostatInstallationLoaderService } from '../services/thermostat-installation-loader.service';
import { ThermostatInstallationService } from '../services/thermostat-installation.service';

import { ThermostatInstallationController } from './thermostat-installation.controller';

describe('installation administration authorization', () => {
	const stage = jest.fn(),
		verify = jest.fn(),
		inspect = jest.fn().mockResolvedValue({ claim: 'fixture', revision: 1 });
	const controller = new ThermostatInstallationController(
		{ stage, inspect } as unknown as ThermostatInstallationService,
		{ verify } as unknown as ThermostatInstallationLoaderService,
	);
	beforeEach(() => jest.clearAllMocks());
	it.each([
		undefined,
		{ type: 'user', id: 'operator', role: UserRole.USER },
		{ type: 'token', ownerId: null, role: UserRole.ADMIN },
	])('denies unprivileged/unattributable actors %j before any mutation or network verification', async (auth) => {
		const req = { auth } as AuthenticatedRequest;
		await expect(
			controller.stage('fixture', { expected_revision: 0 } as StageThermostatInstallationDto, req),
		).rejects.toThrow();
		await expect(controller.verify('fixture', { expected_revision: 1 }, req)).rejects.toThrow();
		expect(stage).not.toHaveBeenCalled();
		expect(verify).not.toHaveBeenCalled();
	});
	it('associates accepted owner operations with authenticated actor, never a body actor', async () => {
		const dto = { expected_revision: 0, setup: {}, operator_attestations: [] } as StageThermostatInstallationDto;
		await controller.stage('fixture', dto, {
			auth: { type: 'user', id: 'real-operator', role: UserRole.OWNER },
		} as AuthenticatedRequest);
		expect(stage).toHaveBeenCalledWith('fixture', 0, dto.setup, [], 'real-operator');
	});
	it('registers owner/admin route role metadata for the global role guard', () => {
		const guard = new RolesGuard(new Reflector());
		const context = {
			// A method reference is intentional: the role guard reads its decorator metadata.
			// eslint-disable-next-line @typescript-eslint/unbound-method
			getHandler: () => ThermostatInstallationController.prototype.stage,
			getClass: () => ThermostatInstallationController,
			switchToHttp: () => ({ getRequest: () => ({ auth: { role: UserRole.USER } }) }),
		};
		expect(guard.canActivate(context as never)).toBe(false);
	});
	it('rejects client qualification/drain proof even before service authoring', async () => {
		const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
		await expect(
			pipe.transform(
				{
					expected_revision: 0,
					qualified: true,
					drainProof: {},
					setup: { qualified: true },
					operator_attestations: [],
				},
				{ type: 'body', metatype: StageThermostatInstallationDto },
			),
		).rejects.toThrow();
	});
});
