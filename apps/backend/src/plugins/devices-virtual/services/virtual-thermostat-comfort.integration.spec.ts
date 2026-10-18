import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { AddVirtualThermostatComfort1000000000039 } from '../../../migrations/1000000000039-AddVirtualThermostatComfort';
import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { VirtualDeviceEntity, VirtualDeviceMode } from '../entities/devices-virtual.entity';
import { VirtualThermostatConfigEntity } from '../entities/virtual-thermostat.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { VirtualThermostatComfortService } from './virtual-thermostat-comfort.service';
import { validateThermostatComfort } from './virtual-thermostat-comfort.utils';
import { THERMOSTAT_CONFIG_CHANGED } from './virtual-thermostat-config.service';

jest.setTimeout(30_000);

describe('thermostat durable comfort lifecycle', () => {
	let database: SqliteDataSource;
	let comfort: VirtualThermostatComfortService;
	let makeService: () => VirtualThermostatComfortService;
	let id: string;
	let events: EventEmitter2;
	let structure: DeviceStructureLockService;
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

	const pauseNextSharedRead = () => {
		let resume: () => void;
		let observed: () => void;
		const gate = new Promise<void>((resolve) => {
			resume = resolve;
		});
		const entered = new Promise<void>((resolve) => {
			observed = resolve;
		});
		const shared = structure.runShared.bind(structure) as DeviceStructureLockService['runShared'];
		jest.spyOn(structure, 'runShared').mockImplementationOnce(async <T>(operation: () => Promise<T>): Promise<T> => {
			const result = await shared(operation);
			observed();
			await gate;
			return result;
		});
		return { entered, resume };
	};

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
		structure = new DeviceStructureLockService();
		const graph = new VirtualDependencyGraphService(database);
		events = new EventEmitter2();
		const claims = {
			holdRecoveryFence: jest.fn(() => () => undefined),
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

	it('inhibits observable rollback without falling through to a higher baseline', async () => {
		await configured();
		await overridden();
		const captured = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
		wall -= 60_000;
		elapsed += 999;
		expect(comfort.isCurrent(captured)).toBe(false);
		elapsed += 1;
		expect(comfort.isCurrent(captured)).toBe(false);
		expect(await comfort.get(id)).toMatchObject({
			configuration: { temporary_override: { status: 'clock_uncertain' } },
			effective: { source: 'override' },
		});
	});

	it('terminates an unobservable cross-downtime lifetime explicitly and never revives it on another restart', async () => {
		await configured();
		await overridden();
		wall -= 60_000;
		comfort = makeService();
		expect(await comfort.get(id)).toMatchObject({
			clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit',
			configuration: { temporary_override: { status: 'clock_uncertain' } },
			effective: { source: 'override' },
		});
		comfort = makeService();
		expect((await comfort.get(id)).configuration.temporary_override.status).toBe('clock_uncertain');
	});

	it('recovers an ordinary restart without changing a lower-demand override identity, settings or expiry', async () => {
		await configured();
		const initial = await comfort.override(
			id,
			await fence(),
			{ preset: 'eco', setpoints: null, expires_at: new Date(wall + 1000).toISOString() },
			'operator',
		);
		wall += 400;
		elapsed += 400;
		await comfort.get(id); // durable watermark
		comfort = makeService();
		const recovered = await comfort.get(id);
		expect(recovered.configuration.temporary_override).toMatchObject({
			id: initial.configuration.temporary_override.id,
			expires_at: initial.configuration.temporary_override.expires_at,
			resolved_setpoints: initial.configuration.temporary_override.resolved_setpoints,
			status: 'active',
		});
		expect(recovered.effective).toMatchObject({ source: 'override', heating_setpoint: 17 });
		wall += 599;
		elapsed += 599;
		expect((await comfort.get(id)).effective.source).toBe('override');
		wall += 1;
		elapsed += 1;
		expect((await comfort.get(id)).configuration.temporary_override.status).toBe('expired');
		wall -= 5000;
		comfort = makeService();
		expect((await comfort.get(id)).configuration.temporary_override.status).toBe('expired');
	});

	it('uses persisted watermark on rollback/restart and requires explicit cancellation of uncertainty', async () => {
		await configured();
		await comfort.override(
			id,
			await fence(),
			{ preset: 'eco', setpoints: null, expires_at: new Date(wall + 1000).toISOString() },
			'operator',
		);
		wall += 500;
		elapsed += 500;
		await comfort.get(id);
		wall -= 1;
		comfort = makeService();
		const held = await comfort.get(id);
		expect(held.configuration.temporary_override.status).toBe('clock_uncertain');
		expect(held.effective.heating_setpoint).toBe(17);
		expect(
			comfort.isCurrent(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })),
		).toBe(false);
		await comfort.cancel(id, await fence(), held.configuration.temporary_override.id);
		expect((await comfort.get(id)).effective.heating_setpoint).toBe(20);
	});

	it('inhibits invalid persisted lifetime evidence instead of treating explicit null as missing legacy metadata', async () => {
		await configured();
		await overridden();
		const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
		row.comfort.temporary_override.original_duration_ms = null;
		await database.manager.save(row);
		comfort = makeService();
		const result = await comfort.get(id);
		expect(result.configuration.temporary_override.status).toBe('clock_uncertain');
		expect(result.effective.source).toBe('override');
		expect(
			comfort.isCurrent(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })),
		).toBe(false);
	});

	it('keeps no-override reads shared and does not open watermark transactions', async () => {
		await configured();
		const exclusive = jest.spyOn(structure, 'runExclusive');
		const transaction = jest.spyOn(database, 'transaction');
		await Promise.all([comfort.settle(id), comfort.settle(id), comfort.get(id)]);
		expect(exclusive).not.toHaveBeenCalled();
		expect(transaction).not.toHaveBeenCalled();
	});

	it('preserves an override created after the no-active shared read and returns the new intent', async () => {
		await configured();
		const paused = pauseNextSharedRead();
		const reading = comfort.get(id);
		await paused.entered;
		const created = await overridden();
		paused.resume();
		const result = await reading;
		expect(result.revision).toBe(created.revision);
		expect(result.configuration.temporary_override.id).toBe(created.configuration.temporary_override.id);
		expect(result.effective.source).toBe('override');
		expect(
			comfort.isCurrent(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })),
		).toBe(true);
	});

	it.each(['cancel', 'replace'] as const)(
		're-reads current identity and revision after a concurrent %s before exclusive settlement',
		async (action) => {
			await configured();
			const original = await overridden();
			const stale = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
			wall += 500;
			elapsed += 500;
			const paused = pauseNextSharedRead();
			const settling = comfort.settle(id);
			await paused.entered;
			await comfort.cancel(id, await fence(), original.configuration.temporary_override.id);
			if (action === 'replace') await overridden(2000);
			const expected = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
			wall += 600;
			elapsed += 600;
			paused.resume();
			await Promise.all([settling, comfort.settle(id)]);
			const current = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
			expect(current.revision).toBe(expected.revision);
			expect(current.comfort.temporary_override).toMatchObject({
				id: expected.comfort.temporary_override.id,
				status: action === 'replace' ? 'active' : 'cancelled',
				expires_at: expected.comfort.temporary_override.expires_at,
			});
			expect(comfort.isCurrent(stale)).toBe(false);
			if (action === 'replace') expect(comfort.isCurrent(current)).toBe(true);
		},
	);

	it('persists every advancing active watermark without an intent revision or expiry renewal', async () => {
		await configured();
		const original = await overridden();
		for (let step = 0; step < 2; step++) {
			wall++;
			elapsed++;
			await comfort.settle(id);
			const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
			expect(row.revision).toBe(original.revision);
			expect(row.comfort.temporary_override).toMatchObject({
				id: original.configuration.temporary_override.id,
				expires_at: original.configuration.temporary_override.expires_at,
				wall_watermark_ms: wall,
			});
		}
	});

	it('fails closed on a lost watermark CAS and retries persistence without mutating the intent', async () => {
		await configured();
		const original = await overridden();
		wall += 500;
		elapsed += 500;
		await database.query(
			'CREATE TRIGGER ignore_watermark BEFORE UPDATE ON devices_virtual_thermostat_configs BEGIN SELECT RAISE(IGNORE); END',
		);
		await expect(comfort.settle(id)).rejects.toThrow('revision changed during watermark settlement');
		const unchanged = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
		expect(unchanged.comfort.temporary_override.wall_watermark_ms).toBe(
			original.configuration.temporary_override.wall_watermark_ms,
		);
		await database.query('DROP TRIGGER ignore_watermark');
		await comfort.settle(id);
		const current = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
		expect(current.revision).toBe(original.revision);
		expect(current.comfort.temporary_override.wall_watermark_ms).toBe(wall);
	});

	it('retries pending notifications exclusively even without an active override, then returns to shared reads', async () => {
		const listener = () => {
			throw new Error('notification retry fixture');
		};
		events.on('devices-virtual.thermostat.config.changed', listener);
		const original = await configured();
		events.off('devices-virtual.thermostat.config.changed', listener);
		const notified = jest.fn();
		events.on('devices-virtual.thermostat.config.changed', notified);
		const exclusive = jest.spyOn(structure, 'runExclusive');
		await comfort.settle(id);
		expect(exclusive).toHaveBeenCalledTimes(1);
		expect(notified).toHaveBeenCalledWith(id);
		await comfort.settle(id);
		expect(exclusive).toHaveBeenCalledTimes(1);
		expect((await comfort.get(id)).revision).toBe(original.revision);
	});

	it('bounds process state through replacements, cancellation, expiry and stale dispatch snapshots', async () => {
		await configured();
		const snapshots: VirtualThermostatConfigEntity[] = [];
		for (let index = 0; index < 12; index++) {
			await overridden();
			snapshots.push(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id }));
		}
		for (const snapshot of snapshots.slice(0, -1)) expect(comfort.isCurrent(snapshot)).toBe(false);
		const cache = (comfort as unknown as { leases: Map<string, unknown> }).leases;
		expect(cache.size).toBe(1);
		await comfort.cancel(id, await fence(), snapshots.at(-1).comfort.temporary_override.id);
		expect(cache.size).toBe(0);
		for (const snapshot of snapshots) expect(comfort.isCurrent(snapshot)).toBe(false);
		expect(cache.size).toBe(0);
		await overridden();
		elapsed += 1000;
		await comfort.get(id);
		expect(cache.size).toBe(0);
	});

	it('keeps committed results successful when a real listener throws, and retries publication without mutation replay', async () => {
		await configured();
		const listener = () => {
			throw new Error('listener failed after commit');
		};
		events.on('devices-virtual.thermostat.config.changed', listener);
		const configuredResult = await comfort.configure(id, await fence(), input());
		expect(configuredResult.configuration.automation_enabled).toBe(false);
		const before = await fence();
		const result = await overridden();
		expect(result.revision).toBe(before.expected_revision + 1);
		const identity = result.configuration.temporary_override.id;
		const selected = await comfort.select(id, await fence(), 'eco', false);
		expect(selected.configuration.temporary_override.id).toBe(identity);
		elapsed += 1000;
		const settled = await comfort.get(id);
		expect(settled.configuration.temporary_override.status).toBe('expired');
		events.off('devices-virtual.thermostat.config.changed', listener);
		const notified = jest.fn();
		events.on('devices-virtual.thermostat.config.changed', notified);
		const after = await comfort.get(id);
		expect(after.revision).toBe(settled.revision);
		expect(notified).toHaveBeenCalledWith(id);
		const next = await overridden();
		events.on('devices-virtual.thermostat.config.changed', listener);
		const cancelled = await comfort.cancel(id, await fence(), next.configuration.temporary_override.id);
		expect(cancelled.configuration.temporary_override).toMatchObject({
			id: next.configuration.temporary_override.id,
			status: 'cancelled',
		});
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

	it('refuses actor-only baselines and preserves manual, override and OFF intent', async () => {
		await configured();
		const refuseBaseline = async (selection: Parameters<VirtualThermostatComfortService['applyAutomationBaseline']>[2]) => {
			const expected = await fence();
			const tables = await database.query<{ name: string }[]>(
				"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
			);
			const before: unknown[] = [];
			for (const table of tables) before.push(await database.query('SELECT * FROM "' + table.name.replace(/"/g, '""') + '" ORDER BY rowid'));
			await expect(comfort.applyAutomationBaseline(id, expected, selection, 'space-bridge')).rejects.toThrow(
				'Original automation source capability required',
			);
			const after: unknown[] = [];
			for (const table of tables) after.push(await database.query('SELECT * FROM "' + table.name.replace(/"/g, '""') + '" ORDER BY rowid'));
			expect(after).toEqual(before);
		};
		await refuseBaseline({ preset: 'eco', setpoints: null });
		await comfort.configure(id, await fence(), { ...input(), automation_enabled: true });
		await refuseBaseline({ preset: 'eco', setpoints: null });
		expect((await comfort.get(id)).effective).toMatchObject({ source: 'manual', preset: null, heating_setpoint: 20 });
		await overridden();
		await refuseBaseline({ preset: null, setpoints: { heating_setpoint: 18, cooling_setpoint: null } });
		expect((await comfort.get(id)).effective.heating_setpoint).toBe(23);
		elapsed += 1000;
		expect((await comfort.get(id)).effective).toMatchObject({ source: 'manual', preset: null, heating_setpoint: 20 });
		await database.manager.update(VirtualThermostatConfigEntity, { controllerId: id }, { requestedMode: 'off' });
		const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
		row.comfort.user_off = true;
		await database.manager.save(row);
		await refuseBaseline({ preset: 'comfort', setpoints: null });
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
	// BEGIN comfort entry admission regressions (SOURCE-ONLY drafts; actual claims, no physical qualification)
	describe('original actual claims capture across comfort mutation lifetime', () => {
		let actualClaims: VirtualThermostatClaimsService;
		let actualGraph: VirtualDependencyGraphService;
		const barrier = () => {
			let open: () => void = () => {
				throw new Error('Barrier not initialized');
			};
			const promise = new Promise<void>((resolve) => {
				open = resolve;
			});
			return { promise, open: () => open() };
		};
		const observeOwnedHolds = () => {
			const originalMethods: {
				readonly holdRecoveryFence: { call: (receiver: VirtualThermostatClaimsService) => () => void };
			} = actualClaims;
			const original = originalMethods.holdRecoveryFence;
			const releases: jest.Mock<void, []>[] = [];
			const hold = jest.spyOn(actualClaims, 'holdRecoveryFence').mockImplementation(() => {
				const owned = original.call(actualClaims);
				const release = jest.fn(() => owned());
				releases.push(release);
				return release;
			});
			return { hold, releases };
		};
		beforeEach(async () => {
			await configured(); // existing ordinary config setup, not an admission-positive stand-in
			actualGraph = new VirtualDependencyGraphService(database);
			actualClaims = new VirtualThermostatClaimsService(
				database,
				structure,
				actualGraph,
				new PropertyCommandAdmissionRegistryService(),
				events,
				new ConfigService({ FB_CLI: 'off' }),
			);
			await actualClaims.onApplicationBootstrap();
			comfort = new VirtualThermostatComfortService(database, structure, actualGraph, actualClaims, events);
			expect(actualClaims.capture().isCurrent()).toBe(true);
		});
		afterEach(() => {
			actualClaims?.onModuleDestroy();
		});

		it.each(['configure', 'select', 'override', 'cancel'] as const)(
			'closes a previously current original no-argument capture before %s first settlement read',
			async (operation) => {
				await comfort.configure(id, await fence(), { ...input(), automation_enabled: true });
				if (operation === 'cancel') await overridden();
				const before = await comfort.get(id),
					expected = await fence();
				const overrideId = before.configuration?.temporary_override?.id;
				const original = actualClaims.capture();
				expect(original.isCurrent()).toBe(true);
				const owned = observeOwnedHolds(),
					entered = barrier(),
					resume = barrier();
				let first = true;
				database.subscribers.push({
					beforeQuery: async (event) => {
						if (
							!first ||
							!event.query.startsWith('SELECT') ||
							!event.query.includes('devices_virtual_thermostat_configs')
						)
							return;
						first = false;
						entered.open();
						await resume.promise;
					},
				});
				let action: () => ReturnType<VirtualThermostatComfortService['get']>;
				if (operation === 'configure')
					action = () => comfort.configure(id, expected, { ...input(), automation_enabled: true });
				else if (operation === 'select') action = () => comfort.select(id, expected, 'eco', false);
				else if (operation === 'override')
					action = () =>
						comfort.override(
							id,
							expected,
							{ preset: 'eco', setpoints: null, expires_at: new Date(wall + 1000).toISOString() },
							'operator',
						);
				else {
					if (!overrideId) throw new Error('Missing real override identity');
					action = () => comfort.cancel(id, expected, overrideId);
				}
				const result = action();
				void result.catch(() => undefined);
				try {
					expect(original.isCurrent()).toBe(false);
					expect(owned.hold).toHaveBeenCalledTimes(1);
					await entered.promise;
					expect(owned.releases[0]).not.toHaveBeenCalled();
					expect(actualClaims.capture().isCurrent()).toBe(false);
					resume.open();
					await result;
					expect(owned.releases[0]).toHaveBeenCalledTimes(1);
					expect(original.isCurrent()).toBe(false);
					expect(actualClaims.capture().isCurrent()).toBe(true);
				} finally {
					resume.open();
					await result.catch(() => undefined);
				}
			},
		);

		it.each(['valid', 'null', 'getters'])('refuses actor-only %s input before authority I/O without closing the original capture', async (kind) => {
			const expected = await fence();
			const original = actualClaims.capture();
			expect(original.isCurrent()).toBe(true);
			const owned = observeOwnedHolds();
			const graphWrite = jest.spyOn(actualGraph, 'withStructuralWrite');
			const emitted = jest.spyOn(events, 'emit');
			let queries = 0;
			const observer = { beforeQuery: () => { queries++; } };
			const selection: Parameters<VirtualThermostatComfortService['applyAutomationBaseline']>[2] = kind === 'null'
				? null : kind === 'getters' ? {
					get preset(): never { throw new Error('Actor selection getter must not run'); },
					get setpoints(): never { throw new Error('Actor selection getter must not run'); },
				} : { preset: 'eco', setpoints: null };
			database.subscribers.push(observer);
			try {
				await expect(comfort.applyAutomationBaseline(id, expected, selection, 'space-bridge')).rejects.toThrow(
					'Original automation source capability required',
				);
				expect(queries).toBe(0);
				expect(owned.hold).not.toHaveBeenCalled();
				expect(owned.releases).toEqual([]);
				expect(graphWrite).not.toHaveBeenCalled();
				expect(emitted).not.toHaveBeenCalled();
				expect(original.isCurrent()).toBe(true);
			} finally {
				database.subscribers.splice(database.subscribers.indexOf(observer), 1);
				emitted.mockRestore();
				graphWrite.mockRestore();
			}
		});

		it.each(['missing', 'locked', 'stale', 'invalid'] as const)(
			'releases exactly its own hold after actual %s rejection without changing the old row',
			async (failure) => {
				const expected = await fence();
				if (failure === 'locked')
					await database.manager.update(VirtualThermostatConfigEntity, { controllerId: id }, { locked: true });
				const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
				const original = actualClaims.capture();
				expect(original.isCurrent()).toBe(true);
				const owned = observeOwnedHolds();
				const badInput = input();
				if (failure === 'invalid') badInput.presets[0].setpoints.heating_setpoint = 99;
				const result = comfort.configure(
					failure === 'missing' ? randomUUID() : id,
					failure === 'stale' ? { ...expected, expected_revision: expected.expected_revision + 1 } : expected,
					badInput,
				);
				expect(original.isCurrent()).toBe(false);
				await expect(result).rejects.toThrow();
				expect(owned.hold).toHaveBeenCalledTimes(1);
				expect(owned.releases[0]).toHaveBeenCalledTimes(1);
				expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).toEqual(
					before,
				);
				expect(original.isCurrent()).toBe(false);
				expect(actualClaims.capture().isCurrent()).toBe(true);
			},
		);

		it.each([false, true])(
			'keeps its hold through an awaited response and response rejection:%s',
			async (rejectResponse) => {
				const expected = await fence(),
					original = actualClaims.capture(),
					owned = observeOwnedHolds();
				const entered = barrier(),
					resume = barrier(),
					failure = new Error('response read rejected');
				const realGetMethods: {
					readonly get: {
						call: (
							receiver: VirtualThermostatComfortService,
							controllerId: string,
						) => ReturnType<VirtualThermostatComfortService['get']>;
					};
				} = comfort;
				const realGet = realGetMethods.get;
				jest.spyOn(comfort, 'get').mockImplementationOnce(async (controllerId) => {
					const response = await realGet.call(comfort, controllerId);
					entered.open();
					await resume.promise;
					if (rejectResponse) throw failure;
					return response;
				});
				const result = comfort.select(id, expected, 'eco', false);
				void result.catch(() => undefined);
				try {
					await entered.promise;
					expect(owned.releases[0]).not.toHaveBeenCalled();
					expect(actualClaims.capture().isCurrent()).toBe(false);
					const committed = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
					expect(committed.comfort.selected_preset).toBe('eco');
					expect(committed.revision).toBe(expected.expected_revision + 1);
					resume.open();
					if (rejectResponse) await expect(result).rejects.toBe(failure);
					else expect((await result).configuration.selected_preset).toBe('eco');
					expect(owned.releases[0]).toHaveBeenCalledTimes(1);
					expect(original.isCurrent()).toBe(false);
					expect(actualClaims.capture().isCurrent()).toBe(true);
				} finally {
					resume.open();
					await result.catch(() => undefined);
				}
			},
		);

		it('keeps original result and closed admission when the actual final read-only refresh fails', async () => {
			const expected = await fence(),
				original = actualClaims.capture();
			const realHoldMethods: {
				readonly holdRecoveryFence: { call: (receiver: VirtualThermostatClaimsService) => () => void };
			} = actualClaims;
			const realHold = realHoldMethods.holdRecoveryFence;
			let released = false,
				rejected = 0;
			const release = jest.fn<void, []>();
			jest.spyOn(actualClaims, 'holdRecoveryFence').mockImplementation(() => {
				const owned = realHold.call(actualClaims);
				release.mockImplementation(() => {
					owned();
					released = true;
				});
				return release;
			});
			database.subscribers.push({
				beforeQuery: (event) => {
					if (
						released &&
						event.query.startsWith('SELECT') &&
						event.query.includes('devices_virtual_thermostat_actuator_claims')
					) {
						rejected++;
						throw new Error('final refresh SQL failure');
					}
				},
			});
			const response = await comfort.select(id, expected, 'eco', false);
			expect(response.configuration.selected_preset).toBe('eco');
			expect(release).toHaveBeenCalledTimes(1);
			expect(rejected).toBe(1);
			expect(original.isCurrent()).toBe(false);
			expect(actualClaims.capture().isCurrent()).toBe(false);
			released = false;
			await actualClaims.refresh();
			expect(actualClaims.capture().isCurrent()).toBe(true);
			expect(original.isCurrent()).toBe(false);
		});

		it.each(['refresh', 'event'] as const)(
			'retains committed data and existing notification retry after changed %s failure',
			async (boundary) => {
				const expected = await fence(),
					original = actualClaims.capture(),
					owned = observeOwnedHolds();
				let fail = true;
				if (boundary === 'refresh')
					database.subscribers.push({
						beforeQuery: (event) => {
							if (
								fail &&
								event.query.startsWith('SELECT') &&
								event.query.includes('devices_virtual_thermostat_actuator_claims')
							) {
								fail = false;
								throw new Error('changed refresh failure');
							}
						},
					});
				const listener = jest.fn(() => {
					if (boundary === 'event' && fail) {
						fail = false;
						throw new Error('changed event failure');
					}
				});
				events.on(THERMOSTAT_CONFIG_CHANGED, listener);
				try {
					const response = await comfort.select(id, expected, 'eco', false);
					expect(response.configuration.selected_preset).toBe('eco');
					expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2);
					expect(owned.releases[0]).toHaveBeenCalledTimes(1);
					expect(original.isCurrent()).toBe(false);
					const calls = listener.mock.calls.length;
					await comfort.settle(id);
					expect(listener).toHaveBeenCalledTimes(calls);
				} finally {
					events.off(THERMOSTAT_CONFIG_CHANGED, listener);
				}
			},
		);

		it('does not reopen after A releases while B still owns its held response', async () => {
			const expectedA = await fence(),
				original = actualClaims.capture(),
				owned = observeOwnedHolds();
			const aEntered = barrier(),
				bEntered = barrier(),
				aResume = barrier(),
				bResume = barrier();
			const realGetMethods: {
				readonly get: {
					call: (
						receiver: VirtualThermostatComfortService,
						controllerId: string,
					) => ReturnType<VirtualThermostatComfortService['get']>;
				};
			} = comfort;
			const realGet = realGetMethods.get;
			let responses = 0;
			jest.spyOn(comfort, 'get').mockImplementation(async (controllerId) => {
				const ordinal = ++responses,
					response = await realGet.call(comfort, controllerId);
				if (ordinal === 1) {
					aEntered.open();
					await aResume.promise;
				}
				if (ordinal === 2) {
					bEntered.open();
					await bResume.promise;
				}
				return response;
			});
			const a = comfort.select(id, expectedA, 'eco', false);
			void a.catch(() => undefined);
			let b: ReturnType<VirtualThermostatComfortService['get']> | undefined;
			try {
				await aEntered.promise;
				const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
				b = comfort.select(
					id,
					{ expected_revision: row.revision, expected_graph_revision: await actualGraph.revision() },
					'comfort',
					false,
				);
				void b.catch(() => undefined);
				await bEntered.promise;
				aResume.open();
				await a;
				expect(owned.releases[0]).toHaveBeenCalledTimes(1);
				expect(owned.releases[1]).not.toHaveBeenCalled();
				expect(actualClaims.capture().isCurrent()).toBe(false);
				expect(original.isCurrent()).toBe(false);
				bResume.open();
				await b;
				expect(owned.releases[1]).toHaveBeenCalledTimes(1);
				expect(actualClaims.capture().isCurrent()).toBe(true);
				expect(original.isCurrent()).toBe(false);
			} finally {
				aResume.open();
				bResume.open();
				await a.catch(() => undefined);
				if (b !== undefined) await b.catch(() => undefined);
			}
		});

		it.each([null, 'eco'] as const)(
			'preserves both explicit OFF-clear flags for preset:%s under the real hold',
			async (preset) => {
				for (const clear of [false, true]) {
					await database.manager.update(VirtualThermostatConfigEntity, { controllerId: id }, { requestedMode: 'off' });
					const row = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
					row.comfort.user_off = true;
					await database.manager.save(row);
					const response = await comfort.select(id, await fence(), preset, clear);
					expect(response.configuration.selected_preset).toBe(preset);
					expect(response.configuration.user_off).toBe(!clear);
					expect(
						(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).requestedMode,
					).toBe('off');
				}
			},
		);
	});
	// END comfort entry admission regressions
});
