import { DataSource } from 'typeorm';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { SUPERVISED_SWITCH_PROFILE } from '../contracts/thermostat-actuation.contract';
import { ThermostatMemberProtectionEntity } from '../entities/thermostat-member-protection.entity';
import {
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
} from '../entities/virtual-thermostat.entity';

import { ThermostatMemberProtectionService } from './thermostat-member-protection.service';
import { ThermostatSafetyCatalog } from './thermostat-safety-catalog.service';

describe('software member floor protection', () => {
	it('enforces the configured limit with no device guard and requires a fresh post-release report for recovery', async () => {
		const property = Object.assign(new ChannelPropertyEntity(), { id: 'floor' });
		const source = {
			property,
			leaf: property,
			transform: null,
			transformSource: null,
			domain: null,
			fingerprint: 'bound',
			enabled: true,
		};
		const claim = Object.assign(new VirtualThermostatActuatorClaimEntity(), {
			id: 'heating',
			role: 'heating',
			providerProfile: SUPERVISED_SWITCH_PROFILE,
			revision: 1,
		});
		const other = Object.assign(new VirtualThermostatActuatorClaimEntity(), { ...claim, id: 'other' });
		const binding = Object.assign(new ThermostatMemberProtectionEntity(), {
			sourcePropertyId: property.id,
			sourcePropertyIdentity: property.id,
			physicalPropertyIdentity: property.id,
			maximumAgeSeconds: 10,
			contractFingerprint: source.fingerprint,
		});
		const manager = {
			findOneBy: jest.fn((_entity: unknown, where: { claimId: string }) =>
				Promise.resolve(where.claimId === claim.id ? binding : null),
			),
		};
		const catalog = new ThermostatSafetyCatalog();
		jest.spyOn(catalog, 'resolveSource').mockResolvedValue(source);
		const config = Object.assign(new VirtualThermostatConfigEntity(), {
			controllerId: 'controller',
			revision: 1,
			policy: { floor: { limit: 27, recoveryHysteresis: 2 } },
		});
		let reported = new Date(),
			temperature = 24;
		const values = {
			readQualifiedSample: () => ({ quality: 'good', value: temperature, sampledAt: reported, receivedAt: reported }),
			captureSampleSourceGuard: () => () => true,
		} as unknown as PropertyValueService;
		const floors = new ThermostatMemberProtectionService({ manager } as unknown as DataSource, values, catalog);
		const frame = await floors.load(config, [claim, other]);
		expect(frame).toHaveLength(1);
		expect(frame[0]).toMatchObject({ claimId: claim.id, cutoff: 27 });
		expect(manager.findOneBy.mock.calls.map(([entity]) => entity)).toEqual([
			ThermostatMemberProtectionEntity,
			ThermostatMemberProtectionEntity,
		]);

		const start = Date.now();
		expect(floors.read(frame, start)[0].ready).toBe(false);
		floors.acknowledgeRelease(frame, start);
		reported = new Date(start + 1);
		expect(floors.read(frame, start + 1)[0].ready).toBe(true);
		temperature = 27;
		reported = new Date(start + 2);
		expect(floors.read(frame, start + 2)[0].reasons).toContain('member_floor_latched');
		temperature = 24;
		reported = new Date(start + 3);
		expect(floors.read(frame, start + 3)[0].ready).toBe(false);
		floors.acknowledgeRelease(frame, start + 3);
		expect(floors.read(frame, start + 3)[0].ready).toBe(false);
		reported = new Date(start + 4);
		expect(floors.read(frame, start + 4)[0].ready).toBe(true);
	});
});
