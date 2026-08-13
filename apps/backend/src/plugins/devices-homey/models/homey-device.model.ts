import { HomeyCapability } from './homey-capability.model';

export interface HomeyDeviceEnergy {
	readonly cumulative: boolean | null;
	readonly cumulativeImported: boolean | null;
	readonly cumulativeExported: boolean | null;
	readonly usageConstant: number | null;
	readonly usageOff: number | null;
}

/**
 * Transport-neutral Homey device. Only plain, serializable values may cross
 * the connector boundary.
 */
export interface HomeyDevice {
	readonly id: string;
	readonly name: string;
	readonly class: string;
	readonly zoneId: string | null;
	readonly zoneName: string | null;
	readonly zonePath: readonly string[];
	readonly available: boolean;
	readonly availabilityMessage: string | null;
	readonly driverId: string | null;
	readonly manufacturer: string | null;
	readonly model: string | null;
	readonly energy: HomeyDeviceEnergy | null;
	readonly capabilities: readonly HomeyCapability[];
}
