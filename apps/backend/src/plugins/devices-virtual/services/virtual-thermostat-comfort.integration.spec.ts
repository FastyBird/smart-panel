import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { AddVirtualThermostatComfort1000000000039 } from '../../../migrations/1000000000039-AddVirtualThermostatComfort';
import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { VirtualDeviceEntity, VirtualDeviceMode } from '../entities/devices-virtual.entity';
import { VirtualThermostatConfigEntity } from '../entities/virtual-thermostat.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { VirtualThermostatComfortService } from './virtual-thermostat-comfort.service';
import { validateThermostatComfort } from './virtual-thermostat-comfort.utils';

jest.setTimeout(30_000);

describe('thermostat durable comfort lifecycle', () => {
	let database: SqliteDataSource;
	let comfort: VirtualThermostatComfortService;
	let makeService: () => VirtualThermostatComfortService;
	let id: string;
	let wall: number;
	let elapsed: number;
	const input = () => ({
		heating_range: { minimum: 10, maximum: 30 },
		cooling_range: null,
		presets: [
			{ preset: 'comfort' as const, setpoints: { heating_setpoint: 23, cooling_setpoint: null } },
			{ preset: 'eco' as const, setpoints: { heating_setpoint: 17, cooling_setpoint: null } },
		],
	});
	const fence = async () => {
		const current = await comfort.get(id);
		return { expected_revision: current.revision, expected_graph_revision: current.graph_revision };
	};
	const configured = async () => comfort.configure(id, await fence(), input());
	const overridden = async (duration = 1000) =>
		comfort.override(
			id,
			await fence(),
			{
				preset: 'comfort',
				setpoints: null,
				expires_at: new Date(wall + duration).toISOString(),
			},
			'authenticated-operator',
		);

	beforeEach(async () => {
		wall = Date.UTC(2026, 9, 15);
		elapsed = 100;
		jest.spyOn(Date, 'now').mockImplementation(() => wall);
		jest.spyOn(performance, 'now').mockImplementation(() => elapsed);
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [__dirname + '/../../../**/*.entity.ts'],
			synchronize: true,
		}).initialize();
		const structure = new DeviceStructureLockService();
		const graph = new VirtualDependencyGraphService(database);
		const events = new EventEmitter2();
		const claims = {
			invalidate: jest.fn(),
			refresh: jest.fn().mockResolvedValue(undefined),
		} as unknown as VirtualThermostatClaimsService;
		makeService = () => new VirtualThermostatComfortService(database, structure, graph, claims, events);
		comfort = makeService();
		id = randomUUID();
		await database.manager.insert(VirtualDeviceEntity, {
			id,
			name: 'Comfort thermostat',
			category: DeviceCategory.THERMOSTAT,
			enabled: true,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
		});
		await database.manager.insert(VirtualThermostatConfigEntity, {
			controllerId: id,
			ownerDeviceId: id,
			schemaVersion: 1,
			revision: 1,
			requestedMode: 'heat',
			locked: false,
			policy: {
				heatingSetpoint: 20,
				coolingSetpoint: null,
				coldTolerance: 0.5,
				hotTolerance: 0.5,
				neutralMargin: 1,
				minimumOffMs: 0,
				changeoverMs: 0,
				floor: null,
			},
			contactOpeningMs: 0,
			contactClosingMs: 0,
			configuredAt: new Date(wall),
		});
	});
	afterEach(async () => {
		jest.restoreAllMocks();
		if (database?.isInitialized) await database.destroy();
	});

	it('preserves installed settings and leaves presets and automation unset until configured', async () => {
		expect(await comfort.get(id)).toMatchObject({
			configuration: null,
			effective: { source: 'manual', heating_setpoint: 20 },
		});
		await configured();
		expect(await comfort.get(id)).toMatchObject({
			configuration: { selected_preset: null, automation_enabled: false },
			effective: { source: 'manual', heating_setpoint: 20 },
		});
	});

	it('validates branch/range/deadband and rejects stale configuration and graph revisions atomically', async () => {
		const old = await fence();
		await configured();
		await expect(comfort.select(id, old, 'eco', false)).rejects.toThrow('revision');
		await expect(comfort.select(id, { ...(await fence()), expected_graph_revision: 0 }, 'eco', false)).rejects.toThrow(
			'graph revision',
		);
		const bad = input();
		bad.presets[0].setpoints.heating_setpoint = 31;
		await expect(comfort.configure(id, await fence(), bad)).rejects.toThrow('setpoint_range');
		const dual = {
			...(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).policy,
			coolingSetpoint: 24,
		};
		expect(
			validateThermostatComfort(
				{
					...input(),
					cooling_range: { minimum: 15, maximum: 35 },
					selected_preset: null,
					user_off: false,
					automation_enabled: false,
					temporary_override: null,
					presets: [{ preset: 'comfort', setpoints: { heating_setpoint: 23, cooling_setpoint: 24 } }],
				},
				dual,
			),
		).toContain('overlapping_setpoints');
		expect((await comfort.get(id)).configuration.presets[0].setpoints.heating_setpoint).toBe(23);
	});

	it('persists identity, actor, source, revision and absolute expiry without mutating requested settings', async () => {
		await configured();
		const before = await fence();
		const result = await overridden();
		expect(result.configuration.temporary_override).toMatchObject({
			actor_id: 'authenticated-operator',
			source: 'user',
			revision: before.expected_revision + 1,
			status: 'active',
			expires_at: new Date(wall + 1000).toISOString(),
		});
		expect(result.effective).toMatchObject({ source: 'override', preset: 'comfort', heating_setpoint: 23 });
		expect(
			(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).policy
				.heatingSetpoint,
		).toBe(20);
	});

	it('retains a live override across preset edits and resolves the CURRENT baseline exactly at expiry', async () => {
		await configured();
		await overridden();
		await comfort.select(id, await fence(), 'eco', false);
		const changed = input();
		changed.presets[0].setpoints.heating_setpoint = 25;
		changed.presets[1].setpoints.heating_setpoint = 16;
		await comfort.configure(id, await fence(), changed);
		expect((await comfort.get(id)).effective.heating_setpoint).toBe(23);
		wall += 999;
		elapsed += 999;
		expect((await comfort.get(id)).effective.source).toBe('override');
		wall += 1;
		elapsed += 1;
		expect(await comfort.get(id)).toMatchObject({
			configuration: { temporary_override: { status: 'expired' } },
			effective: { source: 'preset', preset: 'eco', heating_setpoint: 16, expires_at: null },
		});
		wall -= 100_000;
		comfort = makeService();
		expect(await comfort.get(id)).toMatchObject({
			configuration: { temporary_override: { status: 'expired' } },
			effective: { heating_setpoint: 16 },
		});
	});

	it('uses the monotonic budget during wall rollback and fences before durable settlement', async () => {
		await configured();
		await overridden();
		const captured = (await comfort.get(id)).configuration;
		wall -= 60_000;
		elapsed += 999;
		expect(comfort.isCurrent(captured)).toBe(true);
		elapsed += 1;
		expect(comfort.isCurrent(captured)).toBe(false);
		expect(await comfort.get(id)).toMatchObject({
			configuration: { temporary_override: { status: 'expired' } },
			effective: { source: 'manual' },
		});
	});

	it('terminates an unobservable cross-downtime lifetime explicitly and never revives it on another restart', async () => {
		await configured();
		await overridden();
		wall -= 60_000;
		comfort = makeService();
		expect(await comfort.get(id)).toMatchObject({
			clock_policy: 'terminate_on_restart_uncertainty',
			configuration: { temporary_override: { status: 'clock_uncertain' } },
			effective: { source: 'manual' },
		});
		comfort = makeService();
		expect((await comfort.get(id)).configuration.temporary_override.status).toBe('clock_uncertain');
	});

	it('cancels only the current override and recomputes a changed baseline without replay', async () => {
		await configured();
		const first = await overridden();
		const second = await overridden();
		await expect(comfort.cancel(id, await fence(), first.configuration.temporary_override.id)).rejects.toThrow(
			'identity',
		);
		await comfort.select(id, await fence(), 'eco', false);
		expect(await comfort.cancel(id, await fence(), second.configuration.temporary_override.id)).toMatchObject({
			configuration: { temporary_override: { status: 'cancelled' } },
			effective: { source: 'preset', heating_setpoint: 17 },
		});
	});

	it('keeps explicit OFF latched through baseline/override changes until explicitly cleared', async () => {
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId: id }, { requestedMode: 'off' });
		await configured();
		await overridden();
		await comfort.select(id, await fence(), 'eco', false);
		expect((await comfort.get(id)).effective.source).toBe('user_off');
		await comfort.select(id, await fence(), 'eco', true);
		expect((await comfort.get(id)).effective.source).toBe('override');
		expect(
			(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).requestedMode,
		).toBe('off');
	});

	it('rejects invalid override combinations, expiry, disabled branches and mode reconfiguration', async () => {
		await configured();
		await expect(
			comfort.override(
				id,
				await fence(),
				{
					preset: 'comfort',
					setpoints: { heating_setpoint: 24, cooling_setpoint: null },
					expires_at: new Date(wall + 1000).toISOString(),
				},
				'operator',
			),
		).rejects.toThrow('invalid_override');
		await expect(overridden(0)).rejects.toThrow('expiry');
		await expect(
			comfort.override(
				id,
				await fence(),
				{
					preset: null,
					setpoints: { heating_setpoint: 24, cooling_setpoint: 26 },
					expires_at: new Date(wall + 1000).toISOString(),
				},
				'operator',
			),
		).rejects.toThrow('unsupported_branch');
		const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
		expect(
			validateThermostatComfort(row.comfort, { ...row.policy, heatingSetpoint: null, coolingSetpoint: 24 }),
		).toContain('invalid_branch_range');
	});

	it('requires explicit automation opt-in and keeps overrides/OFF stronger than the current trusted baseline', async () => {
		await configured();
		await expect(
			comfort.applyAutomationBaseline(id, await fence(), { preset: 'eco', setpoints: null }, 'space-bridge'),
		).rejects.toThrow('not explicitly enabled');
		await comfort.configure(id, await fence(), { ...input(), automation_enabled: true });
		await comfort.applyAutomationBaseline(id, await fence(), { preset: 'eco', setpoints: null }, 'space-bridge');
		expect((await comfort.get(id)).effective).toMatchObject({
			source: 'automation',
			preset: 'eco',
			heating_setpoint: 17,
		});
		await overridden();
		await comfort.applyAutomationBaseline(
			id,
			await fence(),
			{ preset: null, setpoints: { heating_setpoint: 18, cooling_setpoint: null } },
			'space-bridge',
		);
		expect((await comfort.get(id)).effective.heating_setpoint).toBe(23);
		elapsed += 1000;
		expect((await comfort.get(id)).effective).toMatchObject({
			source: 'automation',
			preset: null,
			heating_setpoint: 18,
		});
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId: id }, { requestedMode: 'off' });
		const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
		row.comfort.user_off = true;
		await database.manager.save(row);
		await comfort.applyAutomationBaseline(id, await fence(), { preset: 'comfort', setpoints: null }, 'space-bridge');
		expect((await comfort.get(id)).effective.source).toBe('user_off');
		await comfort.configure(id, await fence(), { ...input(), automation_enabled: false });
		expect((await comfort.get(id)).configuration.automation_baseline).toBeNull();
	});

	it('upgrades old storage without inventing presets or changing installed settings', async () => {
		const old = await new SqliteDataSource({ type: 'sqlite', database: ':memory:' }).initialize();
		try {
			await old.query(
				'CREATE TABLE "devices_virtual_thermostat_configs" ("controllerId" text PRIMARY KEY, "requestedMode" text, "policy" text)',
			);
			await old.query('INSERT INTO "devices_virtual_thermostat_configs" VALUES (?, ?, ?)', [
				id,
				'heat',
				'{"heatingSetpoint":19.5}',
			]);
			await new AddVirtualThermostatComfort1000000000039().up(old.createQueryRunner());
			expect(await old.query('SELECT * FROM "devices_virtual_thermostat_configs"')).toEqual([
				{ controllerId: id, requestedMode: 'heat', policy: '{"heatingSetpoint":19.5}', comfort: null },
			]);
		} finally {
			await old.destroy();
		}
	});
});
