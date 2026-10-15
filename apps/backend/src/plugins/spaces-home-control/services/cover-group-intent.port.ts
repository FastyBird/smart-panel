import { Injectable } from '@nestjs/common';

import { CompositeCommandOutcomeModel } from '../../../modules/devices/models/composite-command.model';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import {
	COMPOSITE_INTENT_FINISH_MARGIN_MS,
	PropertyCommandDispatchResult,
	PropertyCommandDispatchService,
} from '../../../modules/devices/services/property-command-dispatch.service';
import { PropertyCommandEntrySnapshot } from '../../../modules/devices/services/property-command-entry-snapshot';
import { PropertyCommandService } from '../../../modules/devices/services/property-command.service';
import { IntentTargetStatus } from '../../../modules/intents/intents.constants';
import { IntentRecord, IntentTargetResult } from '../../../modules/intents/models/intent.model';
import { CoversIntentDto } from '../dto/covers-intent.dto';
import { CoversIntentType } from '../spaces-home-control.constants';

import type { CoversIntentResult } from './covers-intent.service';
import { LightingContributionPlannerService } from './lighting-contribution-planner.service';
import type { CoverDevice } from './space-covers-state.service';

export interface CoverGroupExecution {
	remaining: CoverDevice[];
	result: CoversIntentResult;
	results: IntentTargetResult[];
}
/** Existing covers-domain port to core composite admission, never a provider command loop. */
@Injectable()
export class CoverGroupIntentPort {
	constructor(
		private readonly commands: PropertyCommandService,
		private readonly dispatch: PropertyCommandDispatchService,
		private readonly contributions: LightingContributionPlannerService,
	) {}
	isGroup(cover: CoverDevice): boolean {
		return cover.device.type === 'virtual' && Reflect.get(cover.device, 'mode') === 'actuator_group';
	}
	capture(): PropertyCommandEntrySnapshot | undefined {
		return this.commands.captureCommandEntry();
	}
	release(entry?: PropertyCommandEntrySnapshot): void {
		this.commands.releaseCommandEntry(entry);
	}
	async execute(
		covers: CoverDevice[],
		intent: CoversIntentDto,
		record: IntentRecord,
		entry?: PropertyCommandEntrySnapshot,
	): Promise<CoverGroupExecution | null> {
		const targeted =
			intent.type === CoversIntentType.ROLE_POSITION ? covers.filter((cover) => cover.role === intent.role) : covers;
		if (!targeted.some((cover) => this.isGroup(cover))) return null;
		const results: IntentTargetResult[] = [];
		const refuse = (cover: CoverDevice, error: string) =>
			results.push({
				deviceId: cover.device.id,
				channelId: cover.coverChannel.id,
				status: IntentTargetStatus.FAILED,
				error,
			});
		let selection: Awaited<ReturnType<LightingContributionPlannerService['plan']>>;
		try {
			selection = await this.contributions.plan(
				targeted.map((cover) => ({ ...cover, channel: cover.coverChannel })),
				'covers',
			);
		} catch (error) {
			for (const cover of targeted)
				refuse(cover, error instanceof Error ? error.message : 'covers_contribution_conflict');
			return {
				remaining: [],
				results,
				result: { success: false, affectedDevices: 0, failedDevices: results.length, newPosition: null },
			};
		}
		for (const cover of targeted.filter((cover) => selection.excludedRawChannels.includes(cover.coverChannel.id)))
			results.push({
				deviceId: cover.device.id,
				channelId: cover.coverChannel.id,
				status: IntentTargetStatus.SKIPPED,
				error: 'represented_by_cover_group',
			});
		const simple = [CoversIntentType.OPEN, CoversIntentType.CLOSE, CoversIntentType.STOP].includes(intent.type);
		const selected = selection.targets as (CoverDevice & { channel: CoverDevice['coverChannel'] })[];
		const handled = selected.filter(
			(cover) => simple || this.isGroup(cover) || intent.type === CoversIntentType.SET_MODE,
		);
		const updates: IDevicePropertyData[] = [];
		for (const cover of handled) {
			const command =
				intent.type === CoversIntentType.OPEN ? 'open' : intent.type === CoversIntentType.CLOSE ? 'close' : 'stop';
			if (simple && cover.commandProperty)
				updates.push({
					device: cover.device,
					channel: cover.coverChannel,
					property: cover.commandProperty,
					value: command,
				});
			else if (
				[CoversIntentType.SET_POSITION, CoversIntentType.ROLE_POSITION].includes(intent.type) &&
				cover.positionProperty
			)
				updates.push({
					device: cover.device,
					channel: cover.coverChannel,
					property: cover.positionProperty,
					value: intent.position ?? 0,
				});
			else if (
				simple &&
				intent.type !== CoversIntentType.STOP &&
				cover.positionProperty?.unit === '%' &&
				JSON.stringify(cover.positionProperty.format) === '[0,100]'
			)
				updates.push({
					device: cover.device,
					channel: cover.coverChannel,
					property: cover.positionProperty,
					value: intent.type === CoversIntentType.OPEN ? 100 : 0,
				});
			else refuse(cover, 'cover_group_control_unavailable_no_relative_or_mode_conversion');
		}
		const deadlineAt = record.expiresAt.getTime() - COMPOSITE_INTENT_FINISH_MARGIN_MS;
		let response: PropertyCommandDispatchResult | null;
		try {
			response = updates.length
				? await this.dispatch.dispatchBatch(updates, {
						intentId: record.id,
						commandEntry: entry,
						deadlineAt,
						ttlMs: Math.max(1, Math.min(30_000, deadlineAt - Date.now())),
						isRequestCurrent: selection.isCurrent,
					})
				: null;
		} catch (error) {
			response = { success: false, reason: error instanceof Error ? error.message : 'cover_command_unconfirmed' };
		}
		const composites: CompositeCommandOutcomeModel[] = response?.composite ? [response.composite] : [];
		for (const update of updates) {
			const coverage = selection.coverage.get(update.channel.id);
			const children =
				response?.composite?.children.filter((child) =>
					coverage ? coverage.leaves.includes(child.memberIdentity ?? '') : child.propertyId === update.property.id,
				) ?? [];
			const success = children.length
				? children.every((child) => child.status === 'confirmed')
				: response?.success === true;
			results.push({
				deviceId: update.device.id,
				channelId: update.channel.id,
				status: success ? IntentTargetStatus.SUCCESS : IntentTargetStatus.FAILED,
				...(success
					? {}
					: {
							error:
								children.map((child) => child.reason ?? child.status).join('; ') ||
								response?.reason ||
								'cover_command_unconfirmed',
						}),
			});
		}
		const selectedIds = new Set([...handled.map((cover) => cover.coverChannel.id), ...selection.excludedRawChannels]);
		return {
			remaining: covers.filter((cover) => !selectedIds.has(cover.coverChannel.id)),
			results,
			result: {
				success: results.every((result) => result.status !== IntentTargetStatus.FAILED),
				affectedDevices: results.filter((result) => result.status === IntentTargetStatus.SUCCESS).length,
				failedDevices: results.filter((result) => result.status === IntentTargetStatus.FAILED).length,
				newPosition: null,
				...(composites.length ? { composites } : {}),
			},
		};
	}
}
