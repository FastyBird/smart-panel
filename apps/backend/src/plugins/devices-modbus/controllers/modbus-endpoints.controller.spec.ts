import { NotFoundException } from '@nestjs/common';

import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { ModbusEndpointEntity } from '../entities/modbus-endpoint.entity';
import { EndpointHealth } from '../runtime/endpoint-connection';
import { ModbusConnectionsService } from '../services/modbus-connections.service';
import { ModbusEndpointsService } from '../services/modbus-endpoints.service';

import { ModbusEndpointsController } from './modbus-endpoints.controller';

describe('ModbusEndpointsController', () => {
	let endpointsService: { getOneOrThrow: jest.Mock };
	let connections: { getHealth: jest.Mock };
	let controller: ModbusEndpointsController;

	const health: EndpointHealth = {
		state: 'connected',
		lastError: null,
		lastErrorAt: null,
		averageLatencyMs: 12.5,
		requests: 10,
		timeouts: 1,
		overloaded: false,
	};

	beforeEach(() => {
		endpointsService = {
			getOneOrThrow: jest.fn((id: string) =>
				id === 'known'
					? Promise.resolve(Object.assign(new ModbusEndpointEntity(), { id }))
					: Promise.reject(new NotFoundException('Requested endpoint does not exist')),
			),
		};
		connections = { getHealth: jest.fn().mockReturnValue(health) };
		controller = new ModbusEndpointsController(
			endpointsService as unknown as ModbusEndpointsService,
			connections as unknown as ModbusConnectionsService,
		);
	});

	it('returns the health model', async () => {
		const response = await controller.health('known');

		expect(connections.getHealth).toHaveBeenCalledWith('known');
		expect(response.data).toEqual(health);
	});

	it('returns a stable stopped model when the endpoint is not running', async () => {
		connections.getHealth.mockReturnValue(null);

		const response = await controller.health('known');

		expect(response.data).toEqual({
			state: 'stopped',
			lastError: null,
			lastErrorAt: null,
			averageLatencyMs: null,
			requests: 0,
			timeouts: 0,
			overloaded: false,
		});
	});

	it('responds 404 for an unknown endpoint', async () => {
		await expect(controller.health('unknown')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('restricts every route to owners and admins', () => {
		const proto = ModbusEndpointsController.prototype;

		for (const name of ['findAll', 'findOne', 'create', 'update', 'remove', 'health'] as const) {
			expect(Reflect.getMetadata(ROLES_KEY, proto[name])).toEqual([UserRole.OWNER, UserRole.ADMIN]);
		}
	});
});
