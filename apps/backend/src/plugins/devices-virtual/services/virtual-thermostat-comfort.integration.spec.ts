import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	SqliteCommitGuardReceipt,
	SqliteDataSource,
	observeSqliteOuterOutcome,
} from '../../../common/database/sqlite-data-source';
import { AddVirtualThermostatComfort1000000000039 } from '../../../migrations/1000000000039-AddVirtualThermostatComfort';
import { ClimateAutomationSlotFacts } from '../../../modules/devices/contracts/climate-automation.contract';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	ClimateAutomationSlotEntity,
	ClimateAutomationSourceEntity,
} from '../../../modules/devices/entities/climate-automation.entity';
import { ChannelEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { ClimateAutomationLedgerService } from '../../../modules/devices/services/climate-automation-ledger.service';
import { ClimateAutomationRegistryService } from '../../../modules/devices/services/climate-automation.registry.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualThermostatConfigEntity, VirtualThermostatSettingEntity } from '../entities/virtual-thermostat.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import {
	THERMOSTAT_AUTOMATION_PROVIDER,
	VirtualThermostatAutomationService,
} from './virtual-thermostat-automation.service';
import { VirtualThermostatClaimsService } from './virtual-thermostat-claims.service';
import { VirtualThermostatComfortService } from './virtual-thermostat-comfort.service';
import { validateThermostatComfort } from './virtual-thermostat-comfort.utils';
import { VirtualThermostatConfigService } from './virtual-thermostat-config.service';
import { thermostatPropertyContract } from './virtual-thermostat-contract.utils';

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

	it.each(['definition', 'selection'] as const)(
		'keeps an exact %s repeat native-unchanged, including MAX, while retaining final GET',
		async (kind) => {
			await configured();
			if (kind === 'selection') await comfort.select(id, await fence(), 'eco', false);
			const snapshot = async () => {
				const rows: Record<string, unknown[]> = {};
				for (const table of database.entityMetadatas.map((metadata) => metadata.tableName).sort())
					rows[table] = await database.query<unknown[]>(`SELECT * FROM "${table.replace(/"/g, '""')}" ORDER BY rowid`);
				return rows;
			};
			const emit = jest.spyOn(events, 'emit');
			const get = jest.spyOn(comfort, 'get');
			for (const max of [false, true]) {
				if (max) {
					await database.manager.update(
						VirtualThermostatConfigEntity,
						{ controllerId: id },
						{ revision: Number.MAX_SAFE_INTEGER },
					);
					await database.query('UPDATE devices_virtual_graph_revision SET revision=?', [Number.MAX_SAFE_INTEGER]);
				}
				const originalFence = await fence(),
					before = await snapshot();
				emit.mockClear();
				get.mockClear();
				const result =
					kind === 'definition'
						? await comfort.configure(id, originalFence, input())
						: await comfort.select(id, originalFence, 'eco', false);
				expect(result.revision).toBe(originalFence.expected_revision);
				expect(result.graph_revision).toBe(originalFence.expected_graph_revision);
				expect(await snapshot()).toEqual(before);
				expect(emit).not.toHaveBeenCalled();
				expect(get).toHaveBeenCalledTimes(1);
				await expect(
					comfort.select(
						id,
						{ ...originalFence, expected_graph_revision: originalFence.expected_graph_revision - 1 },
						'eco',
						false,
					),
				).rejects.toThrow();
				expect(await snapshot()).toEqual(before);
				get.mockRejectedValueOnce(false);
				await expect(
					kind === 'definition'
						? comfort.configure(id, originalFence, input())
						: comfort.select(id, originalFence, 'eco', false),
				).rejects.toBe(false);
				expect(await snapshot()).toEqual(before);
				await expect(
					comfort.select(
						id,
						{ ...originalFence, expected_revision: originalFence.expected_revision - 1 },
						'eco',
						false,
					),
				).rejects.toThrow();
				expect(await snapshot()).toEqual(before);
				if (max) {
					await expect(comfort.select(id, originalFence, 'comfort', false)).rejects.toThrow();
					expect(await snapshot()).toEqual(before);
				}
			}
		},
	);

	it.each([Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER])(
		'settles expiry without overflowing revision %s',
		async (revision) => {
			await configured();
			await overridden();
			await database.manager.update(VirtualThermostatConfigEntity, { controllerId: id }, { revision });
			const before = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
			wall += 1001;
			elapsed += 1001;
			if (revision === Number.MAX_SAFE_INTEGER) {
				await expect(comfort.settle(id)).rejects.toThrow('overflow');
				expect(await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id })).toEqual(
					before,
				);
				expect(comfort.isCurrent(before)).toBe(false);
			} else {
				await comfort.settle(id);
				const after = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
				expect(after.revision).toBe(Number.MAX_SAFE_INTEGER);
				expect(after.comfort.temporary_override.status).toBe('expired');
			}
		},
	);
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

	it.each([
		{ userOff: false, retirement: 'preset' },
		{ userOff: true, retirement: 'preset' },
		{ userOff: false, retirement: 'disable' },
		{ userOff: true, retirement: 'disable' },
		{ userOff: false, retirement: 'remove' },
		{ userOff: true, retirement: 'remove' },
		{ userOff: false, retirement: 'locked' },
		{ userOff: true, retirement: 'locked' },
		{ userOff: false, retirement: 'setpoint' },
		{ userOff: true, retirement: 'setpoint' },
	])(
		'requires the real installed provider/source/slot view through override recovery and $retirement retirement with user_off=$userOff',
		async ({ userOff, retirement }) => {
			await configured();
			await comfort.configure(id, await fence(), { ...input(), automation_enabled: true });
			if (userOff) {
				const initial = await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id });
				initial.comfort.user_off = true;
				await database.manager.save(initial);
			}
			let manualCommand: IDevicePropertyData | undefined;
			if (retirement === 'locked' || retirement === 'setpoint') {
				const channelId = randomUUID(),
					propertyId = randomUUID();
				const locked = retirement === 'locked';
				await database.manager.insert(VirtualChannelEntity, {
					id: channelId,
					device: id,
					name: 'Manual settings',
					identifier: 'manual',
					category: locked ? ChannelCategory.THERMOSTAT : ChannelCategory.HEATER,
				});
				await database.manager.insert(VirtualChannelPropertyEntity, {
					id: propertyId,
					channel: channelId,
					identifier: locked ? 'locked' : 'temperature',
					category: locked ? PropertyCategory.LOCKED : PropertyCategory.TEMPERATURE,
					dataType: locked ? DataTypeType.BOOL : DataTypeType.FLOAT,
					permissions: [PermissionType.READ_WRITE],
					valueOrigin: VirtualValueOrigin.LOCAL,
					sourcePropertyId: null,
				});
				const property = await database.manager.findOneOrFail(VirtualChannelPropertyEntity, {
					where: { id: propertyId },
					relations: ['channel', 'channel.device'],
				});
				const channel = property.channel as ChannelEntity;
				const device = channel.device as DeviceEntity;
				await database.manager.insert(VirtualThermostatSettingEntity, {
					controllerId: id,
					propertyId,
					setting: locked ? 'locked' : 'heating_setpoint',
					contractFingerprint: thermostatPropertyContract(property, channel, device),
				});
				manualCommand = { property, channel, device, value: locked ? true : 20 };
			}
			const registry = new ClimateAutomationRegistryService();
			const ledger = new ClimateAutomationLedgerService(database, structure, registry);
			const graph = new VirtualDependencyGraphService(database, undefined, ledger);
			const automation = new VirtualThermostatAutomationService(database, registry, ledger, graph, structure);
			const claims = {
				invalidate: jest.fn(),
				refresh: jest.fn().mockResolvedValue(undefined),
			} as unknown as VirtualThermostatClaimsService;
			const service = new VirtualThermostatComfortService(database, structure, graph, claims, events, automation);
			// This tests the production thermostat participant. The actual activity producer/HTTP pack is separate.
			registry.registerProducerOwned('test-activity:v1', {
				validateInManager: () => Promise.resolve({ selection: 'eco' }),
			});
			automation.onModuleInit();
			try {
				let receipt: SqliteCommitGuardReceipt;
				let installed: ClimateAutomationSlotFacts;
				await structure.runExclusiveReleased(() =>
					graph.withControllerMutationWrite(
						async (manager) => {
							await automation.explicitOptIn(manager, id);
							const scope = ledger.currentScope(manager);
							const previous = await ledger.readSource(manager, scope, 'test-activity:v1', 'room');
							const source = await ledger.stageSource(manager, scope, {
								producerKey: 'test-activity:v1',
								subjectId: 'room',
								expected: previous,
								evidence: { selection: 'eco' },
							});
							const slot = await ledger.readSlot(manager, scope, id, true, THERMOSTAT_AUTOMATION_PROVIDER);
							const candidate = await ledger.stageSlot(manager, scope, {
								expectedSlot: slot,
								expectedSource: source,
								selection: { preset: 'eco', setpoints: null },
								bundleId: randomUUID(),
							});
							[installed] = (await ledger.installBundle(manager, scope, source, [candidate])).map(({ facts }) => facts);
							await graph.sealControllerLedger(manager);
						},
						undefined,
						(manager) => {
							receipt = observeSqliteOuterOutcome(manager);
						},
						() => {
							expect(receipt.outcome).toBe('committed');
						},
					),
				);
				expect((await service.get(id)).effective).toMatchObject({
					source: userOff ? 'user_off' : 'manual',
					heating_setpoint: 20,
				});
				expect(await automation.activateLocal(database.manager, installed)).toBe(true);
				// A suspended original local admission cannot undo a later synchronous mutation fence.
				const originalRead = database.manager.findOneBy.bind(database.manager) as typeof database.manager.findOneBy;
				let releaseRead: () => void;
				let readEntered: () => void;
				const heldRead = new Promise<void>((resolve) => {
					releaseRead = resolve;
				});
				const enteredRead = new Promise<void>((resolve) => {
					readEntered = resolve;
				});
				let holdSource = true;
				const readSpy = jest
					.spyOn(database.manager, 'findOneBy')
					.mockImplementation(async (...args: Parameters<typeof database.manager.findOneBy>) => {
						const result = await originalRead(...args);
						if (args[0] === ClimateAutomationSourceEntity && holdSource) {
							holdSource = false;
							readEntered();
							await heldRead;
						}
						return result;
					});
				try {
					const pendingAdmission = automation.activateLocal(database.manager, installed);
					await enteredRead;
					await automation.beginMutation(id);
					releaseRead();
					expect(await pendingAdmission).toBe(false);
					expect((await service.get(id)).effective.source).toBe(userOff ? 'user_off' : 'manual');
				} finally {
					releaseRead?.();
					readSpy.mockRestore();
				}
				expect(await automation.activateLocal(database.manager, installed)).toBe(true);
				const originalView = await automation.resolve(
					database.manager,
					await database.manager.findOneByOrFail(VirtualThermostatConfigEntity, { controllerId: id }),
				);
				await structure.runExclusive(() => graph.withStructuralWrite(() => Promise.resolve(undefined)));
				expect(originalView.isCurrent()).toBe(false);

				expect((await service.get(id)).effective).toMatchObject({
					source: userOff ? 'user_off' : 'automation',
					preset: 'eco',
					heating_setpoint: 17,
				});
				const currentFence = async () => {
					const current = await service.get(id);
					return { expected_revision: current.revision, expected_graph_revision: current.graph_revision };
				};
				for (const flag of ['omitted', 'undefined', 'null', 'true'] as const) {
					const payload =
						flag === 'omitted'
							? input()
							: {
									...input(),
									automation_enabled: flag === 'null' ? null : flag === 'true' ? true : undefined,
								};
					const definition = await service.configure(id, await currentFence(), payload);
					expect(definition.effective).toMatchObject({
						source: userOff ? 'user_off' : 'automation',
						preset: 'eco',
						heating_setpoint: 17,
					});
					expect((await service.get(id)).effective).toEqual(definition.effective);
					expect(
						await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id }),
					).toMatchObject({
						state: 'LIVE',
						candidateId: installed.candidateId,
						manualCounter: installed.manualCounter,
					});
				}
				const override = await service.override(
					id,
					await currentFence(),
					{ preset: 'comfort', setpoints: null, expires_at: new Date(wall + 1000).toISOString() },
					'operator',
				);
				expect(override.effective).toMatchObject({ source: userOff ? 'user_off' : 'override', heating_setpoint: 23 });
				wall += 100;
				elapsed += 100;
				expect((await service.get(id)).effective).toMatchObject({
					source: userOff ? 'user_off' : 'override',
					heating_setpoint: 23,
				});
				const watermarkSlot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, {
					controllerId: id,
				});
				expect(watermarkSlot).toMatchObject({
					state: 'LIVE',
					manualCounter: installed.manualCounter,
					candidateId: installed.candidateId,
				});
				const cancelled = await service.cancel(id, await currentFence(), override.configuration.temporary_override.id);
				expect((await service.get(id)).effective).toMatchObject({
					source: userOff ? 'user_off' : 'automation',
					preset: 'eco',
					heating_setpoint: 17,
				});
				expect(cancelled.configuration.temporary_override.status).toBe('cancelled');
				expect(cancelled.effective).toMatchObject({
					source: userOff ? 'user_off' : 'automation',
					preset: 'eco',
					heating_setpoint: 17,
				});
				await service.override(
					id,
					await currentFence(),
					{
						preset: null,
						setpoints: { heating_setpoint: 25, cooling_setpoint: null },
						expires_at: new Date(wall + 1000).toISOString(),
					},
					'operator',
				);
				wall += 1000;
				elapsed += 1000;
				expect((await service.get(id)).effective).toMatchObject({
					source: userOff ? 'user_off' : 'automation',
					preset: 'eco',
					heating_setpoint: 17,
				});
				if (manualCommand) {
					const before = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id });
					const valueCalls = {
						write: jest.fn().mockResolvedValue(true),
						readLatest: jest.fn().mockResolvedValue(null),
					};
					const values = valueCalls as unknown as PropertyValueService;
					const configurations = new VirtualThermostatConfigService(
						database,
						structure,
						graph,
						claims,
						events,
						values,
						undefined,
						automation,
					);
					expect(await configurations.command([manualCommand, manualCommand])).toBe(true);
					const slot = await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id });
					expect(slot).toMatchObject({
						state: 'RETIRED',
						manualHold: retirement === 'setpoint',
						manualCounter: before.manualCounter + (retirement === 'setpoint' ? 1 : 0),
						candidateId: before.candidateId,
						controllerIncarnation: before.controllerIncarnation,
					});
					if (retirement === 'locked') expect(slot.manualGeneration).toBe(before.manualGeneration);
					else expect(slot.manualGeneration).not.toBe(before.manualGeneration);
					expect(valueCalls.write).toHaveBeenCalledTimes(2);
					expect(valueCalls.readLatest).toHaveBeenCalledTimes(2);
					expect((await service.get(id)).effective).toMatchObject({
						source: userOff ? 'user_off' : 'manual',
						heating_setpoint: 20,
					});
				} else if (retirement === 'disable' || retirement === 'remove') {
					const definition = input();
					const disabled = await service.configure(id, await currentFence(), {
						...definition,
						automation_enabled: retirement !== 'disable',
						presets:
							retirement === 'remove'
								? definition.presets.filter(({ preset }) => preset !== 'eco')
								: definition.presets,
					});
					expect(disabled.configuration.automation_baseline).toBeNull();
					expect(disabled.effective).toMatchObject({ source: userOff ? 'user_off' : 'manual', heating_setpoint: 20 });
					expect(
						await database.manager.findOneByOrFail(ClimateAutomationSlotEntity, { controllerId: id }),
					).toMatchObject({
						state: 'RETIRED',
						manualHold: false,
						manualCounter: installed.manualCounter + 1,
					});
				} else {
					const current = await service.get(id);
					await service.select(
						id,
						{ expected_revision: current.revision, expected_graph_revision: current.graph_revision },
						'comfort',
						false,
					);
					expect(await database.manager.findOneBy(ClimateAutomationSlotEntity, { controllerId: id })).toMatchObject({
						state: 'RETIRED',
						manualHold: false,
					});
					expect((await service.get(id)).effective).toMatchObject({
						source: userOff ? 'user_off' : 'preset',
						preset: 'comfort',
						heating_setpoint: 23,
					});
				}
				expect(await automation.activateLocal(database.manager, installed)).toBe(false);
			} finally {
				automation.onModuleDestroy();
				registry.onModuleDestroy();
			}
		},
	);

	it('requires explicit opt-in but never promotes actor-tagged JSON over manual, override or OFF intent', async () => {
		await configured();
		await expect(
			comfort.applyAutomationBaseline(id, await fence(), { preset: 'eco', setpoints: null }, 'space-bridge'),
		).rejects.toThrow('not explicitly enabled');
		await comfort.configure(id, await fence(), { ...input(), automation_enabled: true });
		await comfort.applyAutomationBaseline(id, await fence(), { preset: 'eco', setpoints: null }, 'space-bridge');
		expect((await comfort.get(id)).effective).toMatchObject({
			source: 'manual',
			preset: null,
			heating_setpoint: 20,
		});
		await overridden();
		await comfort.applyAutomationBaseline(
			id,
			await fence(),
			{ preset: null, setpoints: { heating_setpoint: 18, cooling_setpoint: null } },
			'space-bridge',
		);
		expect((await comfort.get(id)).configuration.automation_baseline).toMatchObject({
			actor_id: 'space-bridge',
			setpoints: { heating_setpoint: 18, cooling_setpoint: null },
		});
		expect((await comfort.get(id)).effective).toMatchObject({ source: 'override', heating_setpoint: 23 });
		elapsed += 1000;
		expect((await comfort.get(id)).effective).toMatchObject({
			source: 'manual',
			preset: null,
			heating_setpoint: 20,
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
