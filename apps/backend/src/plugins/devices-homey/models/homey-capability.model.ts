export type HomeyCapabilityValue = boolean | number | string | null;

export enum HomeyCapabilityType {
	BOOLEAN = 'boolean',
	NUMBER = 'number',
	STRING = 'string',
	ENUM = 'enum',
	UNKNOWN = 'unknown',
}

export interface HomeyCapabilityEnumValue {
	readonly id: string;
	readonly title: string;
}

export interface HomeyCapability {
	/** The full Homey capability ID, including any instance suffix. */
	readonly id: string;
	/** The mapping lookup key derived from the full capability ID. */
	readonly baseId: string;
	readonly title: string;
	readonly value: HomeyCapabilityValue;
	readonly type: HomeyCapabilityType;
	readonly unit: string | null;
	readonly minimum: number | null;
	readonly maximum: number | null;
	readonly step: number | null;
	readonly enumValues: readonly HomeyCapabilityEnumValue[];
	readonly readable: boolean;
	readonly writable: boolean;
	readonly available: boolean | null;
	readonly lastUpdatedAt: string | null;
}

export type HomeyCapabilityInput = Omit<HomeyCapability, 'baseId'>;

/**
 * Derives the descriptor lookup key without changing the authoritative ID.
 */
export function getHomeyCapabilityBaseId(capabilityId: string): string {
	const suffixSeparator = capabilityId.indexOf('.');

	return suffixSeparator === -1 ? capabilityId : capabilityId.slice(0, suffixSeparator);
}

/**
 * Creates a normalized capability and prevents callers from supplying a base
 * ID that disagrees with the full Homey capability ID.
 */
export function createHomeyCapability(capability: HomeyCapabilityInput): HomeyCapability {
	return {
		...capability,
		baseId: getHomeyCapabilityBaseId(capability.id),
	};
}
