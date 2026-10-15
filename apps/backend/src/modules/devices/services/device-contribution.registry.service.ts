import { Injectable } from '@nestjs/common';

import { PropertyCategory } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../entities/devices.entity';

export interface DeviceContributionCoverage {
	operations?: readonly { operation: string; commandable: boolean; reasons: readonly string[] }[];
	/** Stable intended physical channel identities, including missing members. */
	leaves: readonly string[];
	/** Fences membership and source metadata through queued physical I/O. */
	isCurrent?: () => boolean;
	revision?: number;
	reported: {
		total: number;
		on: number;
		unknown: number;
		mixed: boolean;
		mixedProperties: readonly PropertyCategory[];
		onBrightness?: { sum: number; count: number };
		properties: readonly {
			category: PropertyCategory;
			value: string | boolean | number | null;
			contributors: number;
			expiresAt?: number;
		}[];
	};
}
export interface DeviceContributionProvider {
	getCoverage(channel: ChannelEntity): Promise<DeviceContributionCoverage | null>;
}

/** Measurement identities are property ids; actuator coverage above uses channel ids. */
export interface MeasurementContributionCoverage {
	/** Intended physical property identities, retained even when a source disappears. */
	leaves: readonly string[];
	/** Upstream output identities represented by this measurement (including transforms). */
	representedProperties: readonly string[];
	duplicateLeaves?: readonly string[];
	isCurrent: () => boolean;
	readValue: () => number | null;
}
export interface MeasurementContributionProvider {
	getMeasurementCoverage(property: ChannelPropertyEntity): Promise<MeasurementContributionCoverage | null>;
}

/** Internal producer registration; room policy remains explicit in the room domain. */
@Injectable()
export class DeviceContributionRegistryService {
	private readonly measurementProviders = new Set<MeasurementContributionProvider>();

	private readonly providers = new Set<DeviceContributionProvider>();

	register(provider: DeviceContributionProvider): () => void {
		this.providers.add(provider);
		return () => this.providers.delete(provider);
	}

	registerMeasurement(provider: MeasurementContributionProvider): () => void {
		this.measurementProviders.add(provider);
		return () => this.measurementProviders.delete(provider);
	}

	async getMeasurementCoverage(property: ChannelPropertyEntity): Promise<MeasurementContributionCoverage | null> {
		for (const provider of this.measurementProviders) {
			const coverage = await provider.getMeasurementCoverage(property);
			if (coverage) return coverage;
		}
		return null;
	}

	async getCoverage(channel: ChannelEntity): Promise<DeviceContributionCoverage | null> {
		for (const provider of this.providers) {
			const coverage = await provider.getCoverage(channel);
			if (coverage) return coverage;
		}
		return null;
	}
}
