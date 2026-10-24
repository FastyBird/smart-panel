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
	readonly validateInManager: (
		manager: EntityManager,
		source: Readonly<ClimateAutomationSourceFacts>,
		purpose: 'prepare' | 'retire',
	) => Promise<ClimateAutomationJson | null>;
}

/** Read/validation only. Registration does not establish a controller or grant mutation authority. */
export interface ClimateAutomationProvider {
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
}

export interface ClimateAutomationOwnedRegistration {
	readonly dispose: () => void;
}
export interface ClimateAutomationCapturedRegistration<T> {
	readonly implementation: T;
	readonly isCurrent: () => boolean;
}
