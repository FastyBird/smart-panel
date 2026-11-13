import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { ACTIVITY_STATE_CHANGED } from '../activity/space-activity.constants';
import { SPACE_OCCUPANCY_CHANGED } from '../occupancy/space-occupancy.types';
import { SPACES_HOME_CONTROL_PLUGIN_NAME } from '../spaces-home-control.constants';

import { describeError } from './space-cards.utils';

type Hint = () => void;

const spaceIdOf = (payload: unknown): string | null => {
	const value = typeof payload === 'object' && payload !== null ? (payload as { space_id?: unknown }).space_id : null;

	return typeof value === 'string' && value !== '' ? value : null;
};

/**
 * The hints the space cards start on: the occupancy of a space, or its activity selection, may have changed.
 * A thin adapter (ADR 0003, decision 15), like the event source of the automations module.
 *
 * It holds exactly one listener per bus event, whatever the number of armed triggers, and hands each hint to
 * the triggers watching that space. Neither event carries the state: the cards read it, so a hint that was
 * not a change - a configuration save, the second event of an activation - starts nothing. A listener that
 * throws is logged and the others are still called; nothing is thrown back into the bus.
 */
@Injectable()
export class SpaceAutomationEventsService implements OnModuleDestroy {
	private readonly logger = createExtensionLogger(SPACES_HOME_CONTROL_PLUGIN_NAME, 'SpaceAutomationEventsService');

	private readonly occupancyListeners = new Map<string, Set<Hint>>();
	private readonly modeListeners = new Map<string, Set<Hint>>();

	onModuleDestroy(): void {
		this.occupancyListeners.clear();
		this.modeListeners.clear();
	}

	/** Calls `listener` whenever the occupancy of the space, or its occupancy configuration, may have changed */
	onOccupancyChanged(spaceId: string, listener: Hint): () => void {
		return this.add(this.occupancyListeners, spaceId, listener);
	}

	/** Calls `listener` whenever the activity selection of the space may have changed */
	onModeChanged(spaceId: string, listener: Hint): () => void {
		return this.add(this.modeListeners, spaceId, listener);
	}

	/** Number of triggers being served, over both events */
	subscriptionCount(): number {
		let count = 0;

		for (const listeners of [...this.occupancyListeners.values(), ...this.modeListeners.values()]) {
			count += listeners.size;
		}

		return count;
	}

	@OnEvent(SPACE_OCCUPANCY_CHANGED)
	handleOccupancyChanged(payload: unknown): void {
		this.notify(this.occupancyListeners, spaceIdOf(payload), 'occupancy');
	}

	@OnEvent(ACTIVITY_STATE_CHANGED)
	handleActivityStateChanged(payload: unknown): void {
		this.notify(this.modeListeners, spaceIdOf(payload), 'activity mode');
	}

	private add(registry: Map<string, Set<Hint>>, spaceId: string, listener: Hint): () => void {
		let listeners = registry.get(spaceId);

		if (!listeners) {
			listeners = new Set();
			registry.set(spaceId, listeners);
		}

		const current = listeners;
		// A listener of its own, so a trigger subscribed twice is also released twice
		const entry: Hint = () => listener();

		current.add(entry);

		let released = false;

		return () => {
			if (released) return;

			released = true;
			current.delete(entry);

			if (current.size === 0 && registry.get(spaceId) === current) registry.delete(spaceId);
		};
	}

	private notify(registry: Map<string, Set<Hint>>, spaceId: string | null, what: string): void {
		if (spaceId === null) return;

		for (const listener of [...(registry.get(spaceId) ?? [])]) {
			try {
				listener();
			} catch (error) {
				this.logger.warn(
					`An automation trigger failed on a ${what} change of space id=${spaceId}: ${describeError(error)}`,
				);
			}
		}
	}
}
