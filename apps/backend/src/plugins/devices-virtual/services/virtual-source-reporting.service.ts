import { DataSource } from 'typeorm';

import { Injectable } from '@nestjs/common';

import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { VirtualSourceReportingModel } from '../models/source-reporting-response.model';

import { recommendedMaximumAgeSeconds } from './virtual-source-reporting.utils';

/**
 * How often a candidate source of a virtual device reports, so the admin can suggest a maximum sample age that
 * suits it (battery radio sensors often report only every 30-60 min). Guidance only: it never qualifies a binding.
 */
@Injectable()
export class VirtualSourceReportingService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly values: PropertyValueService,
	) {}

	async sourceReporting(id: string): Promise<VirtualSourceReportingModel | null> {
		const property = await this.dataSource.manager.findOne(ChannelPropertyEntity, {
			where: { id },
			relations: ['channel', 'channel.device'],
		});
		const channel = property?.channel;
		if (!channel || typeof channel === 'string' || typeof channel.device === 'string' || !channel.device) return null;
		const derived = channel.device.type === 'virtual';
		const profile = derived ? null : this.values.readReportingProfile(property);
		const toSeconds = (ms: number): number => Math.round(ms / 1000);
		return {
			property: property.id,
			source_kind: derived ? 'derived' : 'physical',
			reports: profile?.reports ?? 0,
			typical_interval_seconds: profile ? toSeconds(profile.typicalIntervalMs) : null,
			longest_interval_seconds: profile ? toSeconds(profile.longestIntervalMs) : null,
			last_report_at: profile?.lastReportAt.toISOString() ?? null,
			recommended_maximum_age_seconds: profile ? recommendedMaximumAgeSeconds(profile.longestIntervalMs) : null,
		};
	}
}
