import { EventEmitter2 } from '@nestjs/event-emitter';

import { VirtualThermostatActuatorClaimEntity } from '../entities/virtual-thermostat.entity';

import { InstalledThermostatEvidence, ThermostatActuationRegistry } from './thermostat-actuation-registry.service';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';

describe('provider thermostat safety qualifications', () => {
	it('keeps profiles on the same physical output independent and requires a new installation after registration replacement', () => {
		const registry = new ThermostatActuationRegistry();
		const claims = new VirtualThermostatClaimsService(
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			new EventEmitter2(),
			undefined,
			registry,
		);
		const register = (id: string) =>
			registry.register({
				profile: { id, version: 1 },
				qualify: (installed) => installed,
				allows: () => true,
				captureAdapter: () => null,
			});
		const evidence = (id: string): InstalledThermostatEvidence => ({
			physicalIdentity: 'relay',
			providerProfile: { id, version: 1 },
			contractVersion: 1,
			qualificationGeneration: 'generation',
			profile: {},
			upstreamWritersExcluded: true,
			opposedOutputsInterlocked: false,
			machineLeaseIsCurrent: () => true,
		});
		const claim = (id: string) =>
			Object.assign(new VirtualThermostatActuatorClaimEntity(), {
				physicalIdentity: 'relay',
				providerProfile: id,
				providerProfileVersion: 1,
				qualificationGeneration: 'generation',
			});
		register('local-limit');
		const removeTimer = register('local-timer');
		const limit = evidence('local-limit'),
			timer = evidence('local-timer');
		claims.recordQualification(limit);
		claims.recordQualification(timer);
		expect(claims.qualification(claim('local-limit'), false)).toBe(limit);
		expect(claims.qualification(claim('local-timer'), false)).toBe(timer);
		claims.revokeAllQualifications('local-limit');
		expect(claims.qualification(claim('local-limit'), false)).toBeNull();
		expect(claims.qualification(claim('local-timer'), false)).toBe(timer);
		claims.recordQualification(limit);
		removeTimer();
		register('local-timer');
		expect(claims.qualification(claim('local-timer'), false)).toBeNull();
		claims.revokeQualification('relay', 'local-timer');
		expect(claims.qualification(claim('local-limit'), false)).toBe(limit);
		claims.onModuleDestroy();
		registry.onModuleDestroy();
	});
});
