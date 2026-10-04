import { instanceToPlain } from 'class-transformer';

import { UserRole } from '../../../modules/users/users.constants';
import { RemoteAccessTailscalePluginControlModel } from '../models/status.model';
import { TailscaleRequirement } from '../services/tailscale-node-managed.service';

import { buildTailscaleControlModel } from './tailscale-control.utils';

const stopped: Omit<RemoteAccessTailscalePluginControlModel, 'availableActions'> = {
	enabled: true,
	serviceState: 'stopped',
	authentication: 'authenticated',
	operation: null,
};
const requirements: TailscaleRequirement[] = [
	{ code: 'operator-granted', satisfied: true, message: 'granted', remedy: null },
];

describe('Tailscale administrative actions', () => {
	it('serializes the control contract using the documented wire names and explicit idle operation', () => {
		const control = buildTailscaleControlModel(stopped, 'disconnected', requirements, UserRole.ADMIN);
		expect(
			instanceToPlain(control, { excludeExtraneousValues: true, exposeUnsetFields: false, groups: ['api'] }),
		).toEqual({
			enabled: true,
			service_state: 'stopped',
			authentication: 'authenticated',
			operation: null,
			available_actions: ['connect'],
		});
	});

	it('offers Connect for a signed-in stopped node without relying on tailnet labels', () => {
		const control = buildTailscaleControlModel(stopped, 'disconnected', requirements, UserRole.ADMIN);

		expect(control.availableActions).toEqual(['connect']);
		expect(control.authentication).toBe('authenticated');
	});

	it('also offers Connect when the supervisor is already started but the network is down', () => {
		const control = buildTailscaleControlModel(
			{ ...stopped, serviceState: 'started' },
			'disconnected',
			requirements,
			UserRole.ADMIN,
		);

		expect(control.availableActions).toEqual(['disconnect', 'connect']);
	});

	it('offers login only when authentication is missing or unknown', () => {
		for (const authentication of ['unknown', 'required'] as const) {
			const control = buildTailscaleControlModel(
				{ ...stopped, authentication },
				'disconnected',
				requirements,
				UserRole.ADMIN,
			);

			expect(control.availableActions).toEqual(['login']);
		}
	});

	it('restricts logout and preference reset to owners', () => {
		expect(buildTailscaleControlModel(stopped, 'disconnected', requirements, UserRole.OWNER).availableActions).toEqual([
			'connect',
			'logout',
			'reset-preferences',
		]);
		expect(buildTailscaleControlModel(stopped, 'disconnected', requirements, undefined).availableActions).toEqual([]);
	});

	it('keeps Disconnect available to cancel login after the plugin is disabled or prerequisites fail', () => {
		const control = buildTailscaleControlModel(
			{ ...stopped, enabled: false, operation: 'login' },
			'pending-auth',
			[],
			UserRole.OWNER,
		);

		expect(control.availableActions).toEqual(['disconnect']);
	});

	it('does not advertise new work during a terminal action', () => {
		for (const operation of ['disconnect', 'shutdown', 'reset'] as const) {
			const control = buildTailscaleControlModel(
				{ ...stopped, serviceState: 'stopping', operation },
				'disconnected',
				requirements,
				UserRole.OWNER,
			);

			expect(control.availableActions).toEqual([]);
		}
	});

	it('blocks new connection actions when setup is incomplete or the plugin is disabled', () => {
		expect(buildTailscaleControlModel(stopped, 'disconnected', [], UserRole.OWNER).availableActions).toEqual([]);
		expect(
			buildTailscaleControlModel({ ...stopped, enabled: false }, 'disconnected', requirements, UserRole.OWNER)
				.availableActions,
		).toEqual([]);
	});
});
