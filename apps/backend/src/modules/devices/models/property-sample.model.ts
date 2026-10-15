import { PropertyProducerQuality } from './property-value-state.model';

/** Internal provider evidence; source clocks never establish command causality. */
export interface PropertySampleEvidence {
	readonly sampledAt: Date;
	readonly receivedAt: Date;
	readonly provenance: 'live' | 'cached' | 'retained';
	/** Internal semantic classification; generic imperative cover mappings do not establish native movement state. */
	readonly semanticOrigin?: 'native_cover_status';
	/** Factual API field presence in a native status, not hardware qualification. */
	readonly nativeCoverTagPresent?: boolean;
	/** Opaque process-local command observation capability; never serialized or persisted. */
	readonly commandObservation?: object;
	/** Server poll request start or notification capture, before queuing. */
	readonly observedAt?: Date;
	/** Pure process-local generation/identity guard; never serialized or supplied by a public DTO. */
	readonly isCurrent?: () => boolean;
	/** Stable connection/configuration identity after acceptance; ordinary newer packets do not revoke it. */
	readonly sourceIsCurrent?: () => boolean;
}

/** Exact process-local live acceptance incorporated by a derived publication; never persisted. */
export interface IncorporatedPropertySample {
	readonly propertyId: string;
	readonly acceptanceGeneration: number;
}

export interface AcceptedPropertySample {
	readonly propertyId: string;
	readonly value: string | boolean | number;
	readonly sampledAt: Date;
	readonly receivedAt: Date;
	readonly provenance: PropertySampleEvidence['provenance'];
	readonly semanticOrigin?: PropertySampleEvidence['semanticOrigin'];
	readonly nativeCoverTagPresent?: boolean;
	/** Internal qualified readers only; omitted from sample events/history. */
	readonly commandObservation?: object;
	readonly quality: Exclude<PropertyProducerQuality, 'unavailable'>;
	readonly reasons: readonly string[];
	readonly revision?: number;
	/** Monotonic identity of an accepted live report, independent of its sample clock. */
	readonly acceptanceGeneration?: number;
}

export interface DerivedPropertyPublication {
	readonly quality: Exclude<PropertyProducerQuality, 'unavailable'>;
	readonly reasons: readonly string[];
	readonly sampledAt: Date;
	readonly evaluatedAt: Date;
	readonly expiresAt: Date;
	readonly sourceSample?: IncorporatedPropertySample;
}

export interface QualifiedPropertySample extends AcceptedPropertySample {
	readonly provenance: 'live';
}
