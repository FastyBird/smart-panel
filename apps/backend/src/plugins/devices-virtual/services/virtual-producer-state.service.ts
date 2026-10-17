import { DataSource } from 'typeorm';

import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { getEnvValue } from '../../../common/utils/config.utils';
import { EventType } from '../../../modules/devices/devices.constants';
import {
	ObservedProducerBatch, OwnedProducerEngine, OwnedProducerOperation, OwnedProducerPublisher, OwnedPublicationReport,
	PropertyProducerRegistryService, ownedProducerMethodCurrent,
} from '../../../modules/devices/services/property-producer.registry.service';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { VirtualAggregateConfigEntity, VirtualLightGroupConfigEntity } from '../entities/virtual-producer.entity';
import { VirtualTransformConfigEntity } from '../entities/virtual-transform.entity';

import {
	OwnedGraphLifecycle, OwnedGraphRegistration, OwnedGraphStage, OwnedGraphStagerV1, OwnedGraphStageView,
	VirtualDependencyGraphService,
} from './virtual-dependency-graph.service';

/** Owns unavailable overlays only. A fresh runtime, never retained history, must establish a good publication. */
@Injectable()
export class VirtualProducerStateService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(VirtualProducerStateService.name);
	private readonly engine: OwnedProducerEngine;
	private readonly capability: OwnedGraphStagerV1;
	private readonly captureLifecycle: VirtualDependencyGraphService['captureOwnedPublicationLifecycle'];
	private readonly registerStager: VirtualDependencyGraphService['observeOwnedStaging'];
	private readonly disposeStager: VirtualDependencyGraphService['disposeOwnedStaging'];
	private owner?: OwnedProducerPublisher;
	private registration?: OwnedGraphRegistration;
	private initializing?: Promise<void>;
	private destroyed = false;
	private mutation = Object.freeze({});

	constructor(
		private readonly dataSource: DataSource,
		private readonly producers: PropertyProducerRegistryService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly events: EventEmitter2,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
	) {
		this.engine = producers.captureOwnedEngine();
		const self: Readonly<{ stageOwned: (view: OwnedGraphStageView, lifecycle: OwnedGraphLifecycle) => Promise<OwnedGraphStage> }> = this;
		const methods: Readonly<{
			captureOwnedPublicationLifecycle: () => OwnedGraphLifecycle;
			observeOwnedStaging: (...args: Parameters<VirtualDependencyGraphService['observeOwnedStaging']>) => ReturnType<VirtualDependencyGraphService['observeOwnedStaging']>;
			disposeOwnedStaging: (...args: Parameters<VirtualDependencyGraphService['disposeOwnedStaging']>) => void;
		}> = graph;
		this.capability = Object.freeze({ version: 1, stage: self.stageOwned });
		this.captureLifecycle = methods.captureOwnedPublicationLifecycle;
		this.registerStager = methods.observeOwnedStaging;
		this.disposeStager = methods.disposeOwnedStaging;
	}

	onModuleInit(): Promise<void> {
		if (this.cli()) return Promise.resolve();
		if (this.destroyed) return Promise.reject(new Error('Owned producer unavailable'));
		if (this.initializing) return this.initializing;
		const owner = this.requireOwner();
		this.registration = this.registerStager.call(this.graph, this.producers, owner, this.capability, this, Object.freeze({ requiresActivation: false }));
		const originalMutation = this.mutation;
		const lifecycle = this.captureLifecycle.call(this.graph);
		this.initializing = this.initializeOwned(originalMutation, lifecycle).catch((error: unknown) => {
			this.onModuleDestroy();
			throw error;
		});
		return this.initializing;
	}

	private async initializeOwned(originalMutation: object, lifecycle: OwnedGraphLifecycle): Promise<void> {
		const view = await this.dataSource.transaction(async (manager): Promise<OwnedGraphStageView> => {
			const properties = await manager.createQueryBuilder(VirtualChannelPropertyEntity, 'property')
				.leftJoinAndSelect('property.channel', 'channel').leftJoinAndSelect('channel.device', 'device')
				.callListeners(false).getMany();
			const transforms = await manager.find(VirtualTransformConfigEntity);
			const aggregates = await manager.find(VirtualAggregateConfigEntity);
			const groups = await manager.find(VirtualLightGroupConfigEntity);
			const revisions = properties.filter((property) => property.isDerived).map((property) => {
				const channel = typeof property.channel === 'string' ? property.channel : property.channel?.id;
				return Object.freeze({ propertyId: property.id, revision: transforms.find((row) => row.outputPropertyId === property.id)?.revision ??
					aggregates.find((row) => row.outputPropertyId === property.id)?.revision ?? groups.find((row) => row.groupChannelId === channel)?.revision ?? 0 });
			});
			return Object.freeze({ revision: -1, properties: Object.freeze(properties), configurationRevisions: Object.freeze(revisions), quarantined: new Set<string>() });
		});
		if (!this.current() || originalMutation !== this.mutation || !lifecycle.isCurrent()) return;
		const stage = await this.stageOwned(view, lifecycle);
		try {
			if (!this.current() || originalMutation !== this.mutation || !lifecycle.isCurrent() || !this.engine.validatePreparedBatch.call(this.producers, stage.prepared)) return;
			if (!this.engine.installPreparedNoEvents.call(this.producers, stage.prepared)) return;
			this.notify(stage, lifecycle);
		} finally { this.engine.closeObservedBatch.call(this.producers, stage.batch); }
	}

	/** Fixed read-only planning port: all observations and returned payloads are owned before its Promise settles. */
	stageOwned(view: OwnedGraphStageView, lifecycle: OwnedGraphLifecycle): Promise<OwnedGraphStage> {
		return new Promise((resolve, reject) => {
			let batch: ObservedProducerBatch | undefined;
			try {
				const owner = this.requireExistingOwner();
				if (!lifecycle.isCurrent()) throw new Error('Owned producer superseded');
				const before = this.engine.readOwnedView.call(this.producers, owner);
				const properties = new Map(view.properties.map((property) => [property.id, property]));
				const hints = new Map(view.configurationRevisions.map((row) => [row.propertyId, row.revision]));
				const masks = new Map(before.quarantineLeases.map((row) => [row.propertyId, row.lease]));
				const kinds = new Map<string, 'retain' | 'unavailable' | 'fallback-unavailable' | 'replace-retired-unavailable' | 'retire-alias-mask' | 'retire-deleted-owned-overlay'>();
				const ownedIds = new Set(this.engine.ownedPropertyIds.call(this.producers, owner));
				const retiredIds = new Set(this.engine.retiredSameKeyPropertyIds.call(this.producers, owner));
				for (const id of ownedIds) {
					if (!properties.has(id)) kinds.set(id, 'retire-deleted-owned-overlay');
				}
				for (const [id, lease] of masks) {
					const property = properties.get(id);
					if (!this.engine.isCurrent.call(this.producers, lease)) kinds.set(id, 'retain');
					else if (property && !view.quarantined.has(id)) kinds.set(id, property.isDerived ? 'unavailable' : 'retire-alias-mask');
				}
				for (const property of view.properties) {
					if (view.quarantined.has(property.id)) kinds.set(property.id, 'unavailable');
					else if (property.isDerived && retiredIds.has(property.id)) kinds.set(property.id, 'replace-retired-unavailable');
					else if (property.isDerived && (ownedIds.has(property.id) || !this.engine.owns.call(this.producers, property.id))) kinds.set(property.id, 'fallback-unavailable');
				}
				batch = this.engine.beginObservedBatch.call(this.producers, owner, [...kinds.keys()], lifecycle.guard);
				if (this.engine.readOwnedView.call(this.producers, owner) !== before) throw new Error('Owned producer superseded');
				const currentOwnedIds = new Set(this.engine.ownedPropertyIds.call(this.producers, owner));
				for (const id of kinds.keys()) {
					if (ownedIds.has(id) && !currentOwnedIds.has(id)) throw new Error('Owned producer superseded');
				}
				const operations: OwnedProducerOperation[] = [];
				for (const [propertyId, kind] of kinds) {
					const expected = this.engine.captureExpectedSlot.call(this.producers, batch, propertyId);
					const property = properties.get(propertyId);
					if (kind === 'retain' || kind === 'retire-deleted-owned-overlay') operations.push({ kind, propertyId, expected });
					else if (!property) throw new Error('Missing owned producer property');
					else if (kind === 'retire-alias-mask') operations.push({ kind, propertyId, expected, property });
					else if (kind === 'replace-retired-unavailable' || kind === 'fallback-unavailable') operations.push({ kind, propertyId, expected, property, revision: hints.get(propertyId) ?? 0, reason: 'runtime_unavailable' });
					else operations.push({ kind, propertyId, expected, property, revision: hints.get(propertyId) ?? 0,
						reason: view.quarantined.has(propertyId) ? 'graph_quarantined' : 'runtime_unavailable' });
				}
				const prepared = this.engine.prepareOwnedBatch.call(this.producers, batch, {
					revision: view.revision, configurationRevisions: view.configurationRevisions, operations,
				});
				if (!this.current() || !lifecycle.isCurrent()) throw new Error('Owned producer superseded');
				resolve(Object.freeze({ batch, prepared }));
			} catch (error) {
				if (batch) this.engine.closeObservedBatch.call(this.producers, batch);
				reject(error);
			}
		});
	}

	/** Existing synchronous mapping/configuration entry. It admits ownership, not a new graph observer. */
	installUnavailable(property: VirtualChannelPropertyEntity, revision: number): void {
		this.installUnavailableOperation(property, revision, 'unavailable');
	}

	private installUnavailableOperation(property: VirtualChannelPropertyEntity, revision: number, kind: 'unavailable' | 'fallback-unavailable'): void {
		if (this.cli()) return;
		if (this.destroyed) throw new Error('Owned producer unavailable');
		if (!property.isDerived) return;
		const owner = this.requireOwner();
		const lifecycle = this.captureLifecycle.call(this.graph);
		this.mutation = Object.freeze({});
		const before = this.engine.readOwnedView.call(this.producers, owner);
		const hints = new Map(before.configurationRevisions.map((row) => [row.propertyId, row.revision]));
		hints.set(property.id, revision);
		const batch = this.engine.beginObservedBatch.call(this.producers, owner, [property.id], lifecycle.guard);
		try {
			const prepared = this.engine.prepareOwnedBatch.call(this.producers, batch, {
				revision: before.revision, configurationRevisions: [...hints].map(([propertyId, value]) => ({ propertyId, revision: value })),
				operations: [{ kind, propertyId: property.id, property, revision, reason: 'runtime_unavailable',
					expected: this.engine.captureExpectedSlot.call(this.producers, batch, property.id) }],
			});
			if (!this.current() || !lifecycle.isCurrent() || !this.engine.validatePreparedBatch.call(this.producers, prepared) ||
				!this.engine.installPreparedNoEvents.call(this.producers, prepared)) throw new Error('Owned producer superseded');
			this.notify({ batch, prepared }, lifecycle);
			if (this.current() && lifecycle.isCurrent() && this.engine.isInstalledBatchCurrent.call(this.producers, prepared))
				property.value = this.producers.read(property.id);
		} finally { this.engine.closeObservedBatch.call(this.producers, batch); }
	}

	private notify(stage: OwnedGraphStage, lifecycle: OwnedGraphLifecycle): void {
		try {
			const count = this.engine.ownedNotificationCount.call(this.producers, stage.prepared);
			for (let index = 0; index < count; index++) {
				if (!this.current() || !lifecycle.isCurrent() || this.engine.notifyInstalled.call(this.producers, stage.prepared, index) !== 'completed')
					throw new Error('Owned producer publication incomplete');
			}
			this.engine.finishPublication.call(this.producers, stage.prepared, 'complete');
		} catch {
			this.logger.error('Owned producer publication incomplete', this.engine.readInstalledReport.call(this.producers, stage.prepared));
			throw new Error('Owned producer publication incomplete');
		}
	}

	readPublicationReport(): OwnedPublicationReport | undefined {
		return this.registration ? this.graph.readOwnedPublicationReport(this.registration) : undefined;
	}

	onModuleDestroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.mutation = Object.freeze({});
		if (this.registration) this.disposeStager.call(this.graph, this.registration);
		if (this.owner) this.engine.disposeOwnedPublisher.call(this.producers, this.owner);
	}

	initializeOutput(property: VirtualChannelPropertyEntity): void {
		if (this.cli() || this.destroyed) return;
		if (!this.engine.isOwnedEngineCurrent.call(this.producers, this.engine)) throw new Error('Owned producer superseded');
		if (property.isDerived && !this.engine.owns.call(this.producers, property.id)) this.installUnavailableOperation(property, 0, 'fallback-unavailable');
		if (property.isDerived) property.value = this.producers.read(property.id);
	}

	@OnEvent(EventType.CHANNEL_PROPERTY_CREATED)
	@OnEvent(EventType.CHANNEL_PROPERTY_UPDATED)
	handlePropertyChanged(property: VirtualChannelPropertyEntity): void {
		if (property.type === 'virtual') this.initializeOutput(property);
	}

	@OnEvent(EventType.CHANNEL_PROPERTY_DELETED)
	handlePropertyDeleted(property: VirtualChannelPropertyEntity): void {
		// An ID-only event is not authority to delete a same-ID successor. Snapshot reconciliation owns retirement.
		if (!this.cli() && !this.destroyed && property.type === 'virtual') {
			if (!this.engine.isOwnedEngineCurrent.call(this.producers, this.engine)) throw new Error('Owned producer superseded');
			this.engine.invalidateObservedId.call(this.producers, property.id);
		}
	}

	private cli(): boolean { return getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on'; }
	private current(): boolean {
		return !this.destroyed && ownedProducerMethodCurrent(this.graph, 'captureOwnedPublicationLifecycle', this.captureLifecycle) &&
			this.engine.isOwnedEngineCurrent.call(this.producers, this.engine) &&
			!!this.owner && this.engine.isOwnedPublisherCurrent.call(this.producers, this.owner);
	}
	private requireOwner(): OwnedProducerPublisher {
		if (this.destroyed || this.cli()) throw new Error('Owned producer unavailable');
		if (!this.owner) {
			const owner = this.engine.acquireOwnedPublisher.call(this.producers, 'virtual-producer-state:v1', this.events);
			if (!owner) throw new Error('Owned producer already registered');
			this.owner = owner;
		}
		return this.requireExistingOwner();
	}
	private requireExistingOwner(): OwnedProducerPublisher {
		if (!this.owner || !this.current()) throw new Error('Owned producer unavailable');
		return this.owner;
	}
}
