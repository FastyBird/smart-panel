import { EntityNotFoundError } from 'typeorm';

import { ForbiddenException, NotFoundException, UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedRequest } from '../../../modules/auth/guards/auth.guard';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { RolesGuard } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { StageThermostatInstallationDto } from '../dto/thermostat-installation.dto';
import { ThermostatInstallationLoaderService } from '../services/thermostat-installation-loader.service';
import { ThermostatInstallationService } from '../services/thermostat-installation.service';

import { ThermostatInstallationController } from './thermostat-installation.controller';

describe('installation administration authorization', () => {
	const stage = jest.fn(),
		revoke = jest.fn(),
		verify = jest.fn(),
		inspect = jest.fn().mockResolvedValue({ claim: 'fixture', revision: 1 });
	const controller = new ThermostatInstallationController(
		{ stage, inspect, revoke } as unknown as ThermostatInstallationService,
		{ verify } as unknown as ThermostatInstallationLoaderService,
	);
	beforeEach(() => {
		jest.resetAllMocks();
		inspect.mockResolvedValue({ claim: 'fixture', revision: 1 });
	});
	it.each([
		undefined,
		{ type: 'user', id: 'operator', role: UserRole.USER },
		{ type: 'token', ownerId: null, role: UserRole.ADMIN },
		{ type: 'token', ownerId: 'admin-owner', role: UserRole.ADMIN },
		{ type: 'token', ownerId: 'owner-user', role: UserRole.OWNER },
	])('denies unprivileged/unattributable actors %j before any mutation or network verification', async (auth) => {
		const req = { auth } as AuthenticatedRequest;
		await expect(
			controller.stage('fixture', { expected_revision: 0 } as StageThermostatInstallationDto, req),
		).rejects.toThrow(ForbiddenException);
		await expect(controller.verify('fixture', { expected_revision: 1 }, req)).rejects.toThrow(ForbiddenException);
		await expect(controller.revoke('fixture', { expected_revision: 1 }, req)).rejects.toThrow(ForbiddenException);
		await expect(controller.inspect('fixture', req)).rejects.toThrow(ForbiddenException);
		expect(stage).not.toHaveBeenCalled();
		expect(verify).not.toHaveBeenCalled();
		expect(revoke).not.toHaveBeenCalled();
		expect(inspect).not.toHaveBeenCalled();
	});
	it.each(['stage', 'verify', 'revoke'] as const)('maps missing records in %s to HTTP 404', async (operation) => {
		const missing = new EntityNotFoundError('ThermostatInstallationEntity', { claimId: 'fixture' });
		({ stage, verify, revoke })[operation].mockRejectedValueOnce(missing);
		const req = { auth: { type: 'user', id: 'operator', role: UserRole.OWNER } } as AuthenticatedRequest;
		const dto = { expected_revision: 1, setup: {}, operator_attestations: [] } as StageThermostatInstallationDto;
		await expect(controller[operation]('fixture', dto, req)).rejects.toMatchObject({ status: 404 });
		expect(inspect).not.toHaveBeenCalled();
	});
	it('preserves stage validation errors as HTTP 422', async () => {
		stage.mockRejectedValueOnce(new DevicesValidationException('Invalid installation equipment'));
		await expect(
			controller.stage(
				'fixture',
				{ expected_revision: 0 } as StageThermostatInstallationDto,
				{
					auth: { type: 'user', id: 'operator', role: UserRole.ADMIN },
				} as AuthenticatedRequest,
			),
		).rejects.toThrow(UnprocessableEntityException);
	});
	it.each(['stage', 'verify', 'revoke'] as const)('preserves unrelated %s errors', async (operation) => {
		const failure = new Error('Infrastructure unavailable');
		({ stage, verify, revoke })[operation].mockRejectedValueOnce(failure);
		const req = { auth: { type: 'user', id: 'operator', role: UserRole.OWNER } } as AuthenticatedRequest;
		const dto = { expected_revision: 1, setup: {}, operator_attestations: [] } as StageThermostatInstallationDto;
		await expect(controller[operation]('fixture', dto, req)).rejects.toBe(failure);
	});
	it('preserves the existing missing-profile inspect response', async () => {
		inspect.mockRejectedValueOnce(new NotFoundException('No installation profile; stage equipment details first.'));
		await expect(
			controller.inspect('fixture', {
				auth: { type: 'user', id: 'operator', role: UserRole.OWNER },
			} as AuthenticatedRequest),
		).rejects.toMatchObject({ status: 404 });
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
