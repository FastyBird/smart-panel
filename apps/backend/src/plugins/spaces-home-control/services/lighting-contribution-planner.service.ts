import { ConflictException, Injectable } from '@nestjs/common';

import { ChannelEntity } from '../../../modules/devices/entities/devices.entity';
import {
	DeviceContributionCoverage,
	DeviceContributionRegistryService,
} from '../../../modules/devices/services/device-contribution.registry.service';

export interface LightingContributionTarget {
	channel: ChannelEntity;
}
export interface LightingContributionPlan<T> {
	targets: T[];
	coverage: Map<string, DeviceContributionCoverage>;
	excludedRawChannels: string[];
	isCurrent: () => boolean;
}

/** Both room commands and presentation must consume this same leaf coverage selection. */
@Injectable()
export class LightingContributionPlannerService {
	constructor(private readonly registry: DeviceContributionRegistryService) {}

	async plan<T extends LightingContributionTarget>(
		targets: readonly T[],
		domain: 'lighting' | 'covers' = 'lighting',
	): Promise<LightingContributionPlan<T>> {
		const coverage = new Map<string, DeviceContributionCoverage>();
		const owners = new Map<string, string>();
		for (const target of targets) {
			const composite = await this.registry.getCoverage(target.channel);
			if (!composite) continue;
			coverage.set(target.channel.id, composite);
			for (const leaf of new Set(composite.leaves)) {
				const previous = owners.get(leaf);
				if (previous && previous !== target.channel.id)
					throw new ConflictException({
						message:
							domain === 'lighting'
								? 'Overlapping light groups require selecting one room representative or changing participation roles'
								: 'Overlapping cover groups require repairing membership or room participation',
						code: `${domain}_contribution_conflict`,
						leaf,
						channels: [previous, target.channel.id],
					});
				owners.set(leaf, target.channel.id);
			}
		}
		const excludedRawChannels: string[] = [];
		const selected = targets.filter((target) => {
			if (coverage.has(target.channel.id) || !owners.has(target.channel.id)) return true;
			excludedRawChannels.push(target.channel.id);
			return false;
		});
		return {
			targets: selected,
			coverage,
			excludedRawChannels,
			isCurrent: () => [...coverage.values()].every((entry) => entry.isCurrent?.() ?? true),
		};
	}
}
