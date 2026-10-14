import { Injectable, Optional } from '@nestjs/common';

import { DEFAULT_TTL_DEVICE_COMMAND } from '../../intents/intents.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import { IDevicePropertyData } from '../platforms/device.platform';

import { PlatformRegistryService } from './platform.registry.service';
import { PropertyCommandEntrySnapshot } from './property-command-entry-snapshot';

export type CompositeChildStatus = 'accepted' | 'confirmed' | 'failed' | 'unavailable' | 'superseded' | 'timed_out';
export interface CompositeChildOutcome {
	memberIdentity?: string;
	propertyIdentity?: string | null;
	value?: string | number | boolean;
	memberId: string;
	propertyId: string | null;
	status: CompositeChildStatus;
	reason?: string;
	generation?: string;
}
export interface CompositeCommandOutcome {
	id: string;
	status: 'confirmed' | 'partial' | 'failed';
	children: CompositeChildOutcome[];
}
export interface CompositeCommandChild {
	readonly memberIdentity?: string;
	readonly propertyIdentity?: string | null;
	readonly memberId: string;
	readonly update: IDevicePropertyData | null;
	readonly reason?: string;
	/** Internal synchronous snapshot consumption immediately before the physical window opens. */
	readonly admissionCheck?: () => boolean;
}
export interface CompositeCommandPlan {
	readonly revision: number;
	readonly children: readonly CompositeCommandChild[];
	/** Checks the durable binding revision; dispatch and convergence both fence remaps. */
	readonly isCurrent: () => Promise<boolean>;
	/** Pure applied-revision guard for a provider queue at its actual publish boundary. */
	readonly isDispatchCurrent?: () => boolean;
	/** Release temporary planning observers on terminal/early failure. */
	readonly dispose?: () => void;
}
export interface CompositePropertyCommandPlanner {
	canHandle(property: ChannelPropertyEntity): boolean;
	plan(updates: readonly IDevicePropertyData[], entry?: PropertyCommandEntrySnapshot): Promise<CompositeCommandPlan>;
}

/** Registration is internal. Public command DTOs cannot opt an arbitrary derived property into writes. */
@Injectable()
export class CompositePropertyCommandRegistryService {
	private readonly planners = new Set<CompositePropertyCommandPlanner>();
	constructor(@Optional() private readonly platforms?: PlatformRegistryService) {}
	register(planner: CompositePropertyCommandPlanner): () => void {
		this.planners.add(planner);
		return () => this.planners.delete(planner);
	}
	/** Budget hint only. Actual dispatch revalidates the complete intended plan under core admission. */
	async estimateTimeoutMs(
		updates: readonly IDevicePropertyData[],
		entry?: PropertyCommandEntrySnapshot,
	): Promise<number | null> {
		const planner = updates.map((update) => this.get(update.property)).find(Boolean);
		if (!planner) return null;
		const plan = await planner.plan(
			updates.filter((update) => planner.canHandle(update.property)),
			entry,
		);
		plan.dispose?.();
		const channels = new Map<string, { device: IDevicePropertyData['device']; properties: Set<string> }>();
		for (const child of [
			...plan.children,
			...updates.filter((update) => !planner.canHandle(update.property)).map((update) => ({ update })),
		]) {
			if (!child.update) continue;
			const key = `${child.update.device.id}:${child.update.channel.id}`;
			const channel = channels.get(key) ?? { device: child.update.device, properties: new Set<string>() };
			channel.properties.add(child.update.property.id);
			channels.set(key, channel);
		}
		const budgets = [...channels.values()].map(
			(channel) =>
				this.platforms?.getCommandTtlMs(
					[{ device: channel.device, commandCount: channel.properties.size }],
					DEFAULT_TTL_DEVICE_COMMAND,
				) ?? DEFAULT_TTL_DEVICE_COMMAND,
		);
		const largest = Math.max(DEFAULT_TTL_DEVICE_COMMAND, ...budgets);
		return Math.min(
			30_000,
			Math.max(DEFAULT_TTL_DEVICE_COMMAND, Math.ceil(channels.size / 8) * largest + DEFAULT_TTL_DEVICE_COMMAND),
		);
	}

	hasPlanners(): boolean {
		return this.planners.size > 0;
	}
	get(property: ChannelPropertyEntity | undefined): CompositePropertyCommandPlanner | null {
		if (!property) return null;
		return [...this.planners].find((planner) => planner.canHandle(property)) ?? null;
	}
}
