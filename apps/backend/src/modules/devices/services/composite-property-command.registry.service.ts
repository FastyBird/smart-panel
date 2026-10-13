import { Injectable } from '@nestjs/common';

import { ChannelPropertyEntity } from '../entities/devices.entity';
import { IDevicePropertyData } from '../platforms/device.platform';

export type CompositeChildStatus = 'accepted' | 'confirmed' | 'failed' | 'unavailable' | 'superseded' | 'timed_out';
export interface CompositeChildOutcome {
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
	readonly memberId: string;
	readonly update: IDevicePropertyData | null;
	readonly reason?: string;
}
export interface CompositeCommandPlan {
	readonly revision: number;
	readonly children: readonly CompositeCommandChild[];
	/** Checks the durable binding revision; dispatch and convergence both fence remaps. */
	readonly isCurrent: () => Promise<boolean>;
}
export interface CompositePropertyCommandPlanner {
	canHandle(property: ChannelPropertyEntity): boolean;
	plan(updates: readonly IDevicePropertyData[]): Promise<CompositeCommandPlan>;
}

/** Registration is internal. Public command DTOs cannot opt an arbitrary derived property into writes. */
@Injectable()
export class CompositePropertyCommandRegistryService {
	private readonly planners = new Set<CompositePropertyCommandPlanner>();
	register(planner: CompositePropertyCommandPlanner): () => void {
		this.planners.add(planner);
		return () => this.planners.delete(planner);
	}
	get(property: ChannelPropertyEntity | undefined): CompositePropertyCommandPlanner | null {
		if (!property) return null;
		return [...this.planners].find((planner) => planner.canHandle(property)) ?? null;
	}
}
