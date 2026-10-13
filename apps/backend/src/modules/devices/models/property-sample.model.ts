import { PropertyProducerQuality } from './property-value-state.model';

/** Internal provider evidence; source clocks never establish command causality. */
export interface PropertySampleEvidence {
	readonly sampledAt: Date;
	readonly receivedAt: Date;
	readonly provenance: 'live' | 'cached' | 'retained';
	/** Server poll request start or notification capture, before queuing. */
	readonly observedAt?: Date;
}

export interface AcceptedPropertySample {
	readonly propertyId: string;
	readonly value: string | boolean | number;
	readonly sampledAt: Date;
	readonly receivedAt: Date;
	readonly provenance: PropertySampleEvidence['provenance'];
	readonly quality: Exclude<PropertyProducerQuality, 'unavailable'>;
	readonly reasons: readonly string[];
	readonly revision?: number;
}

export interface DerivedPropertyPublication {
	readonly quality: Exclude<PropertyProducerQuality, 'unavailable'>;
	readonly reasons: readonly string[];
	readonly sampledAt: Date;
	readonly evaluatedAt: Date;
	readonly expiresAt: Date;
}

export interface QualifiedPropertySample extends AcceptedPropertySample {
	readonly provenance: 'live';
}
