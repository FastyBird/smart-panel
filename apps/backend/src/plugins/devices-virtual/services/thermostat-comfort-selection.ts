import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { DataSource, EntityManager, IsNull, QueryRunner } from 'typeorm';

import { NotFoundException } from '@nestjs/common';

import {
	SqliteCommitGuardReceipt,
	SqliteDataSource,
	observeSqliteOuterOutcome,
	registerSqliteCommitGuard,
} from '../../../common/database/sqlite-data-source';
import { ClimateAutomationSlotSnapshot } from '../../../modules/devices/contracts/climate-automation.contract';
import { DevicesValidationException } from '../../../modules/devices/devices.exceptions';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { canonical, ownedJson } from '../../../modules/devices/services/climate-automation-ledger.utils';
import { captureCreation } from '../../../modules/devices/services/creation-capture';
import {
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';
import { VirtualGraphRevisionEntity } from '../entities/virtual-producer.entity';
import {
	ThermostatSetting,
	VirtualThermostatActuatorClaimEntity,
	VirtualThermostatConfigEntity,
	VirtualThermostatSettingEntity,
} from '../entities/virtual-thermostat.entity';

import type { ThermostatComfortFence } from './virtual-thermostat-comfort.service';
import {
	ThermostatComfortConfiguration,
	ThermostatEffectiveComfort,
	ThermostatPreset,
	ThermostatSetpoints,
	effectiveThermostatComfort,
	validateThermostatComfort,
	validateThermostatSetpoints,
} from './virtual-thermostat-comfort.utils';
import { thermostatPropertyContract } from './virtual-thermostat-contract.utils';
import { validateVirtualThermostatPolicy } from './virtual-thermostat-policy.utils';

interface RegisteredInput {
	readonly kind: 'registered-settings';
	readonly id: string;
	readonly commands: readonly Readonly<{
		propertyId: string;
		channelId: string;
		deviceId: string;
		contract: string;
		value: string | number | boolean;
	}>[];
}
interface ManualResult {
	readonly configuration: ReturnType<typeof configImage>;
	readonly owner: Readonly<{ id: string; enabled: boolean; type: string }>;
	readonly graph_revision: number;
	readonly commands: RegisteredInput['commands'];
}

interface ReleaseInput {
	readonly kind: 'release-request';
	readonly id: string;
	readonly expectedRevision: number;
}
interface ReleaseResult {
	readonly input: ReleaseInput;
	readonly configuration: ReturnType<typeof configImage>;
	readonly claims: readonly ReturnType<typeof claimImage>[];
	readonly claimIds: readonly string[];
	readonly graph_revision: number;
	readonly timestamp: number;
}

function claimImage(row: VirtualThermostatActuatorClaimEntity, milliseconds: (date: Date | null) => number | null) {
	return {
		id: row.id,
		controllerId: row.controllerId,
		role: row.role,
		physicalIdentity: row.physicalIdentity,
		providerProfile: row.providerProfile,
		providerProfileVersion: row.providerProfileVersion,
		sourcePropertyId: row.sourcePropertyId,
		sourcePropertyIdentity: row.sourcePropertyIdentity,
		sourceDeviceId: row.sourceDeviceId,
		sourceDeviceIdentity: row.sourceDeviceIdentity,
		contractFingerprint: row.contractFingerprint,
		revision: row.revision,
		qualificationGeneration: row.qualificationGeneration,
		state: row.state,
		leaseSeconds: row.leaseSeconds,
		reason: row.reason,
		releaseRequestedAt: milliseconds(row.releaseRequestedAt),
		releasedAt: milliseconds(row.releasedAt),
		releaseEvidence: row.releaseEvidence,
	};
}

/** Fixed persisted columns only; DB dates become owned scalars, never live-entity canonicalization. */
function configImage(
	row: VirtualThermostatConfigEntity,
	milliseconds = (date: Date | null): number | null => (date === null ? null : date.getTime()),
) {
	return {
		controllerId: row.controllerId,
		displayFloorClaimId: row.displayFloorClaimId,
		ownerDeviceId: row.ownerDeviceId,
		schemaVersion: row.schemaVersion,
		revision: row.revision,
		requestedMode: row.requestedMode,
		controlStrategy: row.controlStrategy,
		locked: row.locked,
		comfort: row.comfort,
		policy: row.policy,
		heuristic: row.heuristic,
		contactOpeningMs: row.contactOpeningMs,
		contactClosingMs: row.contactClosingMs,
		configuredAt: milliseconds(row.configuredAt),
		releaseRequestedAt: milliseconds(row.releaseRequestedAt),
	};
}

interface SelectionInput extends ThermostatComfortFence {
	readonly kind: 'selection';
	readonly id: string;
	readonly preset: ThermostatPreset | null;
	readonly clearUserOff: boolean;
}
type Definition = Pick<ThermostatComfortConfiguration, 'heating_range' | 'cooling_range' | 'presets'> & {
	automation_enabled?: boolean | null;
};
interface DefinitionInput extends ThermostatComfortFence {
	readonly kind: 'definition';
	readonly id: string;
	readonly definition: Pick<Definition, 'heating_range' | 'cooling_range' | 'presets'> & {
		readonly automation: 'preserve' | 'enable' | 'disable';
	};
}
type Override = { preset: ThermostatPreset | null; setpoints: ThermostatSetpoints | null; expires_at: string };
interface OverrideInput extends ThermostatComfortFence {
	readonly kind: 'override';
	readonly id: string;
	readonly override: Override;
	readonly actorId: string;
	readonly source: 'user' | 'panel';
}
interface CancelInput extends ThermostatComfortFence {
	readonly kind: 'cancel';
	readonly id: string;
	readonly overrideId: string;
}
type ComfortInput = SelectionInput | DefinitionInput | OverrideInput | CancelInput;
interface Lease {
	id: string;
	revision: number;
	deadline: number;
	watermark: number;
	status: 'expired' | 'clock_uncertain' | null;
}

interface SelectionResult {
	controller: string;
	revision: number;
	graph_revision: number;
	configuration: ThermostatComfortConfiguration;
	effective: ThermostatEffectiveComfort;
	clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit';
}
interface PhysicalDriver {
	connection: DataSource;
	databaseConnection: { all: (...args: unknown[]) => unknown };
	createQueryRunner: () => QueryRunner;
}

function refuse(message = 'Original thermostat selection admission expired'): never {
	throw new DevicesValidationException(message);
}
function revision(value: number, minimum: number, capacity = false): boolean {
	return Number.isSafeInteger(value) && value >= minimum && (!capacity || value < Number.MAX_SAFE_INTEGER);
}

/** Closed comfort intents only. Receipt/result presence survives transaction, release and final-read errors. */
export class ThermostatSelectionSettlement {
	receipt?: SqliteCommitGuardReceipt;
	result?: Readonly<{ value: SelectionResult }>;
	manualResult?: Readonly<{ value: ManualResult }>;
	releaseResult?: Readonly<{ value: ReleaseResult }>;
	maintenanceFailure?: Readonly<{ stage: string; index?: number; cause: unknown }>;
	structuralFailure?: Readonly<{ cause: unknown }>;
	preSettleFailure?: Readonly<{ cause: unknown }>;
	transactionFailure?: Readonly<{ cause: unknown }>;
	finalGetFailure?: Readonly<{ cause: unknown }>;
	localAction?: Readonly<{
		stage: 'checking' | 'installing' | 'deleting' | 'installed' | 'deleted' | 'superseded' | 'no-target';
	}>;
	localFailure?: Readonly<{ cause: unknown }>;
	get outcome() {
		return this.receipt?.outcome ?? 'not_started';
	}
}

/** Capture before service fence getters. No caller supplies a manager, change callback or result. */
function pin(
	database: DataSource,
	kind: ComfortInput['kind'] | RegisteredInput['kind'] | ReleaseInput['kind'] = 'selection',
	leases?: Map<string, Lease>,
) {
	const serialize = canonical;
	const detach = ownedJson;
	const validate = validateThermostatComfort;
	const validateSetpoints = validateThermostatSetpoints;
	const effective = effectiveThermostatComfort;
	const contract = thermostatPropertyContract;
	const validatePolicy = validateVirtualThermostatPolicy;
	const observe = observeSqliteOuterOutcome;
	const guard = registerSqliteCommitGuard;
	const manual = kind === 'registered-settings';
	if (!manual && (!(database instanceof SqliteDataSource) || !database.isInitialized)) refuse();
	const source = captureCreation(database, ['manager', 'driver', 'transaction', 'isInitialized', 'createQueryRunner']);
	const root = captureCreation(source.values.manager, ['connection', 'queryRunner', 'query', 'createQueryBuilder']);
	const driver = captureCreation(source.values.driver as unknown as PhysicalDriver, [
		'connection',
		'databaseConnection',
		'createQueryRunner',
	]);
	const physical = driver.values.databaseConnection;
	if (
		!manual &&
		(!physical ||
			typeof physical !== 'object' ||
			root.values.connection !== database ||
			root.values.queryRunner !== undefined ||
			driver.values.connection !== database)
	)
		refuse();
	const native = physical ? captureCreation(physical, ['all']) : undefined;
	// Only the two lifetime operations admit these dispatches. No clock values are sampled here.
	const releaseDateGlobal = kind === 'release-request' ? captureCreation(globalThis, ['Date']) : undefined;
	const releaseDate = releaseDateGlobal
		? captureCreation(releaseDateGlobal.values.Date as unknown as DateConstructor, ['prototype'])
		: undefined;
	const releaseScalar = releaseDate ? captureCreation(releaseDate.values.prototype, ['getTime']) : undefined;
	if (
		releaseDateGlobal &&
		(typeof releaseDateGlobal.values.Date !== 'function' || typeof releaseScalar.values.getTime !== 'function')
	)
		refuse();
	const dated = kind === 'override' || kind === 'cancel';
	const dateGlobal = dated ? captureCreation(globalThis, ['Date']) : undefined;
	const date = dated
		? captureCreation(
				dateGlobal.values.Date as unknown as DateConstructor,
				kind === 'override' ? ['now', 'parse', 'prototype'] : ['prototype'],
			)
		: undefined;
	const iso = dated ? captureCreation(date.values.prototype, ['toISOString']) : undefined;
	const monotonic = kind === 'override' ? captureCreation(performance, ['now']) : undefined;
	const uuid = kind === 'override' ? captureCreation(crypto, ['randomUUID']) : undefined;
	const local =
		dated && leases instanceof Map
			? captureCreation(leases, kind === 'override' ? ['get', 'set'] : ['get', 'delete'])
			: undefined;
	if (
		dated &&
		(!local ||
			typeof local.values.get !== 'function' ||
			(kind === 'override' ? typeof local.values.set !== 'function' : typeof local.values.delete !== 'function') ||
			typeof dateGlobal.values.Date !== 'function' ||
			typeof iso.values.toISOString !== 'function' ||
			(kind === 'override' &&
				(typeof date.values.now !== 'function' ||
					typeof date.values.parse !== 'function' ||
					typeof monotonic.values.now !== 'function' ||
					typeof uuid.values.randomUUID !== 'function')))
	)
		refuse();
	const lifetimePins = [
		dateGlobal,
		date,
		iso,
		monotonic,
		uuid,
		local,
		releaseDateGlobal,
		releaseDate,
		releaseScalar,
	].filter((pin) => pin !== undefined);
	const current = () =>
		source.current() &&
		root.current() &&
		driver.current() &&
		native?.current() === true &&
		database instanceof SqliteDataSource &&
		root.values.connection === database &&
		root.values.queryRunner === undefined &&
		driver.values.connection === database &&
		database.isInitialized &&
		lifetimePins.every((pin) => pin.current());
	const check = () => {
		if (!current()) refuse();
	};
	// DTO prototypes and own undefined are ordinary inputs. Read only this finite schema,
	// caching by object AND field so aliases (including fence/definition aliases) read once.
	const reader = () => {
		const cache = new Map<object, Map<string, unknown>>();
		return (object: unknown, field: string): unknown => {
			if (!object || typeof object !== 'object') refuse('Invalid thermostat definition structure.');
			let fields = cache.get(object);
			if (!fields) cache.set(object, (fields = new Map<string, unknown>()));
			if (!fields.has(field)) fields.set(field, Reflect.get(object, field));
			return fields.get(field);
		};
	};
	const record = (value: unknown): object => {
		if (!value || typeof value !== 'object' || Array.isArray(value)) refuse('Invalid thermostat definition structure.');
		return value;
	};
	const fences = (id: string, fence: ThermostatComfortFence, read: ReturnType<typeof reader>) => {
		record(fence);
		const expected_revision = read(fence, 'expected_revision');
		const expected_graph_revision = read(fence, 'expected_graph_revision');
		if (
			typeof id !== 'string' ||
			!id ||
			typeof expected_revision !== 'number' ||
			!revision(expected_revision, 1) ||
			typeof expected_graph_revision !== 'number' ||
			!revision(expected_graph_revision, 0)
		)
			refuse('Invalid thermostat selection or revision fences.');
		return { expected_revision, expected_graph_revision };
	};
	return Object.freeze({
		current,
		releaseInput(id: string, expectedRevision: number): ReleaseInput {
			if (kind !== 'release-request' || typeof id !== 'string' || !id || !revision(expectedRevision, 1))
				refuse('Invalid thermostat release or revision fence.');
			check();
			return Object.freeze({ kind: 'release-request', id, expectedRevision });
		},
		registeredInput(updates: readonly IDevicePropertyData[]) {
			if (!manual) refuse('Invalid thermostat settings intent kind.');
			const read = reader();
			const array = (value: unknown): unknown[] => {
				if (!Array.isArray(value)) refuse('Invalid thermostat settings array.');
				return value;
			};
			const length = (value: unknown[]): number => {
				const size = read(value, 'length');
				if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0)
					refuse('Invalid thermostat settings array.');
				return size;
			};
			const scalar = (value: unknown): string | number | boolean | null | undefined => {
				if (
					value === null ||
					value === undefined ||
					typeof value === 'string' ||
					typeof value === 'boolean' ||
					(typeof value === 'number' && Number.isFinite(value))
				)
					return value as string | number | boolean | null | undefined;
				refuse('Invalid thermostat settings metadata.');
			};
			const primitives = (value: unknown) => {
				const input = array(value),
					size = length(input),
					output: (string | number | boolean | null | undefined)[] = [];
				for (let index = 0; index < size; index++) {
					if (!Object.hasOwn(input, index)) refuse('Invalid thermostat settings metadata entry.');
					output.push(scalar(read(input, String(index))));
				}
				return output;
			};
			const id = (value: unknown): string => {
				if (typeof value !== 'string' || !value) refuse('Invalid thermostat setting identity.');
				return value;
			};
			const entries = array(updates),
				size = length(entries);
			// The one cached length is also empty detection. Empty requires no initialized database.
			if (size === 0) return { input: null, destinations: [] };
			check();
			const commands: RegisteredInput['commands'][number][] = [];
			const destinations: ChannelPropertyEntity[] = [];
			for (let index = 0; index < size; index++) {
				if (!Object.hasOwn(entries, index)) refuse('Invalid thermostat settings entry.');
				const entry = record(read(entries, String(index)));
				const property = record(read(entry, 'property'));
				const channel = record(read(entry, 'channel')),
					device = record(read(entry, 'device'));
				const propertyChannel = read(property, 'channel');
				const unitChannel =
					propertyChannel === null || propertyChannel === undefined || typeof propertyChannel === 'string'
						? propertyChannel
						: {
								category: scalar(read(record(propertyChannel), 'category')),
								identifier: scalar(read(propertyChannel, 'identifier')),
							};
				const permissions = read(property, 'permissions'),
					format = read(property, 'format');
				const ownedProperty = {
					id: id(read(property, 'id')),
					identifier: scalar(read(property, 'identifier')),
					category: scalar(read(property, 'category')),
					dataType: scalar(read(property, 'dataType')),
					permissions: permissions == null ? [] : primitives(permissions),
					format: format == null ? null : Array.isArray(format) ? primitives(format) : scalar(format),
					channel: unitChannel,
				} as ChannelPropertyEntity;
				const ownedChannel = {
					id: id(read(channel, 'id')),
					identifier: scalar(read(channel, 'identifier')),
					category: scalar(read(channel, 'category')),
				} as ChannelEntity;
				const ownedDevice = { id: id(read(device, 'id')), type: scalar(read(device, 'type')) } as DeviceEntity;
				const value = read(entry, 'value');
				if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
					refuse('Invalid thermostat setting scalar.');
				commands.push(
					Object.freeze({
						propertyId: ownedProperty.id,
						channelId: ownedChannel.id,
						deviceId: ownedDevice.id,
						contract: contract(ownedProperty, ownedChannel, ownedDevice),
						value,
					}),
				);
				destinations.push(property as ChannelPropertyEntity);
			}
			check();
			const input: RegisteredInput = Object.freeze({
				kind: 'registered-settings',
				id: commands[0].deviceId,
				commands: Object.freeze(commands),
			});
			return { input, destinations };
		},
		input(id: string, fence: ThermostatComfortFence, preset: ThermostatPreset | null, clearUserOff: boolean) {
			const input: SelectionInput = Object.freeze({
				kind: 'selection',
				id,
				...fences(id, fence, reader()),
				preset,
				clearUserOff,
			});
			check();
			if ((preset !== null && !['comfort', 'eco', 'away'].includes(preset)) || typeof clearUserOff !== 'boolean')
				refuse('Invalid thermostat selection or revision fences.');
			return input;
		},
		definitionInput(id: string, fence: ThermostatComfortFence, definition: Definition): DefinitionInput {
			record(definition);
			const read = reader();
			const capturedFence = fences(id, fence, read);
			const number = (value: unknown): number => {
				if (typeof value !== 'number' || !Number.isFinite(value)) refuse('Invalid thermostat definition number.');
				return value;
			};
			const range = (value: unknown) =>
				value === null
					? null
					: {
							minimum: number(read(record(value), 'minimum')),
							maximum: number(read(value, 'maximum')),
						};
			const heating_range = range(read(definition, 'heating_range'));
			const cooling_range = range(read(definition, 'cooling_range'));
			const entries = read(definition, 'presets');
			if (!Array.isArray(entries)) refuse('Invalid thermostat definition presets.');
			const length = read(entries, 'length');
			if (typeof length !== 'number' || !Number.isInteger(length) || length < 0 || length > 3)
				refuse('Invalid thermostat definition presets.');
			const presets: ThermostatComfortConfiguration['presets'] = [];
			for (let index = 0; index < length; index++) {
				if (!Object.hasOwn(entries, index)) refuse('Invalid thermostat definition preset entry.');
				const entry = record(read(entries, String(index)));
				const preset = read(entry, 'preset');
				if (preset !== 'comfort' && preset !== 'eco' && preset !== 'away')
					refuse('Invalid thermostat definition preset.');
				const setpoints = record(read(entry, 'setpoints'));
				const heating = read(setpoints, 'heating_setpoint');
				const cooling = read(setpoints, 'cooling_setpoint');
				presets.push({
					preset,
					setpoints: {
						heating_setpoint: heating === null ? null : number(heating),
						cooling_setpoint: cooling === null ? null : number(cooling),
					},
				});
			}
			const enabled = read(definition, 'automation_enabled');
			if (enabled !== undefined && enabled !== null && typeof enabled !== 'boolean')
				refuse('Invalid thermostat automation flag.');
			const automation = enabled === true ? 'enable' : enabled === false ? 'disable' : 'preserve';
			const payload = detach({
				heating_range,
				cooling_range,
				presets,
				automation,
			}) as unknown as DefinitionInput['definition'];
			check();
			return Object.freeze({ kind: 'definition', id, ...capturedFence, definition: payload });
		},
		overrideInput(
			id: string,
			fence: ThermostatComfortFence,
			input: Override,
			actorId: string,
			source: 'user' | 'panel',
		): OverrideInput {
			const read = reader();
			const capturedFence = fences(id, fence, read);
			record(input);
			const preset = read(input, 'preset');
			const supplied = read(input, 'setpoints');
			const expires_at = read(input, 'expires_at');
			if (
				(preset !== null && preset !== 'comfort' && preset !== 'eco' && preset !== 'away') ||
				typeof expires_at !== 'string' ||
				typeof actorId !== 'string' ||
				!actorId ||
				(source !== 'user' && source !== 'panel')
			)
				refuse('Override needs an identified actor and a future expiry within seven days.');
			let setpoints: ThermostatSetpoints | null = null;
			if (supplied !== null) {
				record(supplied);
				const heating = read(supplied, 'heating_setpoint'),
					cooling = read(supplied, 'cooling_setpoint');
				if (
					(heating !== null && (typeof heating !== 'number' || !Number.isFinite(heating))) ||
					(cooling !== null && (typeof cooling !== 'number' || !Number.isFinite(cooling)))
				)
					refuse('unsupported_branch_or_setpoint_range');
				setpoints = { heating_setpoint: heating as number | null, cooling_setpoint: cooling as number | null };
			}
			const payload = detach({ preset, setpoints, expires_at }) as unknown as Override;
			check();
			return Object.freeze({ kind: 'override', id, ...capturedFence, override: payload, actorId, source });
		},
		cancelInput(id: string, fence: ThermostatComfortFence, overrideId: string): CancelInput {
			const capturedFence = fences(id, fence, reader());
			if (typeof overrideId !== 'string' || !overrideId)
				refuse('Override identity/state changed; reload before cancelling.');
			check();
			return Object.freeze({ kind: 'cancel', id, ...capturedFence, overrideId });
		},
		operation(
			input: ComfortInput | RegisteredInput | ReleaseInput,
			ownerCurrent: () => boolean,
			dispatchCurrent: () => boolean,
			deferReady = false,
		) {
			if (
				!['selection', 'definition', 'override', 'cancel', 'registered-settings', 'release-request'].includes(
					input.kind,
				) ||
				(input.kind === 'registered-settings' && !manual) ||
				(input.kind === 'release-request' && kind !== 'release-request') ||
				((input.kind === 'override' || input.kind === 'cancel') && (input.kind !== kind || !local))
			)
				refuse('Invalid thermostat comfort intent kind.');
			const settlement = new ThermostatSelectionSettlement();
			let ready = false;
			let imageComplete = false;
			let manualTakeover: boolean | undefined;
			let changed = true;
			let resultPolicy: Parameters<typeof effectiveThermostatComfort>[0] | undefined;
			const completeImage = () => {
				imageComplete = true;
				if (!deferReady) ready = true;
			};
			let slot:
				| Readonly<{ reference: Lease | undefined; id: string | undefined; revision: number | undefined }>
				| undefined;
			let plan:
				| Readonly<{ controller: string; id: string; revision: number; deadline: number; watermark: number }>
				| undefined;
			let original: EntityManager | undefined;
			let scopedCurrent: (() => boolean) | undefined;
			const valid = () => current() && dispatchCurrent() && scopedCurrent?.() === true && ownerCurrent();
			const assert = () => {
				if (!valid()) refuse();
			};
			const validateOwned = (
				row: VirtualThermostatConfigEntity,
				id: string,
				owned?: ClimateAutomationSlotSnapshot,
				graphDelta = 1,
			) => {
				if (!owned) return;
				const slot = owned.facts;
				const controller = owned.controller;
				if (
					!slot ||
					!controller ||
					slot.state !== 'LIVE' ||
					slot.manualHold ||
					slot.controllerId !== id ||
					!slot.installEvidence
				)
					refuse('Missing original installed thermostat selection.');
				const installed = JSON.parse(slot.installEvidence) as typeof controller;
				if (
					controller.controllerRevision !== row.revision ||
					controller.graphRevision !== installed.graphRevision + graphDelta ||
					serialize({ ...controller, graphRevision: installed.graphRevision }) !== slot.installEvidence ||
					serialize(controller.legacyBaseline) !== serialize(row.comfort?.automation_baseline ?? null)
				)
					refuse('Installed thermostat mirror no longer matches its native controller.');
			};
			const writeRelease = async (
				manager: EntityManager,
				input: ReleaseInput,
				owned?: ClimateAutomationSlotSnapshot,
			): Promise<ReleaseResult> => {
				const readConfig = () =>
					manager
						.createQueryBuilder(VirtualThermostatConfigEntity, 'config')
						.where('config.controllerId = :id', { id: input.id })
						.callListeners(false)
						.getOneOrFail();
				const readClaims = () =>
					manager
						.createQueryBuilder(VirtualThermostatActuatorClaimEntity, 'claim')
						.where('claim.controllerId = :id AND claim.state != :released', { id: input.id, released: 'released' })
						.orderBy('claim.id', 'ASC')
						.callListeners(false)
						.getMany();
				const readGraph = () =>
					manager
						.createQueryBuilder(VirtualGraphRevisionEntity, 'graph')
						.where('graph.id = 1')
						.callListeners(false)
						.getOneOrFail();
				const milliseconds = (date: Date | null): number | null =>
					date === null ? null : releaseScalar.values.getTime.call(date);
				// Only JSON columns use JSON ownership. Unchanged fixed scalars gain no validation policy.
				const configuration = (row: VirtualThermostatConfigEntity) =>
					Object.freeze({
						...configImage(row, milliseconds),
						comfort: detach(row.comfort) as unknown as typeof row.comfort,
						policy: detach(row.policy) as unknown as typeof row.policy,
						heuristic: detach(row.heuristic) as unknown as typeof row.heuristic,
					});
				const image = (row: VirtualThermostatActuatorClaimEntity) =>
					Object.freeze({
						...claimImage(row, milliseconds),
						releaseEvidence: detach(row.releaseEvidence) as unknown as typeof row.releaseEvidence,
					});
				const sameConfig = (actual: ReturnType<typeof configuration>, intended: ReturnType<typeof configuration>) =>
					(Object.keys(intended) as (keyof typeof intended)[]).every((key) =>
						key === 'comfort' || key === 'policy' || key === 'heuristic'
							? serialize(actual[key]) === serialize(intended[key])
							: Object.is(actual[key], intended[key]),
					);
				const sameClaim = (actual: ReturnType<typeof image>, intended: ReturnType<typeof image>) =>
					(Object.keys(intended) as (keyof typeof intended)[]).every((key) =>
						key === 'releaseEvidence'
							? serialize(actual[key]) === serialize(intended[key])
							: Object.is(actual[key], intended[key]),
					);
				const row = await readConfig();
				assert();
				if (row.revision !== input.expectedRevision || !revision(row.revision, 1, true))
					refuse('Thermostat revision changed or overflowed.');
				validateOwned(row, input.id, owned);
				// One original system-Date observation at the old reserved phase, never at ACK.
				const DateConstructor = releaseDateGlobal.values.Date as unknown as DateConstructor;
				const instant = new DateConstructor();
				const timestamp = releaseScalar.values.getTime.call(instant);
				const intended = Object.freeze({
					...configuration(row),
					...(owned && row.comfort ? { comfort: { ...configuration(row).comfort, automation_baseline: null } } : {}),
					requestedMode: 'off' as const,
					revision: row.revision + 1,
					releaseRequestedAt: timestamp,
				});
				const graph = await readGraph(),
					selected = await readClaims();
				assert();
				if (!revision(graph.revision, 1)) refuse('Invalid virtual dependency graph revision.');
				const graphRevision = graph.revision;
				const starting = selected.map(image);
				const claims = Object.freeze(
					starting.map((claim) => {
						if (!revision(claim.revision, 1, true)) refuse('Thermostat claim revision overflow.');
						return Object.freeze({
							...claim,
							state: claim.sourcePropertyId ? ('releasing' as const) : ('missing' as const),
							revision: claim.revision + 1,
							releaseRequestedAt: timestamp,
							reason: 'explicit_release_requested',
						});
					}),
				);
				const updated = await manager
					.createQueryBuilder()
					.update(VirtualThermostatConfigEntity)
					.set({
						requestedMode: 'off',
						releaseRequestedAt: instant,
						revision: intended.revision,
						...(owned ? { comfort: intended.comfort } : {}),
					})
					.where({
						controllerId: input.id,
						revision: row.revision,
						ownerDeviceId: row.ownerDeviceId === null ? IsNull() : row.ownerDeviceId,
					})
					.execute();
				assert();
				if (updated.affected !== 1) refuse('Thermostat release lost its conditional configuration update.');
				for (const [index, claim] of starting.entries()) {
					const changed = await manager
						.createQueryBuilder()
						.update(VirtualThermostatActuatorClaimEntity)
						.set({
							state: claims[index].state,
							revision: claims[index].revision,
							releaseRequestedAt: instant,
							reason: 'explicit_release_requested',
						})
						.where({
							id: claim.id,
							controllerId: input.id,
							revision: claim.revision,
							state: claim.state,
							role: claim.role,
							physicalIdentity: claim.physicalIdentity,
							providerProfile: claim.providerProfile,
							providerProfileVersion: claim.providerProfileVersion,
							sourcePropertyId: claim.sourcePropertyId === null ? IsNull() : claim.sourcePropertyId,
							sourcePropertyIdentity: claim.sourcePropertyIdentity,
							sourceDeviceId: claim.sourceDeviceId === null ? IsNull() : claim.sourceDeviceId,
							sourceDeviceIdentity: claim.sourceDeviceIdentity,
							contractFingerprint: claim.contractFingerprint,
							qualificationGeneration:
								claim.qualificationGeneration === null ? IsNull() : claim.qualificationGeneration,
						})
						.execute();
					assert();
					if (changed.affected !== 1) refuse('Thermostat release lost a conditional claim update.');
				}
				const postimage = await readConfig(),
					members = await readClaims(),
					postGraph = await readGraph();
				assert();
				if (
					!sameConfig(configuration(postimage), intended) ||
					members.length !== claims.length ||
					members.some((member, index) => !sameClaim(image(member), claims[index])) ||
					postGraph.revision !== graphRevision
				)
					refuse('Thermostat release persisted an unexpected complete postimage.');
				const value: ReleaseResult = Object.freeze({
					input,
					configuration: intended,
					claims,
					claimIds: Object.freeze(claims.map((claim) => claim.id)),
					graph_revision: graphRevision,
					timestamp,
				});
				settlement.releaseResult = Object.freeze({ value });
				completeImage();
				return value;
			};
			const writeRegistered = async (
				manager: EntityManager,
				input: RegisteredInput,
				owned?: ClimateAutomationSlotSnapshot,
				semantic?: {
					advanceGraph: () => Promise<number>;
					canRemainUnchanged: (takeover: boolean) => boolean;
					verifyUnchanged: () => Promise<void>;
				},
			): Promise<ManualResult> => {
				const readGraph = () =>
					manager
						.createQueryBuilder(VirtualGraphRevisionEntity, 'graph')
						.where('graph.id = 1')
						.callListeners(false)
						.getOneOrFail();
				const readConfig = () =>
					manager
						.createQueryBuilder(VirtualThermostatConfigEntity, 'config')
						.where('config.controllerId = :id', { id: input.id })
						.callListeners(false)
						.getOneOrFail();
				const readOwner = () =>
					manager
						.createQueryBuilder(VirtualDeviceEntity, 'owner')
						.select(['owner.id', 'owner.enabled', 'owner.type'])
						.where('owner.id = :id', { id: input.id })
						.callListeners(false)
						.getOne();
				const graph = await readGraph();
				assert();
				if (!revision(graph.revision, semantic ? 0 : 1)) refuse('Invalid virtual dependency graph revision.');
				let graphRevision = graph.revision;
				const rows: ThermostatSetting[] = [];
				for (const command of input.commands) {
					const setting = await manager
						.createQueryBuilder(VirtualThermostatSettingEntity, 'setting')
						.where('setting.propertyId = :id', { id: command.propertyId })
						.callListeners(false)
						.getOne();
					const property = await manager
						.createQueryBuilder(ChannelPropertyEntity, 'property')
						.leftJoinAndSelect('property.channel', 'channel')
						.leftJoinAndSelect('channel.device', 'device')
						.where('property.id = :id', { id: command.propertyId })
						.callListeners(false)
						.getOne();
					assert();
					const channel = property?.channel as ChannelEntity | undefined;
					const device = channel?.device as DeviceEntity | undefined;
					if (
						!setting ||
						!property ||
						!channel ||
						!device ||
						setting.controllerId !== input.id ||
						!['heating_setpoint', 'cooling_setpoint', 'heating_enabled', 'cooling_enabled', 'locked'].includes(
							setting.setting,
						) ||
						!(property instanceof VirtualChannelPropertyEntity) ||
						property.valueOrigin !== VirtualValueOrigin.LOCAL ||
						property.sourcePropertyId ||
						property.id !== command.propertyId ||
						channel.id !== command.channelId ||
						device.id !== command.deviceId ||
						device.id !== input.id ||
						setting.contractFingerprint !== command.contract ||
						setting.contractFingerprint !== contract(property, channel, device)
					)
						refuse('Only registered unchanged local thermostat settings accept commands.');
					rows.push(setting.setting);
				}
				const row = await readConfig(),
					owner = await readOwner();
				assert();
				if (
					!owner?.enabled ||
					owner.id !== input.id ||
					row.ownerDeviceId !== owner.id ||
					(row.locked && rows.some((role) => role !== 'locked'))
				)
					refuse('Thermostat is disabled or locked.');
				if (!revision(row.revision, 1)) refuse('Invalid thermostat revision.');
				validateOwned(row, input.id, owned, semantic ? 0 : 1);
				const starting = detach(configImage(row)) as unknown as ReturnType<typeof configImage>;
				const intended = JSON.parse(serialize(starting)) as typeof starting;
				let heat = ['heat', 'auto'].includes(starting.requestedMode),
					cool = ['cool', 'auto'].includes(starting.requestedMode);
				for (const [index, role] of rows.entries()) {
					const value = input.commands[index].value;
					if (role === 'heating_setpoint' || role === 'cooling_setpoint') {
						if (typeof value !== 'number' || !Number.isFinite(value)) refuse('Setpoint must be finite.');
						if (role === 'heating_setpoint') intended.policy.heatingSetpoint = value;
						else intended.policy.coolingSetpoint = value;
					} else {
						if (typeof value !== 'boolean') refuse('Thermostat enable and lock settings must be boolean.');
						if (role === 'heating_enabled') heat = value;
						else if (role === 'cooling_enabled') cool = value;
						else intended.locked = value;
					}
				}
				if (intended.comfort) {
					if (owned) intended.comfort.automation_baseline = null;
					if (rows.some((role) => role.endsWith('setpoint'))) intended.comfort.selected_preset = null;
					if (rows.some((role) => role.endsWith('enabled'))) intended.comfort.user_off = !heat && !cool;
					const errors = validate(intended.comfort, intended.policy);
					if (errors.length) refuse(errors.join(', '));
				}
				intended.requestedMode = heat ? (cool ? 'auto' : 'heat') : cool ? 'cool' : 'off';
				const errors = validatePolicy(intended.policy),
					mode = intended.requestedMode;
				if (
					errors.length ||
					!['off', 'heat', 'cool', 'auto'].includes(mode) ||
					((mode === 'heat' || mode === 'auto') && intended.policy.heatingSetpoint === null) ||
					((mode === 'cool' || mode === 'auto') && intended.policy.coolingSetpoint === null)
				)
					refuse(`Invalid thermostat mode/policy: ${errors.join(', ')}.`);
				manualTakeover = rows.some((role) => role !== 'locked');
				changed = !(
					semantic &&
					serialize(intended) === serialize(starting) &&
					semantic.canRemainUnchanged(manualTakeover)
				);
				if (changed) {
					if (!revision(row.revision, 1, true))
						refuse('Thermostat is missing, detached, locked or its revision changed/overflowed.');
					if (semantic) graphRevision = await semantic.advanceGraph();
					intended.revision = starting.revision + 1;
				}
				const intendedJson = serialize(intended);
				if (changed) {
					const updated = await manager
						.createQueryBuilder()
						.update(VirtualThermostatConfigEntity)
						.set({
							policy: intended.policy,
							comfort: intended.comfort,
							requestedMode: intended.requestedMode,
							locked: intended.locked,
							revision: intended.revision,
						})
						.where({
							controllerId: input.id,
							ownerDeviceId: owner.id,
							revision: starting.revision,
							locked: starting.locked,
						})
						.execute();
					assert();
					if (updated.affected !== 1) refuse('Thermostat settings lost their conditional update.');
				} else await semantic.verifyUnchanged();
				const postimage = await readConfig(),
					postOwner = await readOwner(),
					postGraph = await readGraph();
				assert();
				if (
					serialize(configImage(postimage)) !== intendedJson ||
					!postOwner?.enabled ||
					postOwner.id !== owner.id ||
					postOwner.type !== owner.type ||
					postimage.ownerDeviceId !== postOwner.id ||
					postGraph.revision !== graphRevision
				)
					refuse('Thermostat settings persisted an unexpected postimage.');
				manualTakeover = rows.some((role) => role !== 'locked');
				const value = detach({
					configuration: intended,
					owner: { id: owner.id, enabled: owner.enabled, type: owner.type },
					graph_revision: graphRevision,
					commands: input.commands,
				}) as unknown as ManualResult;
				settlement.manualResult = Object.freeze({ value });
				completeImage();
				return value;
			};
			return Object.freeze({
				settlement,
				changed(): boolean {
					if (!imageComplete) refuse();
					return changed;
				},
				takesManualHold(): boolean {
					assert();
					if (input.kind !== 'registered-settings' || !imageComplete || manualTakeover === undefined) refuse();
					return manualTakeover;
				},
				qualifyAutomation(intent: Parameters<typeof effectiveThermostatComfort>[2]): void {
					assert();
					if (
						!deferReady ||
						ready ||
						!imageComplete ||
						!resultPolicy ||
						!settlement.result ||
						settlement.receipt?.outcome !== 'pending' ||
						!intent?.isCurrent()
					)
						refuse();
					const value = settlement.result.value;
					settlement.result = Object.freeze({
						value: detach({
							...value,
							effective: effective(resultPolicy, value.configuration, intent),
						}) as unknown as SelectionResult,
					});
				},
				markReady(): void {
					assert();
					if (!deferReady || !imageComplete || settlement.receipt?.outcome !== 'pending') refuse();
					ready = true;
				},
				captureSlot(): void {
					if (input.kind !== 'override' && input.kind !== 'cancel') return;
					const reference = local.values.get.call(local.receiver, input.id);
					slot = Object.freeze({ reference, id: reference?.id, revision: reference?.revision });
				},
				localAction(): void {
					if (input.kind !== 'override' && input.kind !== 'cancel') return;
					// No post-ACK admission gate. A superseded destination skips only this initial action.
					try {
						settlement.localAction = Object.freeze({ stage: 'checking' });
						if (!slot || settlement.outcome !== 'committed' || !settlement.result) refuse();
						const current = local.values.get.call(local.receiver, input.id);
						if (current !== slot.reference || current?.id !== slot.id || current?.revision !== slot.revision) {
							settlement.localAction = Object.freeze({ stage: 'superseded' });
						} else if (input.kind === 'override') {
							if (!plan) refuse();
							settlement.localAction = Object.freeze({ stage: 'installing' });
							// The immutable private plan is not the mutable lease used by isCurrent/settle.
							local.values.set.call(local.receiver, plan.controller, {
								id: plan.id,
								revision: plan.revision,
								deadline: plan.deadline,
								watermark: plan.watermark,
								status: null,
							});
							settlement.localAction = Object.freeze({ stage: 'installed' });
						} else if (current && slot.id === input.overrideId) {
							settlement.localAction = Object.freeze({ stage: 'deleting' });
							local.values.delete.call(local.receiver, input.id);
							settlement.localAction = Object.freeze({ stage: 'deleted' });
						} else settlement.localAction = Object.freeze({ stage: 'no-target' });
					} catch (cause: unknown) {
						// Dispatch may have partially acted; retain phase/cause, never compensate or replay.
						settlement.localFailure = Object.freeze({ cause });
						throw cause;
					}
				},
				admit(manager: EntityManager): void {
					// FIRST: a foreign manager or nested savepoint cannot create an outer success receipt.
					const receipt = observe(manager);
					if (original) refuse();
					settlement.receipt = receipt;
					original = manager;
					const selected = captureCreation(manager, ['connection', 'queryRunner', 'createQueryBuilder', 'query']);
					const runner = manager.queryRunner;
					if (!runner) refuse();
					const runnerPin = captureCreation(runner as QueryRunner & { driver: PhysicalDriver }, [
						'manager',
						'connection',
						'driver',
						'query',
						'connect',
						'commitTransaction',
						'release',
					]);
					scopedCurrent = () =>
						selected.current() &&
						runnerPin.current() &&
						selected.values.connection === database &&
						selected.values.queryRunner === runner &&
						runnerPin.values.driver === driver.receiver &&
						runner.manager === manager &&
						runner.connection === database &&
						runner.isTransactionActive &&
						Reflect.get(runner, 'transactionDepth') === 1 &&
						driver.receiver.databaseConnection === physical;
					// Pure, synchronous, original-owner check. P01 drains its own admitted children.
					guard(
						manager,
						() =>
							ready &&
							(input.kind === 'registered-settings'
								? !!settlement.manualResult
								: input.kind === 'release-request'
									? !!settlement.releaseResult
									: !!settlement.result && (input.kind !== 'override' || !!plan)) &&
							valid(),
					);
					assert();
				},
				async write(
					manager: EntityManager,
					owned?: ClimateAutomationSlotSnapshot,
					semantic?: {
						advanceGraph: () => Promise<number>;
						canRemainUnchanged: (takeover: boolean) => boolean;
						verifyUnchanged: () => Promise<void>;
						writeAppliedConfiguration?: (
							row: VirtualThermostatConfigEntity,
							comfort: ThermostatComfortConfiguration,
						) => Promise<void>;
					},
				): Promise<SelectionResult | ManualResult | ReleaseResult> {
					assert();
					if (manager !== original) refuse();
					if (input.kind === 'registered-settings') return writeRegistered(manager, input, owned, semantic);
					if (input.kind === 'release-request') return writeRelease(manager, input, owned);
					const row = await manager
						.createQueryBuilder(VirtualThermostatConfigEntity, 'config')
						.where('config.controllerId = :id', { id: input.id })
						.callListeners(false)
						.getOne();
					assert();
					if (!row) throw new NotFoundException('Thermostat configuration does not exist.');
					const owner = await manager
						.createQueryBuilder(VirtualDeviceEntity, 'owner')
						.select(['owner.id'])
						.where('owner.id = :id', { id: input.id })
						.callListeners(false)
						.getOne();
					assert();
					if (
						!owner ||
						owner.id !== input.id ||
						row.ownerDeviceId !== owner.id ||
						row.locked ||
						row.revision !== input.expected_revision ||
						!revision(row.revision, 1, !semantic)
					)
						refuse('Thermostat is missing, detached, locked or its revision changed/overflowed.');
					validateOwned(row, input.id, owned, semantic ? 0 : 1);
					let intended: ThermostatComfortConfiguration;
					let birth:
						| Readonly<{ controller: string; id: string; revision: number; deadline: number; watermark: number }>
						| undefined;
					if (input.kind === 'selection') {
						if (!row.comfort) refuse('Configure explicit comfort ranges and presets first.');
						intended = JSON.parse(serialize(row.comfort)) as ThermostatComfortConfiguration;
						intended.selected_preset = input.preset;
						if (owned) intended.automation_baseline = null;
						if (input.clearUserOff) intended.user_off = false;
					} else if (input.kind === 'definition') {
						const definition = input.definition;
						const old = row.comfort;
						// Exact configure merge, before reserved-policy validation. No new arbitration authority.
						intended = {
							heating_range: definition.heating_range,
							cooling_range: definition.cooling_range,
							presets: definition.presets,
							selected_preset: old?.selected_preset ?? null,
							user_off: old?.user_off ?? row.requestedMode === 'off',
							automation_enabled:
								definition.automation === 'preserve'
									? (old?.automation_enabled ?? false)
									: definition.automation === 'enable',
							automation_baseline: definition.automation === 'disable' ? null : (old?.automation_baseline ?? null),
							temporary_override: old?.temporary_override ?? null,
						};
						if (owned && intended.automation_baseline) {
							const baseline = intended.automation_baseline;
							const target = baseline.preset
								? intended.presets.find((entry) => entry.preset === baseline.preset)?.setpoints
								: baseline.setpoints;
							if (!target || validateSetpoints(target, intended, row.policy).length)
								intended.automation_baseline = null;
						}
					} else {
						if (!row.comfort)
							refuse(
								input.kind === 'override'
									? 'Configure explicit comfort ranges and presets first.'
									: 'Override identity/state changed; reload before cancelling.',
							);
						intended = JSON.parse(serialize(row.comfort)) as ThermostatComfortConfiguration;
						const DateConstructor = dateGlobal.values.Date as DateConstructor;
						const utc = (value: Date) => iso.values.toISOString.call(value);
						if (input.kind === 'override') {
							const now = date.values.now.call(date.receiver);
							const duration = date.values.parse.call(date.receiver, input.override.expires_at) - now;
							if (
								!/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(input.override.expires_at) ||
								!Number.isFinite(duration) ||
								duration <= 0 ||
								duration > 7 * 86400000
							)
								refuse('Override needs an identified actor and a future expiry within seven days.');
							const resolved = input.override.preset
								? intended.presets.find((entry) => entry.preset === input.override.preset)?.setpoints
								: input.override.setpoints;
							if (!resolved) refuse('Override preset or setpoints are missing.');
							const identity = uuid.values.randomUUID.call(uuid.receiver);
							const initial = monotonic.values.now.call(monotonic.receiver);
							const deadline = initial + duration;
							// Deliberate birth-fault refusal. Later finite samples cannot repair this budget.
							if (!Number.isFinite(initial) || !Number.isFinite(deadline))
								refuse('Override initial clock is not finite.');
							birth = Object.freeze({
								controller: input.id,
								id: identity,
								revision: row.revision + 1,
								deadline,
								watermark: now,
							});
							intended.temporary_override = {
								preset: input.override.preset,
								setpoints: input.override.setpoints,
								id: identity,
								source: input.source,
								actor_id: input.actorId,
								revision: row.revision + 1,
								original_duration_ms: duration,
								wall_watermark_ms: now,
								created_at: utc(new DateConstructor(now)),
								expires_at: utc(new DateConstructor(now + duration)),
								resolved_setpoints: { ...resolved },
								status: 'active',
								terminated_at: null,
							};
						} else {
							const override = intended.temporary_override;
							if (override?.id !== input.overrideId || !['active', 'clock_uncertain'].includes(override.status))
								refuse('Override identity/state changed; reload before cancelling.');
							override.status = 'cancelled';
							override.terminated_at = utc(new DateConstructor());
						}
					}
					const errors = validate(intended, row.policy);
					if (errors.length) refuse(errors.join(', '));
					const intendedJson = serialize(intended);
					changed = !(
						semantic &&
						(input.kind === 'selection' || input.kind === 'definition') &&
						serialize(row.comfort) === intendedJson &&
						semantic.canRemainUnchanged(true)
					);
					if (changed) {
						if (!revision(row.revision, 1, true))
							refuse('Thermostat is missing, detached, locked or its revision changed/overflowed.');
						if (semantic) await semantic.advanceGraph();
						if (semantic) {
							if (!semantic.writeAppliedConfiguration) refuse('Original complete comfort image writer required.');
							await semantic.writeAppliedConfiguration(row, intended);
							assert();
						} else {
							const updated = await manager
								.createQueryBuilder()
								.update(VirtualThermostatConfigEntity)
								.set({ comfort: intended, revision: row.revision + 1 })
								.where({ controllerId: input.id, ownerDeviceId: owner.id, revision: row.revision, locked: false })
								// Keep mutation listeners and actual ownership beforeQuery/outer hooks enabled.
								.execute();
							assert();
							if (updated.affected !== 1) refuse('Thermostat selection lost its conditional update.');
						}
					} else await semantic.verifyUnchanged();
					const postimage = await manager
						.createQueryBuilder(VirtualThermostatConfigEntity, 'config')
						.where('config.controllerId = :id', { id: input.id })
						.callListeners(false)
						.getOneOrFail();
					const graph = await manager
						.createQueryBuilder(VirtualGraphRevisionEntity, 'graph')
						.where('graph.id = 1')
						.callListeners(false)
						.getOneOrFail();
					assert();
					if (
						postimage.controllerId !== input.id ||
						postimage.ownerDeviceId !== owner.id ||
						postimage.revision !== row.revision + (changed ? 1 : 0) ||
						serialize(postimage.comfort) !== intendedJson ||
						!revision(graph.revision, changed ? 1 : 0) ||
						graph.revision !== input.expected_graph_revision + (changed ? 1 : 0)
					)
						refuse('Thermostat selection persisted an unexpected postimage.');
					resultPolicy = detach(postimage.policy) as unknown as typeof postimage.policy;
					const value = detach({
						controller: postimage.controllerId,
						revision: postimage.revision,
						graph_revision: graph.revision,
						configuration: postimage.comfort,
						effective: effective(postimage.policy, postimage.comfort),
						clock_policy: 'bounded_absolute_recovery_with_uncertainty_inhibit',
					}) as unknown as SelectionResult;
					// The provisional scalar plan is qualified only by the exact persisted postimage above.
					plan = birth;
					settlement.result = Object.freeze({ value });
					completeImage();
					return value;
				},
				accepted(): void {
					// A later read, even an identical postimage, cannot upgrade UNKNOWN to ACK.
					if (
						settlement.outcome !== 'committed' ||
						(input.kind === 'registered-settings'
							? !settlement.manualResult
							: input.kind === 'release-request'
								? !settlement.releaseResult
								: !settlement.result)
					)
						throw new Error('Missing original native thermostat selection ACK/result');
				},
				copy(): SelectionResult {
					if (settlement.outcome !== 'committed' || !settlement.result) refuse();
					// Fresh mutable input for the existing controller/class-transformer materializer.
					return JSON.parse(serialize(settlement.result.value)) as SelectionResult;
				},
			});
		},
	});
}

export const thermostatComfortSelection = Object.freeze({ pin });
