import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { IDevicePropertyData } from '../../devices/platforms/device.platform';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { SpaceActiveMediaActivityEntity } from '../entities/space-active-media-activity.entity';
import { DerivedMediaEndpointModel } from '../models/derived-media-endpoint.model';
import {
	MediaActivityActivationResultModel,
	MediaActivityExecutionPlanModel,
	MediaActivityExecutionStepModel,
	MediaActivityLastResultModel,
	MediaActivityResolvedModel,
	MediaActivityStepFailureModel,
} from '../models/media-activity.model';
import { EventType, MediaActivationState, MediaActivityKey, MediaEndpointType, SPACES_MODULE_NAME } from '../spaces.constants';
import { SpacesValidationException } from '../spaces.exceptions';

import { DerivedMediaEndpointService } from './derived-media-endpoint.service';
import { SpaceMediaActivityBindingService } from './space-media-activity-binding.service';
import { SpacesService } from './spaces.service';

const STEP_TIMEOUT_MS = 5000;

@Injectable()
export class SpaceMediaActivityService {
	private readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceMediaActivityService');

	constructor(
		@InjectRepository(SpaceActiveMediaActivityEntity)
		private readonly activeRepository: Repository<SpaceActiveMediaActivityEntity>,
		private readonly spacesService: SpacesService,
		private readonly bindingService: SpaceMediaActivityBindingService,
		private readonly derivedEndpointService: DerivedMediaEndpointService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Get the active media activity record for a space
	 */
	async getActiveRecord(spaceId: string): Promise<SpaceActiveMediaActivityEntity | null> {
		return this.activeRepository.findOne({ where: { spaceId } });
	}

	/**
	 * Get the active media activity for a space (public endpoint)
	 */
	async getActive(spaceId: string): Promise<SpaceActiveMediaActivityEntity | null> {
		await this.spacesService.getOneOrThrow(spaceId);

		return this.getActiveRecord(spaceId);
	}

	/**
	 * Activate a media activity for a space
	 */
	async activate(spaceId: string, activityKey: MediaActivityKey): Promise<MediaActivityActivationResultModel> {
		await this.spacesService.getOneOrThrow(spaceId);

		// Validate activity key
		if (!Object.values(MediaActivityKey).includes(activityKey)) {
			throw new SpacesValidationException(`Invalid activity key: ${activityKey}`);
		}

		// Handle "off" as deactivation
		if (activityKey === MediaActivityKey.OFF) {
			return this.deactivate(spaceId);
		}

		// Idempotency: if same activity is already active, return current state
		const existingRecord = await this.getActiveRecord(spaceId);

		if (
			existingRecord &&
			existingRecord.activityKey === activityKey &&
			existingRecord.state === MediaActivationState.ACTIVE
		) {
			this.logger.debug(`Activity ${activityKey} already active for space=${spaceId}, returning current state`);

			return this.buildResultFromRecord(existingRecord);
		}

		// Load binding for activity key
		const bindings = await this.bindingService.findBySpace(spaceId);
		const binding = bindings.find((b) => b.activityKey === activityKey);

		if (!binding) {
			throw new SpacesValidationException(
				`No binding found for activity "${activityKey}" in space ${spaceId}. ` +
					`Please call POST /spaces/${spaceId}/media/bindings/apply-defaults first.`,
			);
		}

		// Load derived endpoints
		const endpointsResult = await this.derivedEndpointService.buildEndpointsForSpace(spaceId);
		const endpointMap = new Map<string, DerivedMediaEndpointModel>();

		for (const ep of endpointsResult.endpoints) {
			endpointMap.set(ep.endpointId, ep);
		}

		// Build execution plan
		const plan = this.buildExecutionPlan(spaceId, activityKey, binding, endpointMap);

		// Persist activating state
		let record = existingRecord;

		if (!record) {
			record = this.activeRepository.create({
				spaceId,
				activityKey,
				state: MediaActivationState.ACTIVATING,
				activatedAt: new Date(),
				resolved: JSON.stringify(plan.resolved),
				lastResult: null,
			});
		} else {
			record.activityKey = activityKey;
			record.state = MediaActivationState.ACTIVATING;
			record.activatedAt = new Date();
			record.resolved = JSON.stringify(plan.resolved);
			record.lastResult = null;
		}

		await this.activeRepository.save(record);

		// Emit activating event
		this.emitEvent(EventType.MEDIA_ACTIVITY_ACTIVATING, spaceId, activityKey, plan.resolved);

		// Execute plan
		const executionResult = await this.executePlan(plan);

		// Determine final state
		const hasCriticalFailure = executionResult.failures.some((f) => f.critical);
		const finalState = hasCriticalFailure ? MediaActivationState.FAILED : MediaActivationState.ACTIVE;

		// Build last result
		const lastResult: MediaActivityLastResultModel = {
			stepsTotal: plan.steps.length,
			stepsSucceeded: executionResult.succeeded,
			stepsFailed: executionResult.failures.length,
			failures: executionResult.failures.length > 0
				? executionResult.failures.map((f) => ({
						stepIndex: f.stepIndex,
						reason: f.reason,
						targetDeviceId: f.targetDeviceId,
						propertyId: f.propertyId,
					}))
				: undefined,
		};

		// Persist final state
		record.state = finalState;
		record.lastResult = JSON.stringify(lastResult);
		await this.activeRepository.save(record);

		// Emit appropriate event
		const warnings = executionResult.failures
			.filter((f) => !f.critical)
			.map((f) => `Step ${f.stepIndex}: ${f.reason}`);

		if (finalState === MediaActivationState.ACTIVE) {
			this.emitEvent(EventType.MEDIA_ACTIVITY_ACTIVATED, spaceId, activityKey, plan.resolved, lastResult, warnings);
		} else {
			this.emitEvent(EventType.MEDIA_ACTIVITY_FAILED, spaceId, activityKey, plan.resolved, lastResult);
		}

		this.logger.debug(
			`Activity activation complete: space=${spaceId} activity=${activityKey} state=${finalState} ` +
				`succeeded=${executionResult.succeeded} failed=${executionResult.failures.length}`,
		);

		return {
			activityKey,
			state: finalState,
			resolved: plan.resolved,
			summary: lastResult,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	}

	/**
	 * Deactivate the current media activity for a space
	 */
	async deactivate(spaceId: string): Promise<MediaActivityActivationResultModel> {
		await this.spacesService.getOneOrThrow(spaceId);

		const record = await this.getActiveRecord(spaceId);

		if (record) {
			record.activityKey = null;
			record.state = MediaActivationState.DEACTIVATED;
			record.lastResult = null;
			await this.activeRepository.save(record);
		}

		this.emitEvent(EventType.MEDIA_ACTIVITY_DEACTIVATED, spaceId, null);

		return {
			activityKey: null,
			state: MediaActivationState.DEACTIVATED,
		};
	}

	/**
	 * Build an execution plan from a binding and derived endpoints
	 */
	private buildExecutionPlan(
		spaceId: string,
		activityKey: MediaActivityKey,
		binding: {
			displayEndpointId: string | null;
			audioEndpointId: string | null;
			sourceEndpointId: string | null;
			remoteEndpointId: string | null;
			displayInputId: string | null;
			audioVolumePreset: number | null;
		},
		endpointMap: Map<string, DerivedMediaEndpointModel>,
	): MediaActivityExecutionPlanModel {
		const steps: MediaActivityExecutionStepModel[] = [];
		const resolved: MediaActivityResolvedModel = {};

		// Resolve device IDs from endpoint IDs
		const displayEndpoint = binding.displayEndpointId ? endpointMap.get(binding.displayEndpointId) : undefined;
		const audioEndpoint = binding.audioEndpointId ? endpointMap.get(binding.audioEndpointId) : undefined;
		const sourceEndpoint = binding.sourceEndpointId ? endpointMap.get(binding.sourceEndpointId) : undefined;
		const remoteEndpoint = binding.remoteEndpointId ? endpointMap.get(binding.remoteEndpointId) : undefined;

		if (displayEndpoint) {
			resolved.displayDeviceId = displayEndpoint.deviceId;
		}
		if (audioEndpoint) {
			resolved.audioDeviceId = audioEndpoint.deviceId;
		}
		if (sourceEndpoint) {
			resolved.sourceDeviceId = sourceEndpoint.deviceId;
		}
		if (remoteEndpoint) {
			resolved.remoteDeviceId = remoteEndpoint.deviceId;
		}

		// Track which devices we've already powered on to avoid duplicates
		const poweredDeviceIds = new Set<string>();

		// Step 1: Power on required devices (critical)
		const powerEndpoints = [displayEndpoint, audioEndpoint, sourceEndpoint].filter(
			(ep): ep is DerivedMediaEndpointModel => !!ep && ep.capabilities.power && !!ep.links.power,
		);

		for (const ep of powerEndpoints) {
			if (poweredDeviceIds.has(ep.deviceId)) {
				continue;
			}

			poweredDeviceIds.add(ep.deviceId);

			steps.push({
				targetDeviceId: ep.deviceId,
				action: {
					kind: 'setProperty',
					propertyId: ep.links.power!.propertyId,
					value: true,
				},
				critical: activityKey === MediaActivityKey.WATCH || activityKey === MediaActivityKey.GAMING,
				label: `Power on ${ep.name}`,
			});
		}

		// Step 2: Set inputs (critical if configured)
		if (displayEndpoint && binding.displayInputId && displayEndpoint.capabilities.inputSelect && displayEndpoint.links.inputSelect) {
			steps.push({
				targetDeviceId: displayEndpoint.deviceId,
				action: {
					kind: 'setProperty',
					propertyId: displayEndpoint.links.inputSelect.propertyId,
					value: binding.displayInputId,
				},
				critical: true,
				label: `Set display input to ${binding.displayInputId}`,
			});
		}

		// Step 3: Apply volume preset (non-critical)
		if (audioEndpoint && binding.audioVolumePreset !== null && audioEndpoint.capabilities.volume && audioEndpoint.links.volume) {
			steps.push({
				targetDeviceId: audioEndpoint.deviceId,
				action: {
					kind: 'setProperty',
					propertyId: audioEndpoint.links.volume.propertyId,
					value: binding.audioVolumePreset,
				},
				critical: false,
				label: `Set volume to ${binding.audioVolumePreset}%`,
			});
		}

		return {
			spaceId,
			activityKey,
			resolved,
			steps,
		};
	}

	/**
	 * Execute a plan with timeouts and partial success
	 */
	private async executePlan(
		plan: MediaActivityExecutionPlanModel,
	): Promise<{
		succeeded: number;
		failures: Array<{ stepIndex: number; reason: string; critical: boolean; targetDeviceId?: string; propertyId?: string }>;
	}> {
		let succeeded = 0;
		const failures: Array<{
			stepIndex: number;
			reason: string;
			critical: boolean;
			targetDeviceId?: string;
			propertyId?: string;
		}> = [];

		// Collect unique device IDs
		const deviceIds = [...new Set(plan.steps.map((s) => s.targetDeviceId))];
		const devices = await this.spacesService.findDevicesByIds(deviceIds);
		const deviceMap = new Map(devices.map((d) => [d.id, d]));

		for (let i = 0; i < plan.steps.length; i++) {
			const step = plan.steps[i];
			const device = deviceMap.get(step.targetDeviceId);

			if (!device) {
				const failure = {
					stepIndex: i,
					reason: `Device ${step.targetDeviceId} not found`,
					critical: step.critical,
					targetDeviceId: step.targetDeviceId,
					propertyId: step.action.propertyId,
				};

				failures.push(failure);

				if (step.critical) {
					this.logger.warn(`Critical step ${i} failed: device not found, aborting`);
					break;
				}

				continue;
			}

			const platform = this.platformRegistryService.get(device);

			if (!platform) {
				const failure = {
					stepIndex: i,
					reason: `No platform for device ${step.targetDeviceId}`,
					critical: step.critical,
					targetDeviceId: step.targetDeviceId,
					propertyId: step.action.propertyId,
				};

				failures.push(failure);

				if (step.critical) {
					this.logger.warn(`Critical step ${i} failed: no platform, aborting`);
					break;
				}

				continue;
			}

			if (step.action.kind !== 'setProperty' || !step.action.propertyId) {
				const failure = {
					stepIndex: i,
					reason: `Unsupported action kind: ${step.action.kind}`,
					critical: step.critical,
					targetDeviceId: step.targetDeviceId,
				};

				failures.push(failure);

				if (step.critical) {
					break;
				}

				continue;
			}

			// Find channel and property
			let foundChannel = null;
			let foundProperty = null;

			for (const channel of device.channels ?? []) {
				for (const property of channel.properties ?? []) {
					if (property.id === step.action.propertyId) {
						foundChannel = channel;
						foundProperty = property;
						break;
					}
				}

				if (foundProperty) {
					break;
				}
			}

			if (!foundChannel || !foundProperty) {
				const failure = {
					stepIndex: i,
					reason: `Property ${step.action.propertyId} not found on device`,
					critical: step.critical,
					targetDeviceId: step.targetDeviceId,
					propertyId: step.action.propertyId,
				};

				failures.push(failure);

				if (step.critical) {
					this.logger.warn(`Critical step ${i} failed: property not found, aborting`);
					break;
				}

				continue;
			}

			try {
				const command: IDevicePropertyData = {
					device,
					channel: foundChannel,
					property: foundProperty,
					value: step.action.value as string | number | boolean,
				};

				const result = await Promise.race([
					platform.processBatch([command]),
					new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Step timeout')), STEP_TIMEOUT_MS)),
				]);

				if (result) {
					succeeded++;
				} else {
					const failure = {
						stepIndex: i,
						reason: 'Command execution returned false',
						critical: step.critical,
						targetDeviceId: step.targetDeviceId,
						propertyId: step.action.propertyId,
					};

					failures.push(failure);

					if (step.critical) {
						this.logger.warn(`Critical step ${i} failed: command returned false, aborting`);
						break;
					}
				}
			} catch (error) {
				const err = error as Error;
				const failure = {
					stepIndex: i,
					reason: err.message,
					critical: step.critical,
					targetDeviceId: step.targetDeviceId,
					propertyId: step.action.propertyId,
				};

				failures.push(failure);

				if (step.critical) {
					this.logger.warn(`Critical step ${i} threw error: ${err.message}, aborting`);
					break;
				}
			}
		}

		return { succeeded, failures };
	}

	/**
	 * Build an activation result from an existing record
	 */
	private buildResultFromRecord(record: SpaceActiveMediaActivityEntity): MediaActivityActivationResultModel {
		const resolved = record.resolved ? (JSON.parse(record.resolved) as MediaActivityResolvedModel) : undefined;
		const summary = record.lastResult
			? (JSON.parse(record.lastResult) as MediaActivityLastResultModel)
			: undefined;

		return {
			activityKey: record.activityKey,
			state: record.state,
			resolved,
			summary,
		};
	}

	/**
	 * Emit a media activity event
	 */
	private emitEvent(
		eventType: EventType,
		spaceId: string,
		activityKey: MediaActivityKey | null,
		resolved?: MediaActivityResolvedModel,
		summary?: MediaActivityLastResultModel,
		warnings?: string[],
	): void {
		const payload: Record<string, unknown> = {
			space_id: spaceId,
			activity_key: activityKey,
			timestamp: new Date().toISOString(),
		};

		if (resolved) {
			payload.resolved = resolved;
		}

		if (summary) {
			payload.summary = summary;
		}

		if (warnings && warnings.length > 0) {
			payload.warnings = warnings;
		}

		this.eventEmitter.emit(eventType, payload);

		this.logger.debug(`Emitted ${eventType} for space=${spaceId} activity=${activityKey}`);
	}
}
