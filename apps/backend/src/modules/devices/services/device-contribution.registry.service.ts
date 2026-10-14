import { Injectable } from '@nestjs/common';

import { PropertyCategory } from '../devices.constants';
import { ChannelEntity } from '../entities/devices.entity';

export interface DeviceContributionCoverage {
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
		properties: readonly { category: PropertyCategory; value: boolean | number | null; contributors: number }[];
	};
}
export interface DeviceContributionProvider {
	getCoverage(channel: ChannelEntity): Promise<DeviceContributionCoverage | null>;
}

/** Internal producer registration; room policy remains explicit in the room domain. */
@Injectable()
export class DeviceContributionRegistryService {
	private readonly providers = new Set<DeviceContributionProvider>();

	register(provider: DeviceContributionProvider): () => void {
		this.providers.add(provider);
		return () => this.providers.delete(provider);
	}

	async getCoverage(channel: ChannelEntity): Promise<DeviceContributionCoverage | null> {
		for (const provider of this.providers) {
			const coverage = await provider.getCoverage(channel);
			if (coverage) return coverage;
		}
		return null;
	}
}
