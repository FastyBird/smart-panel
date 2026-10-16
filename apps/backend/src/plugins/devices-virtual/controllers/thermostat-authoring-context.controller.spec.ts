import { ForbiddenException } from '@nestjs/common';

import { AuthenticatedRequest } from '../../../modules/auth/guards/auth.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { ThermostatAuthoringContextService } from '../services/thermostat-authoring-context.service';

import { ThermostatAuthoringContextController } from './thermostat-authoring-context.controller';

describe('member authoring context authority', () => {
	it.each([
		['user', UserRole.OWNER, true],
		['user', UserRole.ADMIN, true],
		['user', UserRole.USER, false],
		['display', UserRole.ADMIN, false],
		['token', UserRole.OWNER, false],
	])('%s/%s authoring authority', async (type, role, allowed) => {
		const read = jest.fn().mockResolvedValue({ candidates: [], reasons: ['metadata_missing'] });
		const controller = new ThermostatAuthoringContextController({
			read,
		} as unknown as ThermostatAuthoringContextService);
		const request = { auth: { type, role, id: 'actor' } } as unknown as AuthenticatedRequest;
		if (allowed) expect((await controller.candidates('property', request)).data.reasons).toEqual(['metadata_missing']);
		else {
			await expect(controller.candidates('property', request)).rejects.toBeInstanceOf(ForbiddenException);
			expect(read).not.toHaveBeenCalled();
		}
	});
});
