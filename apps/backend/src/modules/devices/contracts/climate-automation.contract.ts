import { createHash } from 'node:crypto';
import { EntityManager } from 'typeorm';

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
	return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${climateAutomationCanonical(Reflect.get(value, key))}`).join(',')}}`;
}

/** Validate and copy private JSON; never retain mutable provider-owned evidence objects. */
export function climateAutomationJson(value: unknown): ClimateAutomationJson {
	if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (Array.isArray(value)) return Object.freeze(value.map((item: unknown) => climateAutomationJson(item)));
	if (typeof value !== 'object' || value === null) throw new Error('Invalid private climate JSON');
	const result: Record<string, ClimateAutomationJson> = {};
	for (const key of Object.keys(value)) {
		const item: unknown = Reflect.get(value, key);
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
	readonly readControllerInManager: (manager: EntityManager, controllerId: string) => Promise<ClimateAutomationControllerFacts | null>;
	readonly validateSelectionInManager: (
		manager: EntityManager,
		controllerId: string,
		facts: ClimateAutomationControllerFacts,
		selection: ClimateAutomationJson,
	) => Promise<boolean>;
	/** Trusted creation ONLY; called after config AND retained-slot checks. No network or nested transaction. */
	readonly createControllerInManager: (manager: EntityManager, controllerId: string, configuration: ClimateAutomationJson) => Promise<void>;
}

export interface ClimateAutomationOwnedRegistration { readonly dispose: () => void; }
export interface ClimateAutomationCapturedRegistration<T> {
	readonly implementation: T;
	readonly isCurrent: () => boolean;
}

/** Empty serializable shells. Actual identity is verified against writer-owned WeakMaps. */
export interface ClimateAutomationScope { readonly toJSON: () => Readonly<Record<string, never>>; }
export interface ClimateAutomationHandle { readonly toJSON: () => Readonly<Record<string, never>>; }
export type ClimateAutomationSelection = ClimateAutomationHandle | readonly ClimateAutomationHandle[];
export type ClimateAutomationConflictReason = 'stale' | 'uninitialized' | 'unavailable' | 'invalid';
export type ClimateAutomationCommittedOutcome =
	| { readonly outcome: 'applied' | 'unchanged'; readonly items: readonly { readonly outcome: 'applied' | 'unchanged' }[] }
	| { readonly outcome: 'conflict'; readonly reason: ClimateAutomationConflictReason };
export type ClimateAutomationCommitOutcome = 'not_started' | 'rolled_back' | 'refused' | 'unknown' | 'committed';

export class ClimateAutomationWriteError extends Error {
	constructor(readonly commitOutcome: ClimateAutomationCommitOutcome, cause: unknown) {
		super('Private climate ownership operation failed', { cause });
		this.name = 'ClimateAutomationWriteError';
	}
	toJSON(): { outcome: 'error'; commitOutcome: ClimateAutomationCommitOutcome } {
		return { outcome: 'error', commitOutcome: this.commitOutcome };
	}
}
