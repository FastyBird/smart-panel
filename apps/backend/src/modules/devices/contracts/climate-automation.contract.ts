import type { EntityManager } from 'typeorm';

/** PRIVATE core protocol. No HTTP/Swagger schema, runtime frame or physical authority. */
export type ClimateAutomationJson =
	| null
	| boolean
	| number
	| string
	| readonly ClimateAutomationJson[]
	| { readonly [key: string]: ClimateAutomationJson };

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
	/** Process-local invalidation only; never substitutes for native source validation. */
	readonly captureCurrent?: (source: Readonly<ClimateAutomationSourceFacts>) => () => boolean;
	readonly validateInManager: (
		manager: EntityManager,
		source: Readonly<ClimateAutomationSourceFacts>,
		purpose: 'prepare' | 'retire' | 'restore',
		provider?: ClimateAutomationCapturedRegistration<ClimateAutomationProvider>,
	) => Promise<ClimateAutomationJson | null>;
}

/** Read/validation only. Registration does not establish a controller or grant mutation authority. */
export interface ClimateAutomationProvider {
	/** Finite original work, joined before structural/native deletion admission. */
	readonly beginControllerDeletion?: (expected: Readonly<ClimateAutomationSlotFacts>) => Promise<void>;
	readonly readDeletionConfigurationInManager?: (
		manager: EntityManager,
		controllerId: string,
	) => Promise<ClimateAutomationJson>;
	/** Native absence of all controller-owned rows, never an event/cache inference. */
	readonly readDeletedControllerInManager?: (
		manager: EntityManager,
		controllerId: string,
		before: ClimateAutomationControllerFacts,
	) => Promise<ClimateAutomationJson>;
	readonly validateDeletedControllerInManager?: (
		manager: EntityManager,
		controllerId: string,
		retained: ClimateAutomationJson,
	) => Promise<void>;
	readonly captureControllerRecreationArchiveInManager?: (
		manager: EntityManager,
		controllerId: string,
		retained: ClimateAutomationJson,
	) => Promise<ClimateAutomationJson>;
	readonly prepareControllerRecreationInManager?: (
		manager: EntityManager,
		controllerId: string,
		retained: ClimateAutomationJson,
		archive: ClimateAutomationJson,
	) => Promise<ClimateAutomationJson>;
	readonly validateControllerRecreationInManager?: (
		manager: EntityManager,
		controllerId: string,
		preparation: ClimateAutomationJson,
	) => Promise<void>;
	/** Closed plugin-owned operation; it acquires structure before its original native graph unit. */
	readonly withAutomationWrite?: (work: (manager: EntityManager) => Promise<void>) => Promise<void>;
	readonly resolveActionInManager?: (
		manager: EntityManager,
		controllerId: string,
		action: ClimateAutomationJson,
	) => Promise<ClimateAutomationJson | null>;
	readonly retireControllerInManager?: (
		manager: EntityManager,
		slot: Readonly<ClimateAutomationSlotFacts>,
	) => Promise<void>;
	/** Synchronous revocation and finite original predecessor capture; join outside structural/native ownership. */
	readonly beginSourceMutation?: (producerKey: string, subjectId: string, generationId: string) => Promise<void>;
	readonly settleInstalled?: (
		slots: readonly ClimateAutomationSlotFacts[],
		producer: ClimateAutomationCapturedRegistration<ClimateAutomationProducer>,
	) => Promise<boolean>;

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
	/** Requalify an existing installed selection after an admitted compatible comfort-only mutation. */
	readonly refreshControllerInManager?: (
		manager: EntityManager,
		slot: Readonly<ClimateAutomationSlotFacts>,
		before: Readonly<ClimateAutomationControllerFacts>,
		kind: 'intent' | 'watermark',
	) => Promise<ClimateAutomationControllerFacts>;
	/** Optional closed mutation capability. Read-only providers can never finalize LIVE. */
	readonly installControllerInManager?: (
		manager: EntityManager,
		slot: Readonly<ClimateAutomationSlotFacts>,
	) => Promise<ClimateAutomationControllerFacts>;
}

export interface ClimateAutomationOwnedRegistration {
	readonly dispose: () => void;
}
export interface ClimateAutomationCapturedRegistration<T> {
	readonly implementation: T;
	readonly isCurrent: () => boolean;
}

// Opaque identities are checked by the ledger's private WeakMaps, never by these readonly facts.
declare const climateLedgerIdentity: unique symbol;
export interface ClimateAutomationLedgerScope {
	readonly [climateLedgerIdentity]: 'scope';
}
export interface ClimateAutomationSourceSnapshot {
	readonly [climateLedgerIdentity]: 'source';
	readonly facts: ClimateAutomationSourceFacts | null;
}
export interface ClimateAutomationSlotSnapshot {
	readonly [climateLedgerIdentity]: 'slot';
	readonly facts: ClimateAutomationSlotFacts | null;
	readonly controller: ClimateAutomationControllerFacts | null;
}
