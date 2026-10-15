import { Injectable } from '@nestjs/common';

import { ChannelEntity, ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { CompositeCommandOutcomeModel } from '../../../modules/devices/models/composite-command.model';
import { IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import {
	COMPOSITE_INTENT_FINISH_MARGIN_MS,
	PropertyCommandDispatchOptions,
	PropertyCommandDispatchResult,
	PropertyCommandDispatchService,
} from '../../../modules/devices/services/property-command-dispatch.service';
import { PropertyCommandEntrySnapshot } from '../../../modules/devices/services/property-command-entry-snapshot';
import { PropertyCommandService } from '../../../modules/devices/services/property-command.service';
import { IntentTargetStatus } from '../../../modules/intents/intents.constants';
import { IntentRecord, IntentTargetResult } from '../../../modules/intents/models/intent.model';
import { CoversIntentDto } from '../dto/covers-intent.dto';
import { CoversIntentType, CoversRole } from '../spaces-home-control.constants';

import type { CoversIntentResult } from './covers-intent.service';
import { LightingContributionPlannerService } from './lighting-contribution-planner.service';
import type { CoverDevice } from './space-covers-state.service';

export interface CoverGroupExecution {
	remaining: CoverDevice[];
	result: CoversIntentResult;
	results: IntentTargetResult[];
}
export interface CoverGroupPlan {
	remaining: CoverDevice[];
	ordinaryOptions?: PropertyCommandDispatchOptions;
	run: () => Promise<CoverGroupExecution>;
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
		const plan = await this.prepare(covers, intent, record, entry);
		return plan ? plan.run() : null;
	}
	async prepare(
		covers: CoverDevice[],
		intent: CoversIntentDto,
		record: IntentRecord,
		entry?: PropertyCommandEntrySnapshot,
	): Promise<CoverGroupPlan | null> {
		const targeted =
			intent.type === CoversIntentType.ROLE_POSITION
				? covers.filter((cover) => cover.role === (intent.role ?? CoversRole.PRIMARY))
				: covers;
		if (!covers.some((cover) => this.isGroup(cover))) return null;
		const targetIds = new Set(targeted.map((cover) => cover.coverChannel.id));
		const results: IntentTargetResult[] = [];
		const refuse = (cover: CoverDevice, error: string) =>
			results.push({
				deviceId: cover.device.id,
				channelId: cover.coverChannel.id,
				status: IntentTargetStatus.FAILED,
				error,
			});
		const refused = (reason: string): CoverGroupPlan => {
			for (const cover of targeted) refuse(cover, reason);
			return {
				remaining: [],
				run: () =>
					Promise.resolve({
						remaining: [],
						results,
						result: { success: false, affectedDevices: 0, failedDevices: results.length, newPosition: null },
					}),
			};
		};
		// These operations have no group semantics. Refuse the entire targeted request before any send.
		if ([CoversIntentType.POSITION_DELTA, CoversIntentType.SET_MODE].includes(intent.type))
			return refused('cover_group_control_unavailable_no_relative_or_mode_conversion');
		let selection: Awaited<ReturnType<LightingContributionPlannerService['plan']>>;
		try {
			selection = await this.contributions.plan(
				covers.map((cover) => ({ ...cover, channel: cover.coverChannel })),
				'covers',
				intent.type === CoversIntentType.ROLE_POSITION ? targetIds : undefined,
			);
		} catch (error) {
			return refused(error instanceof Error ? error.message : 'covers_contribution_conflict');
		}
		const handled = (selection.targets as (CoverDevice & { channel: CoverDevice['coverChannel'] })[]).filter(
			(cover) => targetIds.has(cover.coverChannel.id) && this.isGroup(cover),
		);
		if (!handled.length && !selection.excludedRawChannels.some((id) => targetIds.has(id))) return null;
		const selectedIds = new Set([...handled.map((cover) => cover.coverChannel.id), ...selection.excludedRawChannels]);
		const remaining = targeted.filter((cover) => !selectedIds.has(cover.coverChannel.id));
		const deadlineAt = record.expiresAt.getTime() - COMPOSITE_INTENT_FINISH_MARGIN_MS;
		const options: PropertyCommandDispatchOptions = {
			intentId: record.id,
			commandEntry: entry,
			deadlineAt,
			ttlMs: Math.max(1, Math.min(30_000, deadlineAt - Date.now())),
			isRequestCurrent: selection.isCurrent,
		};
		return {
			remaining,
			// The selection fence belongs to the group, not unrelated ordinary targets. Their captured
			// entry/leaf admission and absolute deadline remain enforced by the ordinary dispatcher.
			ordinaryOptions: {
				intentId: options.intentId,
				commandEntry: options.commandEntry,
				deadlineAt: options.deadlineAt,
			},
			run: () => this.executeSelected(targeted, handled, intent, selection, options, results),
		};
	}
	private async executeSelected(
		targeted: CoverDevice[],
		handled: CoverDevice[],
		intent: CoversIntentDto,
		selection: Awaited<ReturnType<LightingContributionPlannerService['plan']>>,
		options: PropertyCommandDispatchOptions,
		results: IntentTargetResult[],
	): Promise<CoverGroupExecution> {
		const refuse = (cover: CoverDevice, error: string) =>
			results.push({
				deviceId: cover.device.id,
				channelId: cover.coverChannel.id,
				status: IntentTargetStatus.FAILED,
				error,
			});
		for (const cover of targeted.filter((cover) => selection.excludedRawChannels.includes(cover.coverChannel.id))) {
			// Deduplication is a skip only when this request also targets its representative.
			// A raw-only role request cannot claim success or commandeer a group outside that role.
			if (
				!handled.some((group) => selection.coverage.get(group.coverChannel.id)?.leaves.includes(cover.coverChannel.id))
			) {
				refuse(cover, 'cover_group_representative_not_targeted');
				continue;
			}
			results.push({
				deviceId: cover.device.id,
				channelId: cover.coverChannel.id,
				status: IntentTargetStatus.SKIPPED,
				error: 'represented_by_cover_group',
			});
		}
		const simple = [CoversIntentType.OPEN, CoversIntentType.CLOSE, CoversIntentType.STOP].includes(intent.type);
		const updates: IDevicePropertyData[] = [];
		for (const cover of handled) {
			const command =
				intent.type === CoversIntentType.OPEN ? 'open' : intent.type === CoversIntentType.CLOSE ? 'close' : 'stop';
			if (simple && cover.commandProperty) updates.push(this.groupTarget(cover, cover.commandProperty, command));
			else if (
				[CoversIntentType.SET_POSITION, CoversIntentType.ROLE_POSITION].includes(intent.type) &&
				cover.positionProperty
			)
				updates.push(this.groupTarget(cover, cover.positionProperty, intent.position ?? 0));
			else if (
				simple &&
				intent.type !== CoversIntentType.STOP &&
				cover.positionProperty?.unit === '%' &&
				JSON.stringify(cover.positionProperty.format) === '[0,100]'
			)
				updates.push(this.groupTarget(cover, cover.positionProperty, intent.type === CoversIntentType.OPEN ? 100 : 0));
			else refuse(cover, 'cover_group_control_unavailable_no_relative_or_mode_conversion');
		}
		let response: PropertyCommandDispatchResult | null;
		try {
			response = updates.length ? await this.dispatch.dispatchBatch(updates, options) : null;
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
								children
									.filter((child) => child.status !== 'confirmed')
									.map((child) => child.reason ?? child.status)
									.join('; ') ||
								response?.reason ||
								'cover_command_unconfirmed',
						}),
			});
		}
		return {
			remaining: [],
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
	private groupTarget(
		cover: CoverDevice,
		property: ChannelPropertyEntity,
		value: IDevicePropertyData['value'],
	): IDevicePropertyData {
		// Room ORM listings load children without reverse relations. Attach their known parents to
		// detached entities so producer routing works; core still revalidates current canonical metadata.
		const channel = Object.assign(
			Object.create(Object.getPrototypeOf(cover.coverChannel) as object) as ChannelEntity,
			cover.coverChannel,
			{ device: cover.device },
		);
		const target = Object.assign(
			Object.create(Object.getPrototypeOf(property) as object) as ChannelPropertyEntity,
			property,
			{
				channel,
			},
		);
		return { device: cover.device, channel, property: target, value };
	}
}
