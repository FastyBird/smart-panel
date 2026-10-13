import { DataSource } from 'typeorm';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { getEnvValue } from '../../../common/utils/config.utils';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	EventType,
	OnlineDeviceState,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import {
	PropertyProducerEvaluation,
	PropertyProducerLease,
	PropertyProducerRegistryService,
} from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { validatePropertyCommandValue } from '../../../modules/devices/utils/property-command-value.utils';
import { resolvePropertyUnit } from '../../../modules/devices/utils/property-metadata.utils';
import { DEVICES_VIRTUAL_PLUGIN_NAME } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { VirtualAggregateConfigEntity, VirtualAggregateInputEntity } from '../entities/virtual-producer.entity';

import { AggregateEvaluation, AggregateInputEvidence, evaluateAggregate } from './virtual-aggregate-evaluator';
import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import {
	isEligibleVirtualMeasurement,
	isEligibleVirtualTransformedTemperature,
} from './virtual-source-eligibility.utils';

interface RuntimeOutput {
	property: VirtualChannelPropertyEntity;
	revision: number;
	lease: PropertyProducerLease;
}

/** Process-local fresh evidence only. Configuration and historical output UUIDs remain durable. */
@Injectable()
export class VirtualAggregateRuntimeService implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = createExtensionLogger(DEVICES_VIRTUAL_PLUGIN_NAME, 'VirtualAggregateRuntimeService');
	private readonly outputs = new Map<string, RuntimeOutput>();
	private readonly diagnostics = new Map<string, AggregateEvaluation>();
	private readonly stopListeners: (() => void)[] = [];
	private timer?: NodeJS.Timeout;
	private active = false;
	private requested = 0;
	private completed = 0;
	private readonly dirty = new Set<string>();
	private readonly sourceOutputs = new Map<string, Set<string>>();
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
			const listener = (payload: { id?: string; propertyId?: string }) => {
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
	}

	isActive(): boolean {
		return this.active;
	}

	readDiagnostics(outputPropertyId: string): AggregateEvaluation | null {
		const value = this.diagnostics.get(outputPropertyId);
		return value
			? {
					...value,
					sampledAt: value.sampledAt ? new Date(value.sampledAt) : null,
					expiresAt: value.expiresAt ? new Date(value.expiresAt) : null,
					reasons: [...value.reasons],
					inputs: value.inputs.map((input) => ({ ...input })),
				}
			: null;
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
			// Event listeners cannot await. Evaluation failures are contained by drain; the next event/tick retries.
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
				this.logger.error(
					'Aggregate evaluation failed; retrying on the next event or tick.',
					error instanceof Error ? error : String(error),
				);
				for (const output of this.outputs.values()) this.producers.invalidate(output.lease, ['runtime_error']);
				this.dirty.clear();
			} finally {
				this.completed = generation;
			}
		}
	}

	private async evaluateAll(generation: number): Promise<void> {
		const configs = await this.dataSource.manager.find(VirtualAggregateConfigEntity);
		if (this.completed !== generation) {
			for (const config of configs) this.dirty.add(config.outputPropertyId);
		}
		if (!this.current(generation)) return;
		const ids = new Set(configs.map((config) => config.outputPropertyId));
		for (const id of this.dirty) if (!ids.has(id)) this.dirty.delete(id);
		for (const [sourceId, outputIds] of this.sourceOutputs) {
			for (const id of outputIds) if (!ids.has(id)) outputIds.delete(id);
			if (!outputIds.size) this.sourceOutputs.delete(sourceId);
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
			if ((channel.device as DeviceEntity)?.enabled === false) {
				this.producers.invalidate(output.lease, ['output_disabled']);
				continue;
			}

			if (
				config.schemaVersion !== 1 ||
				this.graph.isQuarantined(property.id) ||
				!isEligibleVirtualMeasurement(property, channel, channel.device as DeviceEntity)
			) {
				this.producers.invalidate(output.lease, [
					this.graph.isQuarantined(property.id) ? 'graph_quarantined' : 'incompatible_output',
				]);
				continue;
			}
			const inputs = await this.dataSource.manager.find(VirtualAggregateInputEntity, {
				where: { outputPropertyId: property.id },
				order: { id: 'ASC' },
			});
			for (const [sourceId, outputIds] of this.sourceOutputs) {
				outputIds.delete(property.id);
				if (!outputIds.size) this.sourceOutputs.delete(sourceId);
			}
			for (const input of inputs)
				if (input.sourcePropertyId) {
					const outputIds = this.sourceOutputs.get(input.sourcePropertyId) ?? new Set<string>();
					outputIds.add(property.id);
					this.sourceOutputs.set(input.sourcePropertyId, outputIds);
				}
			const sources: {
				input: VirtualAggregateInputEntity;
				property: ChannelPropertyEntity | null;
				status: ConnectionState;
			}[] = [];
			for (const input of inputs) {
				const source = input.sourcePropertyId
					? await this.dataSource.manager.findOne(ChannelPropertyEntity, {
							where: { id: input.sourcePropertyId },
							relations: ['channel', 'channel.device'],
						})
					: null;
				const device = (source?.channel as ChannelEntity)?.device as DeviceEntity;
				const status = device ? (await this.connectivity.readLatest(device)).status : ConnectionState.UNKNOWN;
				sources.push({ input, property: source, status });
			}
			if (!this.current(generation) || !this.producers.isCurrent(output.lease)) return;
			const now = new Date();
			const evidence: AggregateInputEvidence[] = sources.map(({ input, property: source, status }) => {
				const sourceChannel = source?.channel as ChannelEntity;
				const device = sourceChannel?.device as DeviceEntity;
				const unit = source ? resolvePropertyUnit(source) : null;
				const incompatible =
					source &&
					((device?.type === 'virtual' && !isEligibleVirtualTransformedTemperature(source, sourceChannel, device)) ||
						sourceChannel?.category !== ChannelCategory.TEMPERATURE ||
						source.category !== PropertyCategory.TEMPERATURE ||
						source.dataType !== DataTypeType.FLOAT ||
						!source.permissions?.some((permission) =>
							[PermissionType.READ_ONLY, PermissionType.READ_WRITE].includes(permission),
						) ||
						input.quantity !== String(PropertyCategory.TEMPERATURE) ||
						input.unit !== unit ||
						unit !== resolvePropertyUnit(property) ||
						(source.unit != null && source.unit !== unit) ||
						(property.unit != null && property.unit !== resolvePropertyUnit(property)) ||
						this.graph.isQuarantined(source.id));
				const sample =
					source && !incompatible ? this.values.readQualifiedSample(source, Number.MAX_SAFE_INTEGER, now) : null;
				return {
					id: input.id,
					sourceIdentity: input.sourcePropertyIdentity,
					sample,
					expiresAt:
						source && this.producers.owns(source.id)
							? new Date(this.producers.read(source.id)?.producer.expiresAt ?? NaN)
							: undefined,
					exclusion:
						device?.enabled === false
							? 'disabled'
							: !source
								? 'missing'
								: incompatible
									? 'incompatible'
									: status !== ConnectionState.UNKNOWN && !OnlineDeviceState.includes(status)
										? 'offline'
										: sample &&
											  !validatePropertyCommandValue(
													{ ...source, invalid: source.invalid ?? null, step: null } as ChannelPropertyEntity,
													sample.value,
											  ).valid
											? 'invalid'
											: undefined,
				};
			});
			const result = evaluateAggregate(
				config.operator,
				config.minimumValidInputs,
				config.maximumAgeSeconds,
				evidence,
				now,
				property.step,
			);
			if (!this.current(generation)) return;
			if (!this.producers.isEvaluationCurrent(output.lease, evaluation)) continue;
			this.diagnostics.set(property.id, result);
			await this.publish(output, evaluation, result, now);
		}
	}

	private current(generation: number): boolean {
		return this.active && generation === this.requested;
	}

	private async publish(
		output: RuntimeOutput,
		evaluation: PropertyProducerEvaluation,
		result: AggregateEvaluation,
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
