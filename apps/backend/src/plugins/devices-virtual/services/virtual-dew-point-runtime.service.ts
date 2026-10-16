import { DataSource } from 'typeorm';

import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { getEnvValue } from '../../../common/utils/config.utils';
import { ConnectionState, EventType, OnlineDeviceState } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import {
	IncorporatedPropertySample,
	QualifiedPropertySample,
} from '../../../modules/devices/models/property-sample.model';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import {
	PropertyProducerLease,
	PropertyProducerRegistryService,
} from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { VirtualChannelPropertyEntity } from '../entities/devices-virtual.entity';
import { VirtualDewPointConfigEntity, VirtualDewPointSourceEntity } from '../entities/virtual-dew-point.entity';

import { VirtualDependencyGraphService } from './virtual-dependency-graph.service';
import {
	dewPointOutputContract,
	dewPointSourceContract,
	dewPointSourceFingerprint,
} from './virtual-dew-point-contract.utils';
import {
	DEW_POINT_FORMULA,
	DEW_POINT_ROLES,
	DewPointRole,
	calculateDewPoint,
	dewPointInputDomain,
} from './virtual-dew-point.utils';
import { hydrateMeasurementContract } from './virtual-measurement-metadata.utils';

export interface DewPointDiagnostic {
	value: number | null;
	quality: 'good' | 'unavailable';
	errors: string[];
	expiresAt: Date | null;
	sources: Partial<
		Record<
			DewPointRole,
			{ value: number | null; sampledAt: string | null; ageSeconds: number | null; errors: string[] }
		>
	>;
}

@Injectable()
export class VirtualDewPointRuntimeService implements OnApplicationBootstrap, OnModuleDestroy {
	private active = false;
	private generation = 0;
	private completed = -1;
	private running?: Promise<void>;
	private timer?: NodeJS.Timeout;
	private readonly stops: (() => void)[] = [];
	private readonly outputs = new Map<
		string,
		{ property: VirtualChannelPropertyEntity; lease: PropertyProducerLease; revision: number; barrier: number }
	>();
	private readonly barriers = new Map<string, number>();
	private readonly diagnostics = new Map<string, DewPointDiagnostic>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly producers: PropertyProducerRegistryService,
		private readonly values: PropertyValueService,
		private readonly graph: VirtualDependencyGraphService,
		private readonly connectivity: DeviceConnectionStateService,
		private readonly events: EventEmitter2,
		@Optional() private readonly config: ConfigService = new ConfigService(),
	) {}

	async onApplicationBootstrap(): Promise<void> {
		if (getEnvValue<string>(this.config, 'FB_CLI', null) === 'on' || this.active) return;
		this.active = true;
		for (const event of [
			EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED,
			EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED,
			EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED,
			EventType.CHANNEL_PROPERTY_CREATED,
			EventType.CHANNEL_PROPERTY_UPDATED,
			EventType.CHANNEL_PROPERTY_DELETED,
			EventType.CHANNEL_UPDATED,
			EventType.CHANNEL_DELETED,
			EventType.DEVICE_UPDATED,
			EventType.DEVICE_DELETED,
			EventType.DEVICE_CONNECTION_CHANGED,
			EventType.MODULE_RESET,
		]) {
			const listener = (payload: { id?: string; propertyId?: string }) => {
				const id = payload?.propertyId ?? payload?.id;
				if (event === EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED && this.outputs.has(id)) return;
				// Structural/reconnect changes require new reports from both inputs. Never promote cache/history.
				if (
					![
						EventType.CHANNEL_PROPERTY_SAMPLE_ACCEPTED,
						EventType.CHANNEL_PROPERTY_SAMPLE_INVALIDATED,
						EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED,
					].includes(event)
				)
					for (const outputId of this.outputs.keys()) this.requireFreshInputs(outputId);
				this.requestRecompute();
			};
			this.events.on(event, listener);
			this.stops.push(() => this.events.off(event, listener));
		}
		this.stops.push(
			this.graph.observeValidation(
				async () => {
					this.requestRecompute();
					await this.flush();
				},
				{ requiresActivation: true },
			),
		);
		this.timer = setInterval(() => {
			if (this.running === undefined) this.requestRecompute();
		}, 1000);
		this.timer.unref();
		this.requestRecompute();
		await this.flush();
	}

	onModuleDestroy(): void {
		this.active = false;
		this.generation++;
		if (this.timer) clearInterval(this.timer);
		for (const stop of this.stops.splice(0)) stop();
		for (const output of this.outputs.values()) this.producers.unregister(output.lease);
		this.outputs.clear();
		this.barriers.clear();
		this.diagnostics.clear();
	}

	activate(property: VirtualChannelPropertyEntity, revision: number): void {
		this.requireFreshInputs(property.id);
		this.outputs.set(property.id, {
			property,
			revision,
			barrier: this.barriers.get(property.id),
			lease: this.producers.register(property, revision, {
				isCurrent: this.graph.capturePublishGuard(),
				reason: 'graph_validation_pending',
			}),
		});
	}

	requireFreshInputs(id: string): void {
		const barrier = this.values.currentSampleGeneration();
		this.barriers.set(id, barrier);
		const output = this.outputs.get(id);
		if (output) {
			output.barrier = barrier;
			this.producers.invalidate(output.lease, ['awaiting_fresh_inputs']);
		}
	}

	readDiagnostics(id: string): DewPointDiagnostic | null {
		const result = this.diagnostics.get(id);
		if (!result) return null;
		const state = this.producers.read(id);
		return {
			...result,
			sources: structuredClone(result.sources),
			value: state?.producer.quality === 'good' ? (state.value as number) : null,
			quality: state?.producer.quality === 'good' ? 'good' : 'unavailable',
			errors: [...(state?.producer.reasons ?? result.errors)],
		};
	}

	requestRecompute(): void {
		if (!this.active) return;
		this.generation++;
		// Fences pending historical writes immediately, before any asynchronous metadata read.
		for (const output of this.outputs.values()) this.producers.beginEvaluation(output.lease);
		if (this.running === undefined) {
			this.running = this.drain().finally(() => {
				this.running = undefined;
			});
			void this.running.catch(() => undefined);
		}
	}

	async flush(): Promise<void> {
		await this.running;
	}

	private freshAfter(evidence: IncorporatedPropertySample, barrier: number): boolean {
		return evidence.producer
			? !!evidence.sources?.length && evidence.sources.every((s) => this.freshAfter(s, barrier))
			: evidence.acceptanceGeneration > barrier;
	}

	private async drain(): Promise<void> {
		while (this.active && this.completed !== this.generation) {
			const generation = this.generation;
			try {
				await this.evaluate(generation);
			} catch {
				for (const output of this.outputs.values()) this.producers.invalidate(output.lease, ['runtime_error']);
			} finally {
				this.completed = generation;
			}
		}
	}

	private async evaluate(generation: number): Promise<void> {
		const configs = await this.dataSource.manager.find(VirtualDewPointConfigEntity);
		if (generation !== this.generation) return;
		for (const [id, output] of this.outputs)
			if (!configs.some((c) => c.outputPropertyId === id)) {
				this.producers.unregister(output.lease);
				this.outputs.delete(id);
				this.barriers.delete(id);
				this.diagnostics.delete(id);
			}
		for (const config of configs) {
			const property = await this.dataSource.manager.findOne(VirtualChannelPropertyEntity, {
				where: { id: config.outputPropertyId },
				relations: ['channel', 'channel.device'],
			});
			if (generation !== this.generation || !this.active) return;
			if (!property) continue;
			let output = this.outputs.get(property.id);
			if (!output || output.revision !== config.revision || !this.producers.isAvailable(output.lease)) {
				// Revalidation may replace a lease; startup/config barriers are retained across ticks.
				const barrier =
					output && output.revision !== config.revision
						? this.values.currentSampleGeneration()
						: (this.barriers.get(property.id) ?? this.values.currentSampleGeneration());
				this.barriers.set(property.id, barrier);
				output = {
					property,
					revision: config.revision,
					barrier,
					lease: this.producers.register(property, config.revision, {
						isCurrent: this.graph.capturePublishGuard(),
						reason: 'graph_validation_pending',
					}),
				};
				this.outputs.set(property.id, output);
			}
			const evaluation = this.producers.beginEvaluation(output.lease);
			const rows = await this.dataSource.manager.findBy(VirtualDewPointSourceEntity, { outputPropertyId: property.id });
			const { result, samples, lineage } = await this.snapshot(config, property, rows, output.barrier);
			if (generation !== this.generation || !this.active) return;
			const now = new Date();
			const dry = samples.get('dry_bulb'),
				rh = samples.get('relative_humidity');
			if (!this.producers.isEvaluationCurrent(output.lease, evaluation)) continue;
			this.diagnostics.set(property.id, result);
			if (result.quality !== 'good') {
				this.producers.invalidate(output.lease, result.errors);
				continue;
			}
			property.unit = '°C';
			property.measurementQuantity = 'dew_point';
			await this.values.publishDerived(
				property,
				output.lease,
				result.value,
				{
					quality: 'good',
					reasons: [],
					sampledAt: new Date(Math.min(dry.sampledAt.getTime(), rh.sampledAt.getTime())),
					evaluatedAt: now,
					expiresAt: result.expiresAt,
					sourceSamples: lineage,
				},
				evaluation,
			);
		}
	}
	/** Detached inspection explains current blockers without installing a lease or consuming a freshness barrier. */
	async inspect(
		config: VirtualDewPointConfigEntity,
		property: VirtualChannelPropertyEntity,
		rows: VirtualDewPointSourceEntity[],
	): Promise<DewPointDiagnostic> {
		const guard = this.graph.capturePublishGuard();
		const { result } = await this.snapshot(config, property, rows, null);
		if (!guard()) {
			result.value = null;
			result.quality = 'unavailable';
			result.errors.push('graph_validation_pending');
		}
		return result;
	}

	private async snapshot(
		config: VirtualDewPointConfigEntity,
		property: VirtualChannelPropertyEntity,
		rows: VirtualDewPointSourceEntity[],
		barrier: number | null,
	) {
		const inputs: {
			row: VirtualDewPointSourceEntity;
			source: ChannelPropertyEntity | null;
			status: ConnectionState;
		}[] = [];
		for (const row of rows) {
			const source = row.sourcePropertyId
				? await this.dataSource.manager.findOne(ChannelPropertyEntity, {
						where: { id: row.sourcePropertyId },
						relations: ['channel', 'channel.device'],
					})
				: null;
			if (source) await hydrateMeasurementContract(this.dataSource.manager, source);
			const device = (source?.channel as ChannelEntity)?.device as DeviceEntity;
			inputs.push({
				row,
				source,
				status: device ? (await this.connectivity.readLatest(device)).status : ConnectionState.UNKNOWN,
			});
		}
		const now = new Date();
		const result: DewPointDiagnostic = {
			value: null,
			quality: 'unavailable',
			errors: [],
			expiresAt: null,
			sources: {},
		};
		if (
			config.schemaVersion !== 1 ||
			config.formulaVersion !== DEW_POINT_FORMULA ||
			!Number.isInteger(config.maximumAgeSeconds) ||
			config.maximumAgeSeconds < 1 ||
			config.maximumAgeSeconds > 86400 ||
			!Number.isInteger(config.maximumSkewSeconds) ||
			config.maximumSkewSeconds < 0 ||
			config.maximumSkewSeconds > 3600
		)
			result.errors.push('invalid_policy');
		if (!dewPointOutputContract(property)) result.errors.push('incompatible_output');
		if (((property.channel as ChannelEntity)?.device as DeviceEntity)?.enabled === false)
			result.errors.push('output_disabled');
		if (!this.graph.isValidated() || this.graph.isQuarantined(property.id)) result.errors.push('graph_ineligible');
		if (rows.length !== 2 || DEW_POINT_ROLES.some((role) => rows.filter((r) => r.role === role).length !== 1))
			result.errors.push('missing_input_role');
		const samples = new Map<DewPointRole, QualifiedPropertySample>();
		const lineage: IncorporatedPropertySample[] = [];
		const expiries: number[] = [];
		for (const { row, source, status } of inputs) {
			const errors: string[] = [];
			const sample = source ? this.values.readQualifiedSample(source, config.maximumAgeSeconds * 1000, now) : null;
			const evidence = sample ? this.values.captureIncorporatedSample(source) : null;
			if (!source) errors.push('missing');
			else if (
				row.domain?.minimum !== dewPointInputDomain(row.role).minimum ||
				row.domain?.maximum !== dewPointInputDomain(row.role).maximum ||
				row.domain?.minimumExclusive !== true ||
				!dewPointSourceContract(source, row.role) ||
				dewPointSourceFingerprint(source) !== row.contractFingerprint ||
				this.graph.isQuarantined(source.id)
			)
				errors.push('incompatible_source');
			if (((source?.channel as ChannelEntity)?.device as DeviceEntity)?.enabled === false) errors.push('disabled');
			if (status !== ConnectionState.UNKNOWN && !OnlineDeviceState.includes(status)) errors.push('offline');
			if (!sample || now.getTime() - sample.sampledAt.getTime() >= config.maximumAgeSeconds * 1000)
				errors.push('stale_or_unavailable');
			if (sample?.quality !== 'good') errors.push('quality');
			if (!evidence || !this.values.incorporatedEvidenceCurrent([evidence])) errors.push('lineage');
			else if (barrier !== null && !this.freshAfter(evidence, barrier)) errors.push('awaiting_fresh_input');
			result.sources[row.role] = {
				value: typeof sample?.value === 'number' ? sample.value : null,
				sampledAt: sample?.sampledAt.toISOString() ?? null,
				ageSeconds: sample ? (now.getTime() - sample.sampledAt.getTime()) / 1000 : null,
				errors,
			};
			result.errors.push(...errors.map((reason) => `${row.role}:${reason}`));
			if (!errors.length) {
				samples.set(row.role, sample);
				lineage.push(evidence);
				expiries.push(
					Math.min(
						sample.sampledAt.getTime() + config.maximumAgeSeconds * 1000,
						evidence.producer?.expiresAt ?? Infinity,
					),
				);
			}
		}
		const dry = samples.get('dry_bulb');
		const rh = samples.get('relative_humidity');
		if (!result.errors.length && dry && rh) {
			if (Math.abs(dry.sampledAt.getTime() - rh.sampledAt.getTime()) > config.maximumSkewSeconds * 1000)
				result.errors.push('skew');
			else if (!this.values.incorporatedEvidenceCurrent(lineage)) result.errors.push('lineage');
			else {
				result.value = calculateDewPoint(dry.value as number, rh.value as number);
				if (result.value === null) result.errors.push('domain');
				else {
					result.quality = 'good';
					result.expiresAt = new Date(Math.min(...expiries));
				}
			}
		}
		return { result, samples, lineage };
	}
}
