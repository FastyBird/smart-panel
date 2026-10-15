import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AuthenticatedRequest } from '../../../modules/auth/guards/auth.guard';
import { CreateThermostatOverrideDto } from '../dto/thermostat-comfort.dto';
import { VirtualThermostatComfortService } from '../services/virtual-thermostat-comfort.service';

import { VirtualThermostatComfortController } from './virtual-thermostat-comfort.controller';

describe('thermostat comfort actor boundary', () => {
	it('uses the authenticated actor and never forwards a DTO source or actor as authority', async () => {
		const override = jest.fn().mockResolvedValue({});
		const controller = new VirtualThermostatComfortController({
			override,
		} as unknown as VirtualThermostatComfortService);
		const dto = plainToInstance(CreateThermostatOverrideDto, {
			expected_revision: 2,
			expected_graph_revision: 3,
			preset: 'comfort',
			setpoints: null,
			expires_at: '2026-10-15T12:00:00Z',
			source: 'automation',
			actor_id: 'spoofed-admin',
		});
		await controller.override('controller', dto, { auth: { type: 'user', id: 'actual-user' } } as AuthenticatedRequest);
		expect(override).toHaveBeenCalledWith(
			'controller',
			dto,
			{
				preset: 'comfort',
				setpoints: null,
				expires_at: '2026-10-15T12:00:00Z',
			},
			'actual-user',
		);
		const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
		expect(errors.map((error) => error.property).sort()).toEqual(['actor_id', 'source']);
	});

	it('requires a timezone-qualified absolute override expiry', async () => {
		const dto = plainToInstance(CreateThermostatOverrideDto, {
			expected_revision: 1,
			expected_graph_revision: 1,
			preset: 'comfort',
			setpoints: null,
			expires_at: '2026-10-15T12:00:00',
		});
		expect((await validate(dto)).map((error) => error.property)).toContain('expires_at');
	});

	it('refuses unidentified token sessions before creating an override', () => {
		const override = jest.fn();
		const controller = new VirtualThermostatComfortController({
			override,
		} as unknown as VirtualThermostatComfortService);
		expect(() =>
			controller.override(
				'controller',
				{} as CreateThermostatOverrideDto,
				{ auth: { type: 'token' } } as unknown as AuthenticatedRequest,
			),
		).toThrow('identified user');
		expect(override).not.toHaveBeenCalled();
	});
});
