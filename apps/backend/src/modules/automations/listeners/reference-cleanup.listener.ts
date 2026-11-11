import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { EventType as DevicesEventType } from '../../devices/devices.constants';
import { EventType as ScenesEventType } from '../../scenes/scenes.constants';
import { EventType as SpacesEventType } from '../../spaces/spaces.constants';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import { AutomationNodeReferenceKind } from '../graph/node-type';
import { AutomationEngineService } from '../services/automation-engine.service';

interface WithId {
	id?: unknown;
}

interface DeletedChannel extends WithId {
	properties?: unknown;
}

interface DeletedDevice extends WithId {
	channels?: unknown;
}

const idOf = (value: unknown): string | undefined => {
	const id = typeof value === 'object' && value !== null ? (value as WithId).id : value;

	return typeof id === 'string' && id !== '' ? id : undefined;
};

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? (value as unknown[]) : []);

/**
 * Marks automations `invalid` when something a node of theirs refers to is removed (design § Engine
 * behaviour): a device, a channel, a property, a scene or a space. An automation that refers to an
 * automation that was deleted is handled by the engine service itself.
 *
 * A deleted device takes its channels and properties with it, and a deleted channel its properties, so a
 * node that names only the property is found as well.
 */
@Injectable()
export class ReferenceCleanupListener {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'ReferenceCleanupListener');

	constructor(private readonly engine: AutomationEngineService) {}

	@OnEvent(DevicesEventType.DEVICE_DELETED)
	handleDeviceDeleted(device: DeletedDevice | null): void {
		const removed = new Map<AutomationNodeReferenceKind, Set<string>>();

		this.collect(removed, 'device', device);

		for (const channel of asList(device?.channels)) {
			this.collectChannel(removed, channel);
		}

		this.invalidate(removed);
	}

	@OnEvent(DevicesEventType.CHANNEL_DELETED)
	handleChannelDeleted(channel: DeletedChannel | null): void {
		const removed = new Map<AutomationNodeReferenceKind, Set<string>>();

		this.collectChannel(removed, channel);
		this.invalidate(removed);
	}

	@OnEvent(DevicesEventType.CHANNEL_PROPERTY_DELETED)
	handlePropertyDeleted(property: WithId | null): void {
		const removed = new Map<AutomationNodeReferenceKind, Set<string>>();

		this.collect(removed, 'property', property);
		this.invalidate(removed);
	}

	@OnEvent(DevicesEventType.MODULE_RESET)
	handleDevicesReset(): void {
		this.invalidateKinds(['device', 'channel', 'property']);
	}

	@OnEvent(ScenesEventType.SCENE_DELETED)
	handleSceneDeleted(scene: WithId | null): void {
		const removed = new Map<AutomationNodeReferenceKind, Set<string>>();

		this.collect(removed, 'scene', scene);
		this.invalidate(removed);
	}

	@OnEvent(ScenesEventType.MODULE_RESET)
	handleScenesReset(): void {
		this.invalidateKinds(['scene']);
	}

	@OnEvent(SpacesEventType.SPACE_DELETED)
	handleSpaceDeleted(space: WithId | null): void {
		const removed = new Map<AutomationNodeReferenceKind, Set<string>>();

		this.collect(removed, 'space', space);
		this.invalidate(removed);
	}

	private collectChannel(removed: Map<AutomationNodeReferenceKind, Set<string>>, channel: unknown): void {
		this.collect(removed, 'channel', channel);

		const properties =
			typeof channel === 'object' && channel !== null ? (channel as DeletedChannel).properties : undefined;

		for (const property of asList(properties)) {
			this.collect(removed, 'property', property);
		}
	}

	private collect(
		removed: Map<AutomationNodeReferenceKind, Set<string>>,
		kind: AutomationNodeReferenceKind,
		value: unknown,
	): void {
		const id = idOf(value);

		if (id === undefined) return;

		const ids = removed.get(kind) ?? new Set<string>();

		ids.add(id);
		removed.set(kind, ids);
	}

	private invalidate(removed: Map<AutomationNodeReferenceKind, Set<string>>): void {
		if (removed.size === 0) return;

		this.run(
			this.engine.invalidateReferences((reference) => removed.get(reference.kind)?.has(reference.id) === true),
			[...removed.keys()],
		);
	}

	private invalidateKinds(kinds: AutomationNodeReferenceKind[]): void {
		this.run(
			this.engine.invalidateReferences((reference) => kinds.includes(reference.kind)),
			kinds,
		);
	}

	/** The bus is synchronous: nothing may be thrown back into the service that emitted the event */
	private run(work: Promise<string[]>, kinds: AutomationNodeReferenceKind[]): void {
		work
			.then((ids) => {
				if (ids.length > 0) {
					this.logger.warn(
						`[INVALIDATE] ${ids.length} automation(s) were marked invalid: a ${kinds.join(' / ')} they refer to was removed`,
					);
				}
			})
			.catch((error: unknown) => {
				this.logger.warn(
					`[INVALIDATE] Failed to invalidate automations: ${error instanceof Error ? error.message : 'unknown error'}`,
				);
			});
	}
}
