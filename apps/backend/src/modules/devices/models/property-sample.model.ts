import { PropertyProducerQuality } from './property-value-state.model';

/** Internal provider evidence; source clocks never establish command causality. */
export interface PropertySampleEvidence {
	readonly sampledAt: Date;
	readonly receivedAt: Date;
	readonly provenance: 'live' | 'cached' | 'retained';
	/** A device-level report may carry cached fields. Ordinary property reports omit this or use 'property'. */
	readonly reportScope?: 'property' | 'device';
	/** Internal semantic classification; generic imperative cover mappings do not establish native movement state. */
	readonly semanticOrigin?: 'native_cover_status' | 'native_cover_tilt_percentage';
	/** Factual API field presence in a native status, not hardware qualification. */
	readonly nativeCoverTagPresent?: boolean;
	/** Opaque process-local command observation capability; never serialized or persisted. */
	readonly commandObservation?: object;
	/** Server poll request start or notification capture, before queuing. */
	readonly observedAt?: Date;
	/**
	 * The sample replays earlier state (retained message, startup snapshot, cached replay) rather
	 * than reporting something new. It may still be live measurement evidence timed by its source,
	 * but it never confirms a command and never replaces a newer observation.
	 */
	readonly replay?: boolean;
	/**
	 * The measurement time of a replay is unknown (no source timestamp), so `sampledAt` is only its
	 * receipt time. Such a sample may update the displayed value, but never records a measurement
	 * time or a history point, and never moves the value's age forward.
	 */
	readonly ageUnknown?: boolean;
	/** An unordered discovery value may initialize an empty property after its source is verified at admission. */
	readonly seedOnly?: { readonly assertCurrent: () => Promise<void> };
	/**
	 * The sample only acknowledges a command Smart Panel sent (an integration publishing the commanded
	 * state once the device accepted it), not a report of the device's state. It may update the display,
	 * but never proves the physical state, for example that an output is off.
	 */
	readonly commandEcho?: boolean;
	/** Process-local arrival order, assigned by the devices module on receipt; never supplied by a DTO. */
	readonly ingressSequence?: number;
	/** Pure process-local generation/identity guard; never serialized or supplied by a public DTO. */
	readonly isCurrent?: () => boolean;
	/** Stable connection/configuration identity after acceptance; ordinary newer packets do not revoke it. */
	readonly sourceIsCurrent?: () => boolean;
}

/** Exact process-local live acceptance incorporated by a derived publication; never persisted. */
export interface IncorporatedPropertySample {
	readonly propertyId: string;
	readonly acceptanceGeneration: number;
	/** Derived authority is a real publication, never a physical acceptance with a leaf ID. */
	readonly producer?: Readonly<{
		lease: object;
		publication: number;
		revision: number;
		expiresAt: number;
		quality: PropertyProducerQuality;
	}>;
	readonly sources?: readonly IncorporatedPropertySample[];
}

export interface AcceptedPropertySample {
	readonly propertyId: string;
	readonly value: string | boolean | number;
	readonly sampledAt: Date;
	readonly receivedAt: Date;
	readonly provenance: PropertySampleEvidence['provenance'];
	readonly reportScope?: PropertySampleEvidence['reportScope'];
	readonly semanticOrigin?: PropertySampleEvidence['semanticOrigin'];
	readonly nativeCoverTagPresent?: boolean;
	/** Internal qualified readers only; omitted from sample events/history. */
	readonly commandObservation?: object;
	/** Set when the sample replays earlier state; see {@link PropertySampleEvidence.replay}. */
	readonly replay?: true;
	/** Set when the sample only acknowledges a command; see {@link PropertySampleEvidence.commandEcho}. */
	readonly commandEcho?: true;
	/** Process-local arrival order of the report; see {@link PropertySampleEvidence.ingressSequence}. */
	readonly ingressSequence?: number;
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
	/** Additive multi-input contract; supplying both forms is ambiguous and rejected. */
	readonly sourceSamples?: readonly IncorporatedPropertySample[];
}

export interface QualifiedPropertySample extends AcceptedPropertySample {
	readonly provenance: 'live';
}

/** Physical readback needs evidence about this property from a new, independent report. */
export function isIndependentPropertyReport(sample: AcceptedPropertySample | null | undefined): boolean {
	return (
		sample?.provenance === 'live' &&
		(sample.reportScope === undefined || sample.reportScope === 'property') &&
		!sample.replay &&
		!sample.commandEcho
	);
}
