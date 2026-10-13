import { DataSource } from 'typeorm';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { getEnvValue } from '../../../common/utils/config.utils';
import { ConnectionState, EventType, OnlineDeviceState } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import {
	PropertyProducerEvaluation,
	PropertyProducerLease,
	PropertyProducerRegistryService,
} from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { validatePropertyCommandValue } from '../../../modules/devices/utils/property-command-value.utils';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { VirtualTransformConfigEntity, VirtualTransformSourceEntity } from '../entities/virtual-transform.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import { evaluateVirtualNumericTransform } from './virtual-numeric-transform.utils';
import { transformContractErrors } from './virtual-transform-contract.utils';

export interface TransformEvaluation {
	value: number | null;
	inputValue: number | null;
	quality: 'good' | 'unavailable';
	reasons: string[];
	sampledAt: Date | null;
	expiresAt: Date | null;
	ageSeconds: number | null;
}

interface RuntimeOutput {
	property: VirtualChannelPropertyEntity;
	revision: number;
	lease: PropertyProducerLease;
}

/** Process-local fresh evidence only. Configuration and historical output UUIDs remain durable. */
@Injectable()
export class VirtualTransformRuntimeService implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly outputs = new Map<string, RuntimeOutput>();
	private readonly diagnostics = new Map<string, TransformEvaluation>();
	private readonly stopListeners: (() => void)[] = [];
	private timer?: NodeJS.Timeout;
	private active = false;
	private requested = 0;
	private completed = 0;
	private readonly dirty = new Set<string>();
	private readonly sourceOutputs = new Map<string, Set<string>>();
	private readonly sourceSequences = new Map<string, number>();
	private readonly freshBarriers = new Map<string, { sourceId: string; sequence: number }>();
	private readonly sourceOwners = new Map<string, { deviceId: string; channelId: string }>();
	private running?: Promise<void>;

	constructor(
		private readonly dataSource: DataSource,
		private readonly producers: PropertyProducerRegistryService,
		private readonly values: PropertyValueService,
		private readonly connectivity: DeviceConnectionStateService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly events: EventEmitter2,
		@Optional() private readonly configService: NestConfigService = new NestConfigService(),
	) {}

	async onApplicationBootstrap(): Promise<void> {
		if (getEnvValue<string>(this.configService, 'FB_CLI', null) === 'on' || this.active) return;
		this.active = true;
		for (const event of [
			EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED,
			EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED,
			EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED,
			EventType.CHANNEL_PROPERTY_CREATED,
			EventType.CHANNEL_PROPERTY_UPDATED,
			EventType.CHANNEL_PROPERTY_DELETED,
			EventType.CHANNEL_CREATED,
			EventType.CHANNEL_UPDATED,
			EventType.CHANNEL_DELETED,
			EventType.DEVICE_UPDATED,
			EventType.DEVICE_DELETED,
			EventType.DEVICE_CONNECTION_CHANGED,
			EventType.MODULE_RESET,
		]) {
			const listener = (payload: {
				id?: string;
				propertyId?: string;
				device?: { id?: string };
				sample?: { provenance?: string };
			}) => {
				const sourceId = payload?.propertyId ?? payload?.id;
				if (
					event === EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED &&
					payload?.sample?.provenance === 'live' &&
					sourceId &&
					(this.sourceOutputs.has(sourceId) ||
						Array.from(this.freshBarriers.values()).some((barrier) => barrier.sourceId === sourceId))
				)
					this.sourceSequences.set(sourceId, (this.sourceSequences.get(sourceId) ?? 0) + 1);
				if (
					[
						EventType.CHANNEL_PROPERTY_UPDATED,
						EventType.CHANNEL_PROPERTY_DELETED,
						EventType.CHANNEL_UPDATED,
						EventType.CHANNEL_DELETED,
						EventType.DEVICE_UPDATED,
						EventType.DEVICE_DELETED,
						EventType.DEVICE_CONNECTION_CHANGED,
					].includes(event)
				) {
					const changedId = payload?.device?.id ?? payload?.id;
					for (const [id, output] of this.outputs) {
						const channel = output.property.channel as ChannelEntity;
						if (id === changedId || channel?.id === changedId || (channel?.device as DeviceEntity)?.id === changedId)
							for (const [sourceId, outputIds] of this.sourceOutputs)
								if (outputIds.has(id)) this.requireFreshSample(id, sourceId);
					}
					for (const [sourceId, outputIds] of this.sourceOutputs) {
						const owner = this.sourceOwners.get(sourceId);
						if (sourceId === changedId || owner?.deviceId === changedId || owner?.channelId === changedId)
							for (const id of outputIds) this.requireFreshSample(id, sourceId);
					}
				}
				if (event === EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED && sourceId)
					for (const id of this.sourceOutputs.get(sourceId) ?? []) {
						const output = this.outputs.get(id);
						if (output) this.producers.invalidate(output.lease, ['invalid']);
					}
				if (event === EventType.CHANNEL_PROPERTY_DELETED && sourceId) this.sourceSequences.delete(sourceId);
				// Outputs emit their own producer state; never feed those publications back into themselves.
				if (event === EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED && this.outputs.has(payload?.id)) return;
				if (
					[
						EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED,
						EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED,
						EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED,
					].includes(event)
				) {
					this.requestRecompute(payload?.propertyId ?? payload?.id);
				} else this.requestRecompute();
			};
			this.events.on(event, listener);
			this.stopListeners.push(() => this.events.off(event, listener));
		}
		this.stopListeners.push(
			this.graph.observeValidation(async () => {
				this.requestRecompute();
				await this.flush();
			}),
		);
		// Precise input deadlines are evaluated with the fixed sample clock; bounded backstop handles
		// expiry and connectivity even if an integration fails to emit an expected event.
		this.timer = setInterval(() => {
			if (this.running === undefined) this.requestRecompute();
		}, 1_000);
		this.timer.unref();
		this.requestRecompute();
		await this.flush();
	}

	onModuleDestroy(): void {
		this.active = false;
		this.requested++;
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
		for (const stop of this.stopListeners.splice(0)) stop();
		for (const output of this.outputs.values()) this.producers.unregister(output.lease);
		this.outputs.clear();
		this.diagnostics.clear();
		this.dirty.clear();
		this.sourceOutputs.clear();
		this.sourceSequences.clear();
		this.freshBarriers.clear();
		this.sourceOwners.clear();
	}

	isActive(): boolean {
		return this.active;
	}

	/** A new configuration or source identity needs an accepted live report after admission. */
	requireFreshSample(outputId: string, sourceId: string | null): void {
		if (sourceId) this.freshBarriers.set(outputId, { sourceId, sequence: this.sourceSequences.get(sourceId) ?? 0 });
		else this.freshBarriers.delete(outputId);
		const output = this.outputs.get(outputId);
		if (output) this.producers.invalidate(output.lease, ['awaiting_fresh_sample']);
	}

	readDiagnostics(outputPropertyId: string): TransformEvaluation | null {
		const value = this.diagnostics.get(outputPropertyId);
		if (!value) return null;
		const live = this.producers.read(outputPropertyId);
		return {
			...value,
			value: (live?.value as number) ?? null,
			quality: live?.producer.quality === 'good' ? 'good' : 'unavailable',
			reasons: [...(live?.producer.reasons ?? value.reasons)],
			sampledAt: value.sampledAt ? new Date(value.sampledAt) : null,
			expiresAt: value.expiresAt ? new Date(value.expiresAt) : null,
		};
	}

	requestRecompute(sourcePropertyId?: string): void {
		if (!this.active) return;
		const affected = sourcePropertyId ? this.sourceOutputs.get(sourcePropertyId) : undefined;
		if (sourcePropertyId && !affected?.size) return;
		if (!sourcePropertyId) this.requested++;
		for (const id of affected ?? this.outputs.keys()) {
			this.dirty.add(id);
			const output = this.outputs.get(id);
			if (output) this.producers.beginEvaluation(output.lease);
		}
		if (this.running === undefined) {
			this.running = this.drain().finally(() => {
				this.running = undefined;
			});
			// Event listeners cannot await. Failure clears live authority; the next event/tick retries.
			void this.running.catch(() => undefined);
		}
	}

	async flush(): Promise<void> {
		await this.running;
	}

	private async drain(): Promise<void> {
		while (this.active && (this.completed !== this.requested || this.dirty.size > 0)) {
			const generation = this.requested;
			try {
				await this.evaluateAll(generation);
			} catch (error) {
				for (const output of this.outputs.values()) this.producers.invalidate(output.lease, ['runtime_error']);
				throw error;
			} finally {
				this.completed = generation;
			}
		}
	}

	private async evaluateAll(generation: number): Promise<void> {
		const configs = await this.dataSource.manager.find(VirtualTransformConfigEntity);
		if (this.completed !== generation) {
			for (const config of configs) this.dirty.add(config.outputPropertyId);
		}
		if (!this.current(generation)) return;
		const ids = new Set(configs.map((config) => config.outputPropertyId));
		for (const id of this.dirty)
			if (!ids.has(id)) {
				this.dirty.delete(id);
				this.freshBarriers.delete(id);
			}
		for (const [sourceId, outputIds] of this.sourceOutputs) {
			for (const id of outputIds) if (!ids.has(id)) outputIds.delete(id);
			if (!outputIds.size) {
				this.sourceOutputs.delete(sourceId);
				this.sourceOwners.delete(sourceId);
			}
		}
		for (const [id, output] of this.outputs)
			if (!ids.has(id)) {
				this.producers.unregister(output.lease);
				this.outputs.delete(id);
				this.diagnostics.delete(id);
				this.dirty.delete(id);
			}
		for (const config of configs) {
			if (!this.current(generation)) return;
			if (!this.dirty.delete(config.outputPropertyId)) continue;
			const property = await this.dataSource.manager.findOne(VirtualChannelPropertyEntity, {
				where: { id: config.outputPropertyId },
				relations: ['channel', 'channel.device'],
			});
			if (!this.current(generation)) return;
			if (!property) continue;
			let output = this.outputs.get(property.id);
			if (!output || output.revision !== config.revision || !this.producers.isCurrent(output.lease)) {
				output = { property, revision: config.revision, lease: this.producers.register(property, config.revision) };
				this.outputs.set(property.id, output);
			}
			output.property = property;
			const evaluation = this.producers.beginEvaluation(output.lease);
			const channel = property.channel as ChannelEntity;
			const outputDisabled = (channel.device as DeviceEntity)?.enabled === false;

			const binding = await this.dataSource.manager.findOneBy(VirtualTransformSourceEntity, {
				outputPropertyId: property.id,
			});
			for (const [sourceId, outputIds] of this.sourceOutputs) {
				outputIds.delete(property.id);
				if (!outputIds.size) {
					this.sourceOutputs.delete(sourceId);
					this.sourceOwners.delete(sourceId);
				}
			}
			if (binding?.sourcePropertyId) {
				const ids = this.sourceOutputs.get(binding.sourcePropertyId) ?? new Set<string>();
				ids.add(property.id);
				this.sourceOutputs.set(binding.sourcePropertyId, ids);
			}
			const source = binding?.sourcePropertyId
				? await this.dataSource.manager.findOne(ChannelPropertyEntity, {
						where: { id: binding.sourcePropertyId },
						relations: ['channel', 'channel.device'],
					})
				: null;
			const device = (source?.channel as ChannelEntity)?.device as DeviceEntity;
			if (binding?.sourcePropertyId && device)
				this.sourceOwners.set(binding.sourcePropertyId, {
					deviceId: device.id,
					channelId: (source.channel as ChannelEntity).id,
				});
			const barrier = this.freshBarriers.get(property.id);
			const hasFreshEvidence =
				!barrier || (barrier.sourceId === source?.id && (this.sourceSequences.get(source.id) ?? 0) > barrier.sequence);
			const status = device ? (await this.connectivity.readLatest(device)).status : ConnectionState.UNKNOWN;
			if (!this.current(generation) || !this.producers.isEvaluationCurrent(output.lease, evaluation)) continue;
			const now = new Date();
			const sample = source ? this.values.readQualifiedSample(source, Number.MAX_SAFE_INTEGER, now) : null;
			const result: TransformEvaluation = {
				value: null,
				inputValue: typeof sample?.value === 'number' ? sample.value : null,
				quality: 'unavailable',
				reasons: [],
				sampledAt: sample?.sampledAt ?? null,
				expiresAt: null,
				ageSeconds: sample ? (now.getTime() - sample.sampledAt.getTime()) / 1000 : null,
			};
			const contractErrors = transformContractErrors(config, property, source, binding);
			if (!contractErrors.length) {
				property.unit = config.unit;
				property.measurementQuantity = config.quantity;
			}
			if (outputDisabled) result.reasons = ['output_disabled'];
			else if (this.graph.isQuarantined(property.id)) result.reasons = ['graph_quarantined'];
			else if (contractErrors.length) result.reasons = contractErrors;
			else if (!binding || !source) result.reasons = ['missing'];
			else if (device?.enabled === false) result.reasons = ['disabled'];
			else if (status !== ConnectionState.UNKNOWN && !OnlineDeviceState.includes(status)) result.reasons = ['offline'];
			else if (!sample) result.reasons = ['invalid'];
			else if (!hasFreshEvidence || sample.receivedAt.getTime() < config.configuredAt.getTime())
				result.reasons = ['awaiting_fresh_sample'];
			else if (result.ageSeconds < 0 || result.ageSeconds >= config.maximumAgeSeconds) result.reasons = ['stale'];
			else if (
				!validatePropertyCommandValue(
					{ ...source, invalid: source.invalid ?? null, step: null } as ChannelPropertyEntity,
					sample.value,
				).valid
			)
				result.reasons = ['invalid'];
			else {
				const computed = evaluateVirtualNumericTransform(config.policy, sample.value);
				if (computed.reason) result.reasons = [computed.reason];
				else if (
					!validatePropertyCommandValue(
						{
							...property,
							type: property.type,
							invalid: property.invalid ?? null,
							step: null,
						} as ChannelPropertyEntity,
						computed.value,
					).valid
				)
					result.reasons = ['output_out_of_range'];
				else {
					result.value = computed.value;
					result.quality = 'good';
					result.expiresAt = new Date(sample.sampledAt.getTime() + config.maximumAgeSeconds * 1000);
				}
			}

			if (!this.current(generation)) return;
			if (!this.producers.isEvaluationCurrent(output.lease, evaluation)) continue;
			this.diagnostics.set(property.id, result);
			await this.publish(output, evaluation, result, now);
		}
		const retainedSources = new Set(Array.from(this.freshBarriers.values(), (barrier) => barrier.sourceId));
		for (const sourceId of this.sourceSequences.keys())
			if (!this.sourceOutputs.has(sourceId) && !retainedSources.has(sourceId)) this.sourceSequences.delete(sourceId);
	}

	private current(generation: number): boolean {
		return this.active && generation === this.requested;
	}

	private async publish(
		output: RuntimeOutput,
		evaluation: PropertyProducerEvaluation,
		result: TransformEvaluation,
		now: Date,
	): Promise<void> {
		if (!this.producers.isEvaluationCurrent(output.lease, evaluation)) return;
		if (result.quality === 'unavailable') {
			if (this.producers.version(output.lease) === evaluation?.epoch)
				this.values.invalidateDerived(output.property, output.lease, result.reasons, now);
			return;
		}
		await this.values.publishDerived(
			output.property,
			output.lease,
			result.value,
			{
				quality: result.quality,
				reasons: result.reasons,
				sampledAt: result.sampledAt,
				evaluatedAt: now,
				expiresAt: result.expiresAt,
			},
			evaluation,
		);
	}
}
