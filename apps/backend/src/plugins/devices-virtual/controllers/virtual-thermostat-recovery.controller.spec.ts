import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';

import { VirtualThermostatConfigController } from './virtual-thermostat-config.controller';

describe('thermostat operator recovery admission', () => {
	it('denies ordinary users before the restore route and refuses non-user credentials', async () => {
		const guard = new RolesGuard(new Reflector());
		const context = (role: UserRole): ExecutionContext =>
			({
				// Metadata lookup intentionally needs the undecorated prototype method.
				// eslint-disable-next-line @typescript-eslint/unbound-method
				getHandler: () => VirtualThermostatConfigController.prototype.restoreActuator,
				getClass: () => VirtualThermostatConfigController,
				switchToHttp: () => ({ getRequest: () => ({ auth: { role } }) }),
			}) as unknown as ExecutionContext;
		expect(guard.canActivate(context(UserRole.USER))).toBe(false);
		expect(guard.canActivate(context(UserRole.ADMIN))).toBe(true);
		const configs = { restoreActuator: jest.fn() };
		const controller = new VirtualThermostatConfigController(configs as never, {} as never);
		await expect(
			controller.restoreActuator(
				'controller',
				'claim',
				{} as never,
				{
					auth: { type: 'token', role: UserRole.ADMIN },
				} as never,
			),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(configs.restoreActuator).not.toHaveBeenCalled();
	});
});
