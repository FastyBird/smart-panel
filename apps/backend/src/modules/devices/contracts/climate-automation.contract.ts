import { createHash } from 'node:crypto';
import { EntityManager } from 'typeorm';

import type { DeviceCreationContext, DeviceCreationEnvironment } from '../services/device-creation-context';

const nativeFieldEvidence: Readonly<{ get: (receiver: object, key: PropertyKey) => unknown }> = Reflect;

/** PRIVATE core protocol. No HTTP/Swagger schema, runtime frame or physical authority. */
export type ClimateAutomationJson =
	| null
	| boolean
	| number
	| string
	| readonly ClimateAutomationJson[]
	| { readonly [key: string]: ClimateAutomationJson };

export function climateAutomationCanonical(value: unknown): string {
	if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) throw new Error('Non-finite private climate value');
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) return `[${value.map((item: unknown) => climateAutomationCanonical(item)).join(',')}]`;
	if (typeof value !== 'object') throw new Error('Invalid private climate JSON');
	return `{${Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${climateAutomationCanonical(nativeFieldEvidence.get(value, key))}`)
		.join(',')}}`;
}

/** Validate and copy private JSON; never retain mutable provider-owned evidence objects. */
export function climateAutomationJson(value: unknown): ClimateAutomationJson {
	if (value === null) return null;
	if (typeof value === 'boolean' || typeof value === 'string') return value;
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (Array.isArray(value)) return Object.freeze(value.map((item: unknown) => climateAutomationJson(item)));
	if (typeof value !== 'object' || value === null) throw new Error('Invalid private climate JSON');
	const result: Record<string, ClimateAutomationJson> = {};
	for (const key of Object.keys(value)) {
		const item: unknown = nativeFieldEvidence.get(value, key);
		Object.defineProperty(result, key, { value: climateAutomationJson(item), enumerable: true });
	}
	return Object.freeze(result);
}

export function climateAutomationDigest(value: ClimateAutomationJson): string {
	return createHash('sha256').update(climateAutomationCanonical(value)).digest('hex');
}

export type ClimateAutomationSourceState = 'PENDING' | 'FINALIZED_LIVE' | 'FINALIZED_INACTIVE' | 'REVOKED' | 'DELETED';
export type ClimateAutomationSlotState = 'EMPTY' | 'PROVISIONAL' | 'LIVE' | 'RETIRED' | 'LEGACY';

export interface ClimateAutomationSourceFacts {
	readonly generationId: string;
	readonly ownerId: string;
	readonly producerKey: string;
	readonly subjectId: string;
	readonly generationIndex: number;
	readonly revision: number;
	readonly isCurrent: boolean;
	readonly state: ClimateAutomationSourceState;
	readonly evidence: string;
	readonly evidenceDigest: string;
}

export interface ClimateAutomationSlotFacts {
	readonly controllerId: string;
	readonly providerKey: string;
	readonly controllerIncarnation: string;
	readonly slotRevision: number;
	readonly manualGeneration: string;
	readonly manualCounter: number;
	readonly manualHold: boolean;
	readonly state: ClimateAutomationSlotState;
	readonly ownerId: string | null;
	readonly baselineId: string | null;
	readonly generationId: string | null;
	readonly candidateId: string | null;
	readonly bundleId: string | null;
	readonly selection: string | null;
	readonly installEvidence: string | null;
	readonly legacyDigest: string | null;
}

/** Actual DB facts from the same reserved manager; no sample/session/availability claim. */
export interface ClimateAutomationControllerFacts {
	readonly controllerRevision: number;
	readonly graphRevision: number;
	readonly evidence: ClimateAutomationJson;
	readonly legacyBaseline: ClimateAutomationJson;
}

export interface ClimateAutomationProducer {
	readonly validateInManager: (
		manager: EntityManager,
		source: Readonly<ClimateAutomationSourceFacts>,
		purpose: 'prepare' | 'retire',
	) => Promise<ClimateAutomationJson | null>;
}

export interface ClimateAutomationProvider {
	readonly creationV1?: ClimateAutomationCreationCapability;
	readonly existingControllerV1?: ClimateAutomationExistingCapability;
	/** Optional dormant edit port; never inferred from ordinary validation/creation methods. */
	readonly participantV1?: ClimateAutomationParticipant;
	readonly readControllerInManager: (
		manager: EntityManager,
		controllerId: string,
	) => Promise<ClimateAutomationControllerFacts | null>;
	readonly validateSelectionInManager: (
		manager: EntityManager,
		controllerId: string,
		facts: ClimateAutomationControllerFacts,
		selection: ClimateAutomationJson,
	) => Promise<boolean>;
	/** Trusted creation ONLY; called after config AND retained-slot checks. No network or nested transaction. */
	readonly createControllerInManager: (
		manager: EntityManager,
		controllerId: string,
		configuration: ClimateAutomationJson,
	) => Promise<void>;
}

export interface ClimateAutomationOwnedRegistration {
	readonly dispose: () => void;
}
export interface ClimateAutomationCapturedRegistration<T> {
	readonly implementation: T;
	readonly isCurrent: () => boolean;
}

/** Empty serializable shells. Actual identity is verified against writer-owned WeakMaps. */
export interface ClimateAutomationScope {
	readonly toJSON: () => Readonly<Record<string, never>>;
}
export interface ClimateAutomationHandle {
	readonly toJSON: () => Readonly<Record<string, never>>;
}
export type ClimateAutomationSelection = ClimateAutomationHandle | readonly ClimateAutomationHandle[];
export type ClimateAutomationConflictReason = 'stale' | 'uninitialized' | 'unavailable' | 'invalid';
export type ClimateAutomationCommittedOutcome =
	| {
			readonly outcome: 'applied' | 'unchanged';
			readonly items: readonly { readonly outcome: 'applied' | 'unchanged' }[];
	  }
	| { readonly outcome: 'conflict'; readonly reason: ClimateAutomationConflictReason };
export type ClimateAutomationCommitOutcome = 'not_started' | 'rolled_back' | 'refused' | 'unknown' | 'committed';

export class ClimateAutomationWriteError extends Error {
	constructor(
		readonly commitOutcome: ClimateAutomationCommitOutcome,
		cause: unknown,
	) {
		super('Private climate ownership operation failed', { cause });
		this.name = 'ClimateAutomationWriteError';
	}
	toJSON(): { outcome: 'error'; commitOutcome: ClimateAutomationCommitOutcome } {
		return { outcome: 'error', commitOutcome: this.commitOutcome };
	}
}

/** Private owned full projection. A concrete provider must audit every persisted field before registration. */
export interface ClimateAutomationParticipantDocument {
	readonly controllerId: string;
	readonly documentVersion: 1;
	readonly configuration: ClimateAutomationJson;
	readonly comfort: ClimateAutomationJson;
	readonly structural: ClimateAutomationJson;
	readonly legacyBaseline: ClimateAutomationJson;
}
export interface ClimateAutomationParticipantImage extends ClimateAutomationParticipantDocument {
	readonly controllerRevision: number;
}
export type ClimateAutomationReplacementKind = 'replace-configuration:v1' | 'replace-comfort:v1';
export interface ClimateAutomationReplacement {
	readonly kind: ClimateAutomationReplacementKind;
	readonly providerKey: string;
	readonly controllerId: string;
	readonly expected: ClimateAutomationHandle;
	readonly desiredDocument: ClimateAutomationJson;
}
export type ClimateAutomationParticipantTurn = ClimateAutomationScope;
export type ClimateAutomationValidationTicket = ClimateAutomationScope;
export type ClimateAutomationAcknowledgedJob = ClimateAutomationScope;
export type ClimateAutomationParticipantPhase =
	| 'READ_BEFORE'
	| 'NORMALIZE'
	| 'APPLY'
	| 'READ_AFTER'
	| 'GRAPH_CAS'
	| 'FINAL_READ';
export interface ClimateAutomationGraphFacts {
	readonly revision: number;
	readonly edges: readonly { readonly outputPropertyId: string; readonly sourcePropertyId: string }[];
}
/** Complete TEST/dormant ownership plan derived from the original and normalized full projection.
 * C must audit complete concrete ownership; this is trusted read-only protocol, not a SQL sandbox.
 * Owned IDs are unique, edge arrays are multisets (duplicates are significant), empty is valid.
 */
export interface ClimateAutomationGraphReplacementPlan {
	readonly ownedOutputIds: readonly string[];
	readonly beforeEdges: ClimateAutomationGraphFacts['edges'];
	readonly replacementEdges: ClimateAutomationGraphFacts['edges'];
}
export interface ClimateAutomationGraphDelta {
	readonly before: ClimateAutomationGraphFacts;
	readonly plan: ClimateAutomationGraphReplacementPlan;
	/** Independently computed BEFORE APPLY; never replaced by observed post-apply edges. */
	readonly afterEdges: ClimateAutomationGraphFacts['edges'];
	readonly structuralBefore: ClimateAutomationJson;
	readonly structuralAfter: ClimateAutomationJson;
}
export type ClimateAutomationValidationReason =
	| 'original_identity_lost'
	| 'validation_superseded'
	| 'revision_mismatch'
	| 'missing_graph'
	| 'unsupported_legacy_listener'
	| 'listener_set_changed'
	| 'validation_rejected';
export type ClimateAutomationGraphValidation =
	| { readonly outcome: 'VALIDATED_AT_OBSERVED_REVISION'; readonly revision: number }
	| { readonly outcome: 'THIS_JOB_NOT_VALIDATED'; readonly reason: ClimateAutomationValidationReason };
export interface ClimateAutomationGraphParticipant {
	/** Existing concrete graph's pure capture. Required only by the new route family; no generation is minted by capture. */
	readonly captureOwnedPublicationLifecycle?: () => Readonly<{
		isCurrent: () => boolean;
		guard: Readonly<{ isCurrent: () => boolean; reason: string }>;
	}>;

	readonly readReservedGraph: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
	) => Promise<ClimateAutomationGraphFacts>;
	readonly validateReservedReplacement: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		delta: ClimateAutomationGraphDelta,
	) => Promise<void>;
	readonly beginReservedValidation: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		delta: ClimateAutomationGraphDelta,
	) => ClimateAutomationValidationTicket;
	readonly advanceReservedGraph: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		delta: ClimateAutomationGraphDelta,
	) => Promise<ClimateAutomationGraphFacts>;
	readonly validateAcknowledgedGraph: (
		job: ClimateAutomationAcknowledgedJob,
		ticket: ClimateAutomationValidationTicket,
		revision: number,
	) => Promise<ClimateAutomationGraphValidation>;
}
/** Trusted SAME-manager protocol, NOT an EntityManager sandbox. No public caller-supplied functions. */
export interface ClimateAutomationParticipant {
	/** Optional closed manual codec; never inferred from generic replacement support. */
	readonly manualIntentV1?: ClimateAutomationManualCapability;
	readonly version: 1;
	readonly graph: ClimateAutomationGraphParticipant;
	readonly readInManager: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		controllerId: string,
	) => Promise<ClimateAutomationParticipantImage | null>;
	readonly normalizeInManager: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		kind: ClimateAutomationReplacementKind,
		desired: ClimateAutomationJson,
		before: ClimateAutomationParticipantImage,
	) => Promise<ClimateAutomationParticipantDocument>;
	/** Read-only complete ownership projection; no helpers, writes or I/O. Inputs are owned immutable images. */
	readonly planGraphReplacementInManager: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		before: ClimateAutomationParticipantImage,
		next: ClimateAutomationParticipantDocument,
	) => Promise<ClimateAutomationGraphReplacementPlan>;
	/** Exact affected-one controller CAS; no private source/slot or graph singleton writes, nested helpers or I/O. */
	readonly applyInManager: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		before: ClimateAutomationParticipantImage,
		next: ClimateAutomationParticipantImage,
	) => Promise<void>;
}
export class ClimateAutomationParticipantConflict extends Error {
	constructor(readonly reason: ClimateAutomationConflictReason) {
		super('Private climate participant conflict');
	}
}

/** DORMANT private manual protocol. No source/slot mutation policy is supplied by a caller/provider. */
export type ClimateAutomationManualIntent =
	| {
			readonly kind: 'manual-settings:v1';
			readonly updates: readonly { readonly propertyId: string; readonly value: number | boolean }[];
	  }
	| {
			readonly kind: 'manual-preset:v1';
			readonly preset: 'comfort' | 'eco' | 'away' | null;
			readonly clearUserOff: boolean;
	  };
export type ClimateAutomationManualFence =
	| { readonly kind: 'exact'; readonly controllerRevision: number; readonly graphRevision: number }
	| { readonly kind: 'current-at-admitted-setting-submission' };
export interface ClimateAutomationControllerIntentRequest {
	readonly providerKey: string;
	readonly controllerId: string;
	readonly fence: ClimateAutomationManualFence;
	readonly intent: ClimateAutomationManualIntent;
}
/** Private evidence only: exact retained recovery rows, never part of a participant document/receipt. */
export interface ClimateAutomationRetainedRecoveryRow {
	readonly id: string;
	readonly controllerId: string;
	readonly claimId: string;
	readonly physicalIdentity: string;
	readonly previousPropertyIdentity: string;
	readonly restoredPropertyId: string;
	readonly actorId: string;
	readonly reason: string;
	readonly disconnectionAcknowledged: boolean;
	readonly configurationRevision: number;
	readonly claimRevision: number;
	readonly createdAt: string;
}
export interface ClimateAutomationManualCapability {
	readonly version: 1;
	readonly codec: 'virtual-thermostat-c0:v1';
	readonly readRetainedHistoryInManager: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		controllerId: string,
	) => Promise<readonly ClimateAutomationRetainedRecoveryRow[]>;
	/** Read-only exact-manager semantic/reference validation; no returned policy/changed flags. */
	readonly validateInManager: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		intent: ClimateAutomationManualIntent,
		before: ClimateAutomationParticipantImage,
		next: ClimateAutomationParticipantDocument,
	) => Promise<void>;
}
export type ClimateAutomationControllerIntentOutcome =
	| { readonly outcome: 'conflict'; readonly reason: ClimateAutomationConflictReason }
	| {
			readonly outcome: 'applied' | 'unchanged';
			readonly controllerRevision: number;
			readonly graphRevision: number;
			readonly document: ClimateAutomationParticipantDocument;
	  };

function manualInvalid(): never {
	throw new ClimateAutomationParticipantConflict('invalid');
}
function manualRecord(value: unknown): Readonly<Record<string, ClimateAutomationJson>> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return manualInvalid();
	const result: Record<string, ClimateAutomationJson> = {};
	for (const key of Object.keys(value))
		Object.defineProperty(result, key, {
			value: climateAutomationJson(nativeFieldEvidence.get(value, key)),
			enumerable: true,
		});
	return Object.freeze(result);
}
function manualRows(value: unknown): readonly Readonly<Record<string, ClimateAutomationJson>>[] {
	if (!Array.isArray(value)) return manualInvalid();
	return value.map((row: unknown) => manualRecord(row));
}
function manualKeys(value: Readonly<Record<string, ClimateAutomationJson>>, keys: readonly string[]): void {
	if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) manualInvalid();
}
function manualCounter(value: unknown, minimum: number): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) return manualInvalid();
	return value;
}
function manualUuid(value: string): void {
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) manualInvalid();
}
/** One owned traversal; full membership and all twelve persisted columns are retained. */
export function climateAutomationRetainedRecoveryRows(
	value: unknown,
	controllerId: string,
): readonly ClimateAutomationRetainedRecoveryRow[] {
	const rows = manualRows(value).map((row): ClimateAutomationRetainedRecoveryRow => {
		manualKeys(row, [
			'id',
			'controllerId',
			'claimId',
			'physicalIdentity',
			'previousPropertyIdentity',
			'restoredPropertyId',
			'actorId',
			'reason',
			'disconnectionAcknowledged',
			'configurationRevision',
			'claimRevision',
			'createdAt',
		]);
		const {
			id,
			controllerId: owner,
			claimId,
			physicalIdentity,
			previousPropertyIdentity,
			restoredPropertyId,
			actorId,
			reason,
			disconnectionAcknowledged,
			createdAt,
		} = row;
		if (
			typeof id !== 'string' ||
			typeof owner !== 'string' ||
			owner !== controllerId ||
			typeof claimId !== 'string' ||
			typeof physicalIdentity !== 'string' ||
			typeof previousPropertyIdentity !== 'string' ||
			typeof restoredPropertyId !== 'string' ||
			typeof actorId !== 'string' ||
			typeof reason !== 'string' ||
			typeof disconnectionAcknowledged !== 'boolean' ||
			typeof createdAt !== 'string' ||
			!Number.isFinite(Date.parse(createdAt)) ||
			new Date(createdAt).toISOString() !== createdAt
		)
			return manualInvalid();
		for (const identity of [id, claimId, restoredPropertyId]) manualUuid(identity);
		return Object.freeze({
			id,
			controllerId: owner,
			claimId,
			physicalIdentity,
			previousPropertyIdentity,
			restoredPropertyId,
			actorId,
			reason,
			disconnectionAcknowledged,
			configurationRevision: manualCounter(row.configurationRevision, 1),
			claimRevision: manualCounter(row.claimRevision, 1),
			createdAt,
		});
	});
	rows.sort((a, b) => a.id.localeCompare(b.id));
	if (new Set(rows.map((row) => row.id)).size !== rows.length) return manualInvalid();
	return Object.freeze(rows);
}
function manualPreset(value: unknown): 'comfort' | 'eco' | 'away' | null;
function manualPreset(value: unknown): unknown {
	if (value === null || value === 'comfort' || value === 'eco' || value === 'away') return value;
	return manualInvalid();
}
/** Parse ONLY an already-owned snapshot; root admission must precede its caller getter traversal. */
export function climateAutomationControllerIntentRequest(
	value: ClimateAutomationJson,
): ClimateAutomationControllerIntentRequest {
	const input = manualRecord(value);
	manualKeys(input, ['providerKey', 'controllerId', 'fence', 'intent']);
	if (typeof input.providerKey !== 'string' || typeof input.controllerId !== 'string') return manualInvalid();
	const raw = manualRecord(input.intent);
	let intent: ClimateAutomationManualIntent;
	if (raw.kind === 'manual-settings:v1') {
		manualKeys(raw, ['kind', 'updates']);
		if (!Array.isArray(raw.updates) || raw.updates.length === 0 || raw.updates.length > 5) return manualInvalid();
		const updates = raw.updates.map((item: unknown) => {
			const update = manualRecord(item);
			manualKeys(update, ['propertyId', 'value']);
			if (
				typeof update.propertyId !== 'string' ||
				(typeof update.value !== 'boolean' && !(typeof update.value === 'number' && Number.isFinite(update.value)))
			)
				return manualInvalid();
			return Object.freeze({ propertyId: update.propertyId, value: update.value });
		});
		if (new Set(updates.map((update) => update.propertyId)).size !== updates.length) return manualInvalid();
		intent = Object.freeze({ kind: 'manual-settings:v1', updates: Object.freeze(updates) });
	} else if (raw.kind === 'manual-preset:v1') {
		manualKeys(raw, ['kind', 'preset', 'clearUserOff']);
		if (typeof raw.clearUserOff !== 'boolean') return manualInvalid();
		intent = Object.freeze({
			kind: 'manual-preset:v1',
			preset: manualPreset(raw.preset),
			clearUserOff: raw.clearUserOff,
		});
	} else return manualInvalid();
	const rawFence = manualRecord(input.fence);
	let fence: ClimateAutomationManualFence;
	if (rawFence.kind === 'exact') {
		manualKeys(rawFence, ['kind', 'controllerRevision', 'graphRevision']);
		fence = Object.freeze({
			kind: 'exact',
			controllerRevision: manualCounter(rawFence.controllerRevision, 1),
			graphRevision: manualCounter(rawFence.graphRevision, 0),
		});
	} else if (rawFence.kind === 'current-at-admitted-setting-submission' && intent.kind === 'manual-settings:v1') {
		manualKeys(rawFence, ['kind']);
		fence = Object.freeze({ kind: 'current-at-admitted-setting-submission' });
	} else return manualInvalid();
	return Object.freeze({ providerKey: input.providerKey, controllerId: input.controllerId, fence, intent });
}

/** Fixed private C0 codec; this pure data reduction does not validate a database or grant a turn. */
export function climateAutomationReduceManualIntent(
	before: ClimateAutomationParticipantImage,
	intent: ClimateAutomationManualIntent,
) {
	const configuration = manualRecord(before.configuration),
		original = manualRecord(before.comfort);
	manualKeys(original, ['requestedMode', 'locked', 'requestedSetpoints', 'configuration']);
	if (configuration.projectionVersion !== 1 || typeof original.locked !== 'boolean') return manualInvalid();
	let mode = original.requestedMode,
		locked = original.locked;
	if (mode !== 'off' && mode !== 'heat' && mode !== 'cool' && mode !== 'auto') return manualInvalid();
	const points = manualRecord(original.requestedSetpoints);
	manualKeys(points, ['heatingSetpoint', 'coolingSetpoint']);
	for (const value of Object.values(points))
		if (value !== null && !(typeof value === 'number' && Number.isFinite(value))) return manualInvalid();
	let heating = points.heatingSetpoint,
		cooling = points.coolingSetpoint;
	let state = original.configuration === null ? null : manualRecord(original.configuration);
	if (state && (typeof state.user_off !== 'boolean' || !Object.hasOwn(state, 'selected_preset')))
		return manualInvalid();
	if (!state && before.legacyBaseline !== null) return manualInvalid();
	const selected = state ? manualPreset(state.selected_preset) : null;
	const oldManual = { mode, points, preset: selected, userOff: state ? state.user_off : null };
	let manualCommand = intent.kind === 'manual-preset:v1';
	let hold: 'takeover' | 'clear' | 'preserve' = 'preserve';
	if (intent.kind === 'manual-settings:v1') {
		const bindings = manualRows(configuration.settings);
		const updates = intent.updates.map((update) => {
			const matches = bindings.filter((row) => row.propertyId === update.propertyId);
			if (matches.length !== 1) return manualInvalid();
			const setting = matches[0].setting;
			if (
				typeof setting !== 'string' ||
				!['heating_setpoint', 'cooling_setpoint', 'heating_enabled', 'cooling_enabled', 'locked'].includes(setting)
			)
				return manualInvalid();
			return { setting, value: update.value };
		});
		const owner = manualRows(manualRecord(configuration.catalog).devices).find((row) => row.id === before.controllerId);
		if (!owner || owner.enabled !== true || (locked && updates.some((update) => update.setting !== 'locked')))
			return manualInvalid();
		let heat = mode === 'heat' || mode === 'auto',
			cool = mode === 'cool' || mode === 'auto';
		let enabledCommand = false;
		for (const update of updates) {
			if (update.setting === 'heating_setpoint' || update.setting === 'cooling_setpoint') {
				if (
					typeof update.value !== 'number' ||
					!Number.isFinite(update.value) ||
					(update.setting === 'heating_setpoint' ? heating : cooling) === null
				)
					return manualInvalid();
				if (update.setting === 'heating_setpoint') heating = update.value;
				else cooling = update.value;
			} else {
				if (typeof update.value !== 'boolean') return manualInvalid();
				if (update.setting === 'locked') locked = update.value;
				else {
					enabledCommand = true;
					if (update.setting === 'heating_enabled') {
						if (heating === null) return manualInvalid();
						heat = update.value;
					} else {
						if (cooling === null) return manualInvalid();
						cool = update.value;
					}
				}
			}
		}
		manualCommand = updates.some((update) => update.setting !== 'locked');
		if (manualCommand) {
			hold = 'takeover';
			mode = heat ? (cool ? 'auto' : 'heat') : cool ? 'cool' : 'off';
			if (state)
				state = Object.freeze({
					...state,
					selected_preset: null,
					...(enabledCommand ? { user_off: !heat && !cool } : {}),
				});
		}
	} else {
		if (!state || locked) return manualInvalid();
		if (intent.preset !== null && !manualRows(state.presets).some((entry) => entry.preset === intent.preset))
			return manualInvalid();
		state = Object.freeze({
			...state,
			selected_preset: intent.preset,
			user_off: intent.clearUserOff ? false : state.user_off,
		});
		hold = intent.preset === null ? 'preserve' : 'clear';
	}
	const requestedSetpoints = Object.freeze({ heatingSetpoint: heating, coolingSetpoint: cooling });
	const comfort = climateAutomationJson({ requestedMode: mode, locked, requestedSetpoints, configuration: state });
	const document: ClimateAutomationParticipantDocument = Object.freeze({
		controllerId: before.controllerId,
		documentVersion: 1,
		configuration: before.configuration,
		comfort,
		structural: before.structural,
		legacyBaseline: before.legacyBaseline,
	});
	const nextManual = {
		mode,
		points: requestedSetpoints,
		preset: state ? state.selected_preset : null,
		userOff: state ? state.user_off : null,
	};
	return Object.freeze({
		document,
		manualCommand,
		hold,
		manualFieldsChanged: climateAutomationCanonical(oldManual) !== climateAutomationCanonical(nextManual),
	});
}

/** CLOSED trusted thermostat authoring only. No caller callback, manager, private slot or arbitrary result. */
export interface ClimateAutomationCreationRequest {
	readonly kind: 'create-virtual-thermostat:v1';
	readonly device: unknown;
	readonly configuration: unknown;
}
export interface ClimateAutomationCreationRow {
	readonly table: string;
	readonly row: Readonly<Record<string, ClimateAutomationJson>>;
}
export interface ClimateAutomationCreationFacts {
	readonly tables: Readonly<Record<string, readonly Readonly<Record<string, ClimateAutomationJson>>[]>>;
}
export interface ClimateAutomationCreationPlan {
	readonly version: 1;
	readonly controllerId: string;
	readonly createdAt: string;
	readonly outputIds: readonly string[];
	readonly device: ClimateAutomationJson;
	readonly prepared: ClimateAutomationJson;
	/** Independently materialized before APPLY, not copied from observed post-apply rows. */
	readonly inserts: readonly ClimateAutomationCreationRow[];
	readonly response: ClimateAutomationJson;
}
export interface ClimateAutomationCreationCapability {
	/** Closed public creation DTO wire v1; no business validation or materialization. */
	readonly snapshotInput: (
		device: unknown,
		configuration: unknown,
	) => Readonly<{
		device: ClimateAutomationJson;
		configuration: ClimateAutomationJson;
	}>;
	readonly version: 1;
	readonly graph: ClimateAutomationGraphParticipant;
	readonly captureEnvironment: () => DeviceCreationEnvironment;
	readonly isCurrent: () => boolean;
	readonly holdAtEntry: () => Readonly<{ release: () => Promise<void> }>;
	readonly readFactsInManager: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
	) => Promise<ClimateAutomationCreationFacts>;
	readonly prepareInManager: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		request: ClimateAutomationCreationRequest,
		before: ClimateAutomationCreationFacts,
		graphRevision: number,
	) => Promise<ClimateAutomationCreationPlan>;
	readonly applyInManager: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		plan: ClimateAutomationCreationPlan,
		context: DeviceCreationContext,
	) => Promise<void>;
}
export type ClimateAutomationCreationOutcome =
	| { readonly outcome: 'applied'; readonly result: ClimateAutomationJson }
	| { readonly outcome: 'conflict'; readonly reason: ClimateAutomationConflictReason };

/** Closed existing-catalog operation. Wire payloads are decoded by the original concrete codec,
 * never interpreted as a desired private document, SQL, callback or caller-owned ledger plan. */
export type ClimateAutomationExistingKind =
	| 'configure-existing:v1'
	| 'settings:v1'
	| 'preset:v1'
	| 'comfort-definition:v1'
	| 'override-create:v1'
	| 'override-cancel:v1'
	| 'settle-override:v1'
	| 'request-release:v1'
	| 'restore-actuator:v1';
export type ClimateAutomationExistingRequest =
	| Readonly<{ providerKey: string; kind: 'settings:v1'; input: unknown }>
	| Readonly<{
			providerKey: string;
			controllerId: string;
			kind: Exclude<ClimateAutomationExistingKind, 'settings:v1'>;
			input: unknown;
	  }>;
export interface ClimateAutomationExistingInput {
	readonly providerKey: string;
	readonly controllerId: string;
	readonly kind: ClimateAutomationExistingKind;
	readonly wire: ClimateAutomationJson;
}
/** Full listener-free raw evidence, including NULL/JSON/native STI columns and memberships.
 * The plugin can only materialize the enumerated catalog family; the ledger is exclusively core-owned. */
export type ClimateAutomationExistingTable =
	| 'configurations'
	| 'sources'
	| 'actuators'
	| 'settings'
	| 'protections'
	| 'cooling'
	| 'devices'
	| 'channels'
	| 'properties'
	| 'runtime'
	| 'commands'
	| 'recovery'
	| 'installations'
	| 'referenceCatalog';
export interface ClimateAutomationExistingFacts {
	readonly controllerId: string;
	readonly image: ClimateAutomationParticipantImage | null;
	readonly graph: ClimateAutomationGraphFacts;
	readonly rows: Readonly<Record<ClimateAutomationExistingTable, readonly ClimateAutomationJson[]>>;
}
export interface ClimateAutomationExistingSemantic {
	readonly configuration: ClimateAutomationJson;
	readonly comfort: ClimateAutomationJson;
	readonly structural: ClimateAutomationJson;
	readonly presentation: ClimateAutomationJson;
}
export interface ClimateAutomationExistingNormalized {
	readonly before: ClimateAutomationExistingSemantic;
	readonly next: ClimateAutomationExistingSemantic;
	readonly graphPlan: ClimateAutomationGraphReplacementPlan;
	/** A genuine original clock observation is private to the concrete codec, not supplied by HTTP. */
	readonly watermarkOnly: boolean;
}
export interface ClimateAutomationExistingPlan {
	readonly descriptor: ClimateAutomationScope;
	readonly properties: readonly import('../entities/devices.entity').ChannelPropertyEntity[];
	readonly expected: ClimateAutomationExistingFacts;
	readonly response: ClimateAutomationJson;
	readonly mirrors: readonly { readonly propertyId: string; readonly value: number | boolean | string | null }[];
}
/** Private in-process scheduling/cleanup identities. They never grant SQL, claims or transport authority. */
export class ClimateAutomationRuntimeConsumer {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
export class ClimateAutomationRuntimeCapture {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
export class ClimateAutomationRuntimeCheckpoint {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
export class ClimateAutomationRuntimeDebt {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
/** Inert original history, not native, claim, publication or response authority. */
export class ClimateAutomationPredecessors {
	constructor(readonly projections: readonly object[]) {}
	toJSON(): Readonly<Record<string, never>> { return {}; }
}
export interface ClimateAutomationPredecessorTransition {
	readonly projection: object;
	readonly before: Readonly<Record<string, string | number | boolean | null>>;
	readonly after: Readonly<Record<string, string | number | boolean | null>>;
}
export type ClimateAutomationPredecessorMethod<Args extends unknown[], Result> =
	((...args: Args) => Result) & Readonly<{ call: (receiver: object, ...args: Args) => Result }>;
export interface ClimateAutomationPredecessorPorts {
	readonly owner: object;
	readonly capture: ClimateAutomationPredecessorMethod<[controllerId: string], ClimateAutomationPredecessors>;
	readonly size: ClimateAutomationPredecessorMethod<[capture: ClimateAutomationPredecessors], number>;
	/** Pure, single-use recognition of an ORIGINAL synchronous native invocation; never SQL permission. */
	readonly recognize: ClimateAutomationPredecessorMethod<[capture: ClimateAutomationPredecessors, event: import('typeorm').BeforeQueryEvent<unknown>], boolean>;
	readonly join: ClimateAutomationPredecessorMethod<[capture: ClimateAutomationPredecessors], Promise<readonly ClimateAutomationPredecessorTransition[]>>;
	readonly close: ClimateAutomationPredecessorMethod<[capture: ClimateAutomationPredecessors], void>;
}
export interface ClimateAutomationRuntimeConsumerBinding {
	readonly owner: object;
	readonly lifecycle: object;
	readonly comfort: object;
	readonly providerKey: string;
	readonly predecessors: ClimateAutomationPredecessorPorts;
}
export type ClimateAutomationRuntimeAssessment =
	| Readonly<{ kind: 'reuse' }>
	| Readonly<{ kind: 'closed' }>
	| Readonly<{ kind: 'settle'; debt: ClimateAutomationRuntimeDebt | ClimateAutomationNotificationReceipt }>;
export interface ClimateAutomationSettlementContinuity {
	readonly isCurrent: () => boolean;
	readonly close: () => void;
}
export interface ClimateAutomationExistingCapability {
	readonly version: 1;
	readonly codec: 'virtual-thermostat-existing:v1';
	readonly isCurrent: () => boolean;
	readonly snapshotInput: (kind: ClimateAutomationExistingKind, input: unknown) => ClimateAutomationJson;
	readonly holdAtEntry: () => Readonly<{ prepare: () => Promise<void>; release: () => void }>;
	readonly captureEnvironment: () => Readonly<{
		readonly settlementContinuity?: ClimateAutomationSettlementContinuity;
		destinations: import('../../storage/services/storage.service').CreationStorageDestinations;
		/** Fixed materialized LOCAL properties only: one finite veto observation, never a callback or write permit. */
		observeProperties: (properties: readonly import('../entities/devices.entity').ChannelPropertyEntity[]) => void;
		/** Original readonly policy callbacks at an unlocked effect boundary, never inside native COMMIT. */
		checkProperties: () => void;
		isCurrent: () => boolean;
		close: () => void;
	}>;
	readonly readFactsInManager: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		controllerId: string,
	) => Promise<ClimateAutomationExistingFacts>;
	readonly normalizeInManager: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		input: ClimateAutomationExistingInput,
		before: ClimateAutomationExistingFacts,
	) => Promise<ClimateAutomationExistingNormalized>;
	readonly materializeInManager: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		input: ClimateAutomationExistingInput,
		before: ClimateAutomationExistingFacts,
		normalized: ClimateAutomationExistingNormalized,
		revision: number,
	) => Promise<ClimateAutomationExistingPlan>;
	readonly applyInManager: (
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		before: ClimateAutomationExistingFacts,
		plan: ClimateAutomationExistingPlan,
	) => Promise<void>;
	readonly completeAcknowledged: (
		input: ClimateAutomationExistingInput,
		plan: ClimateAutomationExistingPlan,
		slot: ClimateAutomationSlotFacts,
		publication: import('../services/device-creation-context').ControllerMutationPublicationLease | null,
	) => Promise<ClimateAutomationJson>;
}
export interface ClimateAutomationExistingOutcome {
	readonly descriptor: ClimateAutomationScope;
	readonly outcome: 'applied' | 'unchanged';
	readonly controllerRevision: number;
	readonly graphRevision: number;
	readonly slot: ClimateAutomationSlotFacts;
	readonly response: ClimateAutomationJson;
	readonly publication: import('../services/device-creation-context').ControllerMutationPublicationLease | null;
}

/** Readonly core-derived clock facts, exposed ONLY through an authenticated existing command turn. */
export interface ClimateAutomationExistingClock {
	readonly wallMs: number;
	readonly monoMs: number;
	readonly overrideId: string | null;
	readonly status: 'active' | 'expired' | 'clock_uncertain' | null;
	readonly watermark: number | null;
	readonly deadline: number | null;
	readonly terminatedAt: string | null;
}
export interface ClimateAutomationOverrideFacts {
	readonly id: string;
	readonly source: 'user' | 'panel';
	readonly actor_id: string;
	readonly revision: number;
	readonly created_at: string;
	readonly original_duration_ms: number;
	readonly wall_watermark_ms: number;
	readonly expires_at: string;
	readonly preset: 'comfort' | 'eco' | 'away' | null;
	readonly setpoints: { heating_setpoint: number | null; cooling_setpoint: number | null } | null;
	readonly resolved_setpoints: { heating_setpoint: number | null; cooling_setpoint: number | null };
	readonly status: 'active';
	readonly terminated_at: null;
}

/** Finite readonly veto observation, never source/command/publication authority. */
export class ClimateAutomationIntentView {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}

/** Event-only original receipt. It can never authorize values, SQL or a manager. */
export class ClimateAutomationNotificationReceipt {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}

/** Original process-local override budget. Closing it is a veto, not a durable intent mutation. */
export class ClimateAutomationOverrideLease {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
