import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { createExtensionLogger } from '../../../common/logger';
import { toSnakeCaseKeys } from '../../../common/utils/transform.utils';
import { IDevicePropertyData } from '../../devices/platforms/device.platform';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { SpaceActiveMediaActivityEntity } from '../entities/space-active-media-activity.entity';
import { DerivedMediaEndpointModel } from '../models/derived-media-endpoint.model';
import {
	MediaActivityActivationResultModel,
	MediaActivityControlTargetsModel,
	MediaActivityDryRunPreviewModel,
	MediaActivityDryRunWarningModel,
	MediaActivityExecutionPlanModel,
	MediaActivityExecutionStepModel,
	MediaActivityLastResultModel,
	MediaActivityResolvedModel,
} from '../models/media-activity.model';
import {
	EventType,
	MediaActivationState,
	MediaActivityKey,
	MediaEndpointType,
	SPACES_MODULE_NAME,
} from '../spaces.constants';
import { SpacesValidationException } from '../spaces.exceptions';

import { DerivedMediaEndpointService } from './derived-media-endpoint.service';
import { SpaceMediaActivityBindingService } from './space-media-activity-binding.service';
import { SpacesService } from './spaces.service';

const STEP_TIMEOUT_MS = 5000;
const STEP_DELAY_MS = 2000;

/**
 * Shared diagnostic checks for a binding against a set of derived endpoints.
 * Returns issues for missing endpoint references and capability mismatches.
 */
function diagnoseBinding(
	binding: {
		displayEndpointId: string | null;
		audioEndpointId: string | null;
		sourceEndpointId: string | null;
		remoteEndpointId: string | null;
		displayInputId: string | null;
		audioInputId: string | null;
		sourceInputId: string | null;
		audioVolumePreset: number | null;
	},
	endpointMap: Map<string, DerivedMediaEndpointModel>,
): string[] {
	const diagnostics: string[] = [];

	// Missing endpoint references
	const slots: { id: string | null; name: string }[] = [
		{ id: binding.displayEndpointId, name: 'Display' },
		{ id: binding.audioEndpointId, name: 'Audio' },
		{ id: binding.sourceEndpointId, name: 'Source' },
		{ id: binding.remoteEndpointId, name: 'Remote' },
	];

	for (const { id, name } of slots) {
		if (id && !endpointMap.has(id)) {
			diagnostics.push(`${name} endpoint not found (${id})`);
		}
	}

	// Capability mismatches on existing endpoints
	const audioEndpoint = binding.audioEndpointId ? endpointMap.get(binding.audioEndpointId) : undefined;
	const displayEndpoint = binding.displayEndpointId ? endpointMap.get(binding.displayEndpointId) : undefined;
	const sourceEndpoint = binding.sourceEndpointId ? endpointMap.get(binding.sourceEndpointId) : undefined;

	if (audioEndpoint && binding.audioVolumePreset !== null && !audioEndpoint.capabilities.volume) {
		diagnostics.push(`Volume preset skipped (${audioEndpoint.name} has no volume capability)`);
	}

	if (displayEndpoint && binding.displayInputId && !displayEndpoint.capabilities.inputSelect) {
		diagnostics.push(`Display input preset skipped (${displayEndpoint.name} has no input select capability)`);
	}

	if (audioEndpoint && binding.audioInputId && !audioEndpoint.capabilities.inputSelect) {
		diagnostics.push(`Audio input preset skipped (${audioEndpoint.name} has no input select capability)`);
	}

	if (sourceEndpoint && binding.sourceInputId && !sourceEndpoint.capabilities.inputSelect) {
		diagnostics.push(`Source input preset skipped (${sourceEndpoint.name} has no input select capability)`);
	}

	// Missing power capabilities
	if (displayEndpoint && !displayEndpoint.capabilities.power) {
		diagnostics.push(`Display power-on skipped (${displayEndpoint.name} has no power capability)`);
	}

	if (audioEndpoint && !audioEndpoint.capabilities.power) {
		diagnostics.push(`Audio power-on skipped (${audioEndpoint.name} has no power capability)`);
	}

	if (sourceEndpoint && !sourceEndpoint.capabilities.power) {
		diagnostics.push(`Source power-on skipped (${sourceEndpoint.name} has no power capability)`);
	}

	return diagnostics;
}

interface ExecutionFailure {
	stepIndex: number;
	reason: string;
	critical: boolean;
	targetDeviceId?: string;
	kind?: string;
	propertyId?: string;
	label?: string;
	timestamp?: string;
}

interface ExecutionResult {
	succeeded: number;
	failures: ExecutionFailure[];
}

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
			(existingRecord.state === MediaActivationState.ACTIVE || existingRecord.state === MediaActivationState.ACTIVATING)
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

		// Guardrails: warn when bindings reference missing endpoints or capabilities
		this.logBindingGuardrails(spaceId, activityKey, binding, endpointMap);

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
				resolved: JSON.stringify(toSnakeCaseKeys(plan.resolved)),
				lastResult: null,
			});
		} else {
			if (record.activityKey && record.activityKey !== activityKey) {
				this.logger.debug(
					`Switching activity: ${record.activityKey} → ${activityKey} for space=${spaceId} (previous state=${record.state})`,
				);
			}

			record.activityKey = activityKey;
			record.state = MediaActivationState.ACTIVATING;
			record.activatedAt = new Date();
			record.resolved = JSON.stringify(toSnakeCaseKeys(plan.resolved));
			record.lastResult = null;
		}

		await this.activeRepository.save(record);

		// Emit activating event with step plan for real-time progress tracking
		const planSteps = plan.steps.map((step, index) => ({
			index,
			label: step.label ?? `Step ${index + 1}`,
			critical: step.critical,
		}));

		this.emitEvent(
			EventType.MEDIA_ACTIVITY_ACTIVATING,
			spaceId,
			activityKey,
			plan.resolved,
			undefined,
			undefined,
			planSteps,
		);

		// Execute plan — wrapped in try-catch to ensure state is updated to FAILED on unexpected errors
		try {
			// Handle conflicts (best-effort, non-critical)
			const conflictWarnings = await this.handleConflicts(spaceId, activityKey, endpointMap);

			const executionResult = await this.executePlan(plan);

			// Determine final state
			const hasCriticalFailure = executionResult.failures.some((f) => f.critical);
			const finalState = hasCriticalFailure ? MediaActivationState.FAILED : MediaActivationState.ACTIVE;

			// Build last result with structured warnings/errors
			const allFailures = executionResult.failures;
			const warningItems = allFailures.filter((f) => !f.critical);
			const errorItems = allFailures.filter((f) => f.critical);

			const lastResult: MediaActivityLastResultModel = {
				stepsTotal: plan.steps.length,
				stepsSucceeded: executionResult.succeeded,
				stepsFailed: executionResult.failures.length,
				failures: allFailures.length > 0 ? allFailures : undefined,
				warnings: warningItems.length > 0 ? warningItems : undefined,
				errors: errorItems.length > 0 ? errorItems : undefined,
				warningCount: warningItems.length,
				errorCount: errorItems.length,
			};

			// Persist final state
			record.state = finalState;
			record.lastResult = JSON.stringify(toSnakeCaseKeys(lastResult));
			await this.activeRepository.save(record);

			// Emit appropriate event
			const warnings = [
				...conflictWarnings,
				...executionResult.failures.filter((f) => !f.critical).map((f) => `Step ${f.stepIndex}: ${f.reason}`),
			];

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
		} catch (error) {
			this.logger.error(
				`Unexpected error during activity activation: space=${spaceId} activity=${activityKey}`,
				error instanceof Error ? error.stack : String(error),
			);

			const unexpectedFailure = {
				stepIndex: 0,
				critical: true,
				reason: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
				timestamp: new Date().toISOString(),
			};

			const lastResult: MediaActivityLastResultModel = {
				stepsTotal: plan.steps.length,
				stepsSucceeded: 0,
				stepsFailed: plan.steps.length,
				failures: [unexpectedFailure],
				errors: [unexpectedFailure],
				warningCount: 0,
				errorCount: 1,
			};

			record.state = MediaActivationState.FAILED;
			record.lastResult = JSON.stringify(toSnakeCaseKeys(lastResult));
			await this.activeRepository.save(record);

			this.emitEvent(EventType.MEDIA_ACTIVITY_FAILED, spaceId, activityKey, plan.resolved, lastResult);

			return {
				activityKey,
				state: MediaActivationState.FAILED,
				resolved: plan.resolved,
				summary: lastResult,
			};
		}
	}

	/**
	 * Preview (dry-run) a media activity activation without executing any commands.
	 * Returns the resolved execution plan, step labels, and skip warnings.
	 */
	async preview(spaceId: string, activityKey: MediaActivityKey): Promise<MediaActivityDryRunPreviewModel> {
		await this.spacesService.getOneOrThrow(spaceId);

		if (!Object.values(MediaActivityKey).includes(activityKey)) {
			throw new SpacesValidationException(`Invalid activity key: ${activityKey}`);
		}

		if (activityKey === MediaActivityKey.OFF) {
			throw new SpacesValidationException('Cannot preview the "off" activity');
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

		// Build execution plan (same logic as real activation)
		const plan = this.buildExecutionPlan(spaceId, activityKey, binding, endpointMap);

		// Compute skip warnings from shared diagnostic helper
		const diagnostics = diagnoseBinding(binding, endpointMap);
		const warnings: MediaActivityDryRunWarningModel[] = diagnostics.map((label) => ({ label }));

		// Add step indices to plan steps for display
		const indexedPlan = plan.steps.map((step, index) => ({
			...step,
			label: step.label ?? `Step ${index + 1}: ${step.action.kind} on ${step.targetDeviceId}`,
		}));

		this.logger.debug(
			`Dry-run preview: space=${spaceId} activity=${activityKey} steps=${indexedPlan.length} warnings=${warnings.length}`,
		);

		return {
			spaceId,
			activityKey,
			resolved: plan.resolved,
			plan: indexedPlan,
			warnings,
		};
	}

	/**
	 * Deactivate the current media activity for a space
	 */
	async deactivate(spaceId: string): Promise<MediaActivityActivationResultModel> {
		await this.spacesService.getOneOrThrow(spaceId);

		const record = await this.getActiveRecord(spaceId);
		const deactivationWarnings: string[] = [];

		if (record) {
			// Best-effort: try to stop playback on resolved devices before deactivating
			if (record.resolved && record.state !== MediaActivationState.DEACTIVATED) {
				try {
					const resolved = JSON.parse(record.resolved) as MediaActivityResolvedModel;
					const stopWarnings = await this.bestEffortStopPlayback(spaceId, resolved);
					deactivationWarnings.push(...stopWarnings);
				} catch (error) {
					const err = error as Error;
					deactivationWarnings.push(`Best-effort stop failed: ${err.message}`);
					this.logger.warn(`Best-effort stop playback failed during deactivation: ${err.message}`);
				}
			}

			// Always set to deactivated regardless of stop playback outcome
			record.activityKey = null;
			record.state = MediaActivationState.DEACTIVATED;
			record.lastResult = null;
			await this.activeRepository.save(record);
		}

		this.emitEvent(EventType.MEDIA_ACTIVITY_DEACTIVATED, spaceId, null);

		return {
			activityKey: null,
			state: MediaActivationState.DEACTIVATED,
			warnings: deactivationWarnings.length > 0 ? deactivationWarnings : undefined,
		};
	}

	/**
	 * Best-effort: try to stop/pause playback on resolved devices.
	 * Returns warning messages for any failures (never throws).
	 */
	private async bestEffortStopPlayback(spaceId: string, resolved: MediaActivityResolvedModel): Promise<string[]> {
		const endpointsResult = await this.derivedEndpointService.buildEndpointsForSpace(spaceId);

		const playbackEndpoints = endpointsResult.endpoints.filter((e) => e.capabilities.playback && e.links.playback);

		// Only target endpoints that are part of the resolved activity
		const resolvedDeviceIds = new Set(
			[resolved.displayDeviceId, resolved.audioDeviceId, resolved.sourceDeviceId, resolved.remoteDeviceId].filter(
				Boolean,
			),
		);

		const targetEndpoints = playbackEndpoints.filter((ep) => resolvedDeviceIds.has(ep.deviceId));

		return this.pausePlaybackOnEndpoints(targetEndpoints, (ep) => `Failed to stop playback on ${ep.name}`);
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
			audioInputId: string | null;
			sourceInputId: string | null;
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

		// Compute control target hints using fallback heuristics
		resolved.controlTargets = this.computeControlTargets(
			displayEndpoint,
			audioEndpoint,
			sourceEndpoint,
			remoteEndpoint,
			endpointMap,
		);

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
					propertyId: ep.links.power.propertyId,
					value: true,
				},
				critical: activityKey === MediaActivityKey.WATCH || activityKey === MediaActivityKey.GAMING,
				label: `Power on ${ep.name}`,
			});
		}

		// Step 2: Set inputs (critical if configured)
		if (
			displayEndpoint &&
			binding.displayInputId &&
			displayEndpoint.capabilities.inputSelect &&
			displayEndpoint.links.inputSelect
		) {
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

		// Set audio input (if configured)
		if (
			audioEndpoint &&
			binding.audioInputId &&
			audioEndpoint.capabilities.inputSelect &&
			audioEndpoint.links.inputSelect
		) {
			steps.push({
				targetDeviceId: audioEndpoint.deviceId,
				action: {
					kind: 'setProperty',
					propertyId: audioEndpoint.links.inputSelect.propertyId,
					value: binding.audioInputId,
				},
				critical: true,
				label: `Set audio input to ${binding.audioInputId}`,
			});
		}

		// Set source input (if configured)
		if (
			sourceEndpoint &&
			binding.sourceInputId &&
			sourceEndpoint.capabilities.inputSelect &&
			sourceEndpoint.links.inputSelect
		) {
			steps.push({
				targetDeviceId: sourceEndpoint.deviceId,
				action: {
					kind: 'setProperty',
					propertyId: sourceEndpoint.links.inputSelect.propertyId,
					value: binding.sourceInputId,
				},
				critical: true,
				label: `Set source input to ${binding.sourceInputId}`,
			});
		}

		// Step 3: Apply volume preset (non-critical)
		if (
			audioEndpoint &&
			binding.audioVolumePreset !== null &&
			audioEndpoint.capabilities.volume &&
			audioEndpoint.links.volume
		) {
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
	 * Log warn-level messages when bindings reference missing endpoints or
	 * when overrides will be ignored due to missing capabilities.
	 */
	private logBindingGuardrails(
		spaceId: string,
		activityKey: MediaActivityKey,
		binding: {
			displayEndpointId: string | null;
			audioEndpointId: string | null;
			sourceEndpointId: string | null;
			remoteEndpointId: string | null;
			displayInputId: string | null;
			audioInputId: string | null;
			sourceInputId: string | null;
			audioVolumePreset: number | null;
		},
		endpointMap: Map<string, DerivedMediaEndpointModel>,
	): void {
		const diagnostics = diagnoseBinding(binding, endpointMap);
		const ctx = `space=${spaceId} activity=${activityKey}`;

		for (const label of diagnostics) {
			this.logger.warn(`${label} (${ctx})`);
		}
	}

	/**
	 * Execute a plan with timeouts and partial success, emitting step progress events
	 */
	private async executePlan(plan: MediaActivityExecutionPlanModel): Promise<ExecutionResult> {
		let succeeded = 0;
		const failures: ExecutionFailure[] = [];

		// Collect unique device IDs
		const deviceIds = [...new Set(plan.steps.map((s) => s.targetDeviceId))];
		const devices = await this.spacesService.findDevicesByIds(deviceIds);
		const deviceMap = new Map(devices.map((d) => [d.id, d]));

		for (let i = 0; i < plan.steps.length; i++) {
			const step = plan.steps[i];
			const stepLabel = step.label ?? `Step ${i + 1}`;
			const device = deviceMap.get(step.targetDeviceId);

			// Emit executing status, then wait so the UI shows the spinner before the action runs
			this.emitStepProgress(plan.spaceId, plan.activityKey, i, plan.steps.length, 'executing', stepLabel);
			await new Promise((resolve) => setTimeout(resolve, STEP_DELAY_MS));

			if (!device) {
				this.emitStepProgress(plan.spaceId, plan.activityKey, i, plan.steps.length, 'failed', stepLabel);

				failures.push({
					stepIndex: i,
					reason: `Device ${step.targetDeviceId} not found`,
					critical: step.critical,
					targetDeviceId: step.targetDeviceId,
					kind: step.action.kind,
					propertyId: step.action.propertyId,
					label: step.label,
					timestamp: new Date().toISOString(),
				});

				if (step.critical) {
					this.logger.warn(`Critical step ${i} failed: device not found, aborting`);
					break;
				}

				continue;
			}

			const platform = this.platformRegistryService.get(device);

			if (!platform) {
				this.emitStepProgress(plan.spaceId, plan.activityKey, i, plan.steps.length, 'failed', stepLabel);

				failures.push({
					stepIndex: i,
					reason: `No platform for device ${step.targetDeviceId}`,
					critical: step.critical,
					targetDeviceId: step.targetDeviceId,
					kind: step.action.kind,
					propertyId: step.action.propertyId,
					label: step.label,
					timestamp: new Date().toISOString(),
				});

				if (step.critical) {
					this.logger.warn(`Critical step ${i} failed: no platform, aborting`);
					break;
				}

				continue;
			}

			if (step.action.kind !== 'setProperty' || !step.action.propertyId) {
				this.emitStepProgress(plan.spaceId, plan.activityKey, i, plan.steps.length, 'failed', stepLabel);

				failures.push({
					stepIndex: i,
					reason: `Unsupported action kind: ${step.action.kind}`,
					critical: step.critical,
					targetDeviceId: step.targetDeviceId,
					kind: step.action.kind,
					label: step.label,
					timestamp: new Date().toISOString(),
				});

				if (step.critical) {
					break;
				}

				continue;
			}

			// Find channel and property
			let foundChannel: (typeof device.channels extends (infer U)[] | undefined ? U : never) | null = null;
			let foundProperty: unknown = null;

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
				this.emitStepProgress(plan.spaceId, plan.activityKey, i, plan.steps.length, 'failed', stepLabel);

				failures.push({
					stepIndex: i,
					reason: `Property ${step.action.propertyId} not found on device`,
					critical: step.critical,
					targetDeviceId: step.targetDeviceId,
					kind: step.action.kind,
					propertyId: step.action.propertyId,
					label: step.label,
					timestamp: new Date().toISOString(),
				});

				if (step.critical) {
					this.logger.warn(`Critical step ${i} failed: property not found, aborting`);
					break;
				}

				continue;
			}

			try {
				const command = {
					device,
					channel: foundChannel,
					property: foundProperty,
					value: step.action.value as string | number | boolean,
				} as IDevicePropertyData;

				const result = await Promise.race([
					platform.processBatch([command]),
					new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Step timeout')), STEP_TIMEOUT_MS)),
				]);

				if (result) {
					succeeded++;
					this.emitStepProgress(plan.spaceId, plan.activityKey, i, plan.steps.length, 'succeeded', stepLabel);
				} else {
					this.emitStepProgress(plan.spaceId, plan.activityKey, i, plan.steps.length, 'failed', stepLabel);

					failures.push({
						stepIndex: i,
						reason: 'Command execution returned false',
						critical: step.critical,
						targetDeviceId: step.targetDeviceId,
						kind: step.action.kind,
						propertyId: step.action.propertyId,
						label: step.label,
						timestamp: new Date().toISOString(),
					});

					if (step.critical) {
						this.logger.warn(`Critical step ${i} failed: command returned false, aborting`);
						break;
					}
				}
			} catch (error) {
				const err = error as Error;

				this.emitStepProgress(plan.spaceId, plan.activityKey, i, plan.steps.length, 'failed', stepLabel);

				failures.push({
					stepIndex: i,
					reason: err.message,
					critical: step.critical,
					targetDeviceId: step.targetDeviceId,
					kind: step.action.kind,
					propertyId: step.action.propertyId,
					label: step.label,
					timestamp: new Date().toISOString(),
				});

				if (step.critical) {
					this.logger.warn(`Critical step ${i} threw error: ${err.message}, aborting`);
					break;
				}
			}
		}

		return { succeeded, failures };
	}

	/**
	 * Compute control target hints using fallback heuristics.
	 * These help the UI find the best device for volume/input/playback/remote controls
	 * even when binding slots are empty or endpoints lack specific capabilities.
	 */
	private computeControlTargets(
		displayEndpoint: DerivedMediaEndpointModel | undefined,
		audioEndpoint: DerivedMediaEndpointModel | undefined,
		sourceEndpoint: DerivedMediaEndpointModel | undefined,
		remoteEndpoint: DerivedMediaEndpointModel | undefined,
		endpointMap: Map<string, DerivedMediaEndpointModel>,
	): MediaActivityControlTargetsModel {
		const allEndpoints = Array.from(endpointMap.values());
		const targets: MediaActivityControlTargetsModel = {};

		// Volume target: audio if volume → display if volume → any audio_output with volume
		if (audioEndpoint?.capabilities.volume) {
			targets.volumeTargetDeviceId = audioEndpoint.deviceId;
		} else if (displayEndpoint?.capabilities.volume) {
			targets.volumeTargetDeviceId = displayEndpoint.deviceId;
		} else {
			const fallback = allEndpoints.find((e) => e.type === MediaEndpointType.AUDIO_OUTPUT && e.capabilities.volume);

			if (fallback) {
				targets.volumeTargetDeviceId = fallback.deviceId;
			}
		}

		// Input target: display if inputSelect → any display with inputSelect
		if (displayEndpoint?.capabilities.inputSelect) {
			targets.inputTargetDeviceId = displayEndpoint.deviceId;
		} else {
			const fallback = allEndpoints.find((e) => e.type === MediaEndpointType.DISPLAY && e.capabilities.inputSelect);

			if (fallback) {
				targets.inputTargetDeviceId = fallback.deviceId;
			}
		}

		// Playback target: source if playback → audio if playback → any with playback
		if (sourceEndpoint?.capabilities.playback) {
			targets.playbackTargetDeviceId = sourceEndpoint.deviceId;
		} else if (audioEndpoint?.capabilities.playback) {
			targets.playbackTargetDeviceId = audioEndpoint.deviceId;
		} else {
			const fallback = allEndpoints.find((e) => e.capabilities.playback);

			if (fallback) {
				targets.playbackTargetDeviceId = fallback.deviceId;
			}
		}

		// Remote target: binding remote → display if remote → any remote_target
		if (remoteEndpoint?.capabilities.remoteCommands) {
			targets.remoteTargetDeviceId = remoteEndpoint.deviceId;
		} else if (displayEndpoint?.capabilities.remoteCommands) {
			targets.remoteTargetDeviceId = displayEndpoint.deviceId;
		} else {
			const fallback = allEndpoints.find(
				(e) => e.type === MediaEndpointType.REMOTE_TARGET && e.capabilities.remoteCommands,
			);

			if (fallback) {
				targets.remoteTargetDeviceId = fallback.deviceId;
			}
		}

		return targets;
	}

	/**
	 * Scan for and handle conflicts when activating a new activity.
	 * Best-effort: pause playing endpoints, never treat as critical.
	 * Returns warning messages.
	 */
	private async handleConflicts(
		spaceId: string,
		activityKey: MediaActivityKey,
		endpointMap: Map<string, DerivedMediaEndpointModel>,
	): Promise<string[]> {
		const warnings: string[] = [];

		// Only apply conflict handling for Watch/Gaming
		if (activityKey !== MediaActivityKey.WATCH && activityKey !== MediaActivityKey.GAMING) {
			return warnings;
		}

		// Check if there's an existing active activity
		const existingRecord = await this.getActiveRecord(spaceId);

		if (!existingRecord || !existingRecord.activityKey) {
			return warnings;
		}

		if (
			existingRecord.state !== MediaActivationState.ACTIVE &&
			existingRecord.state !== MediaActivationState.ACTIVATING
		) {
			return warnings;
		}

		const currentKey = existingRecord.activityKey;

		// Only handle conflicts with background/listen activities
		if (currentKey !== MediaActivityKey.BACKGROUND && currentKey !== MediaActivityKey.LISTEN) {
			return warnings;
		}

		this.logger.debug(`Conflict detected: activating ${activityKey} while ${currentKey} is active in space=${spaceId}`);

		// Try to pause playback on any playing endpoints
		const allEndpoints = Array.from(endpointMap.values());
		const playbackEndpoints = allEndpoints.filter((e) => e.capabilities.playback && e.links.playback);

		const pauseWarnings = await this.pausePlaybackOnEndpoints(
			playbackEndpoints,
			(ep) => `Failed to pause ${ep.name} (non-critical)`,
			(ep) => `Paused playback on ${ep.name} (conflict with ${currentKey})`,
		);

		warnings.push(...pauseWarnings);

		return warnings;
	}

	/**
	 * Pause playback on a list of endpoints (best-effort).
	 * Returns warning/info messages. Never throws.
	 */
	private async pausePlaybackOnEndpoints(
		endpoints: DerivedMediaEndpointModel[],
		failureMessage: (ep: DerivedMediaEndpointModel) => string,
		successMessage?: (ep: DerivedMediaEndpointModel) => string,
	): Promise<string[]> {
		const messages: string[] = [];

		for (const ep of endpoints) {
			try {
				const devices = await this.spacesService.findDevicesByIds([ep.deviceId]);
				const device = devices[0];

				if (!device) {
					continue;
				}

				const platform = this.platformRegistryService.get(device);

				if (!platform) {
					continue;
				}

				let foundChannel: (typeof device.channels extends (infer U)[] | undefined ? U : never) | null = null;
				let foundProperty: unknown = null;

				for (const channel of device.channels ?? []) {
					for (const property of channel.properties ?? []) {
						if (property.id === ep.links.playback.propertyId) {
							foundChannel = channel;
							foundProperty = property;
							break;
						}
					}

					if (foundProperty) {
						break;
					}
				}

				if (foundChannel && foundProperty) {
					const command = {
						device,
						channel: foundChannel,
						property: foundProperty,
						value: 'pause',
					} as IDevicePropertyData;

					await Promise.race([
						platform.processBatch([command]),
						new Promise<boolean>((_, reject) =>
							setTimeout(() => reject(new Error('Pause playback timeout')), STEP_TIMEOUT_MS),
						),
					]);

					if (successMessage) {
						messages.push(successMessage(ep));
					}
				}
			} catch (error) {
				const err = error as Error;
				messages.push(`${failureMessage(ep)}: ${err.message}`);
				this.logger.warn(`Pause playback failed for endpoint ${ep.endpointId}: ${err.message}`);
			}
		}

		return messages;
	}

	/**
	 * Build an activation result from an existing record
	 */
	private buildResultFromRecord(record: SpaceActiveMediaActivityEntity): MediaActivityActivationResultModel {
		const resolved = record.resolved ? (JSON.parse(record.resolved) as MediaActivityResolvedModel) : undefined;
		const summary = record.lastResult ? (JSON.parse(record.lastResult) as MediaActivityLastResultModel) : undefined;

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
		steps?: { index: number; label: string; critical: boolean }[],
	): void {
		const stateMap: Record<string, MediaActivationState> = {
			[EventType.MEDIA_ACTIVITY_ACTIVATING]: MediaActivationState.ACTIVATING,
			[EventType.MEDIA_ACTIVITY_ACTIVATED]: MediaActivationState.ACTIVE,
			[EventType.MEDIA_ACTIVITY_FAILED]: MediaActivationState.FAILED,
			[EventType.MEDIA_ACTIVITY_DEACTIVATED]: MediaActivationState.DEACTIVATED,
		};

		const payload: Record<string, unknown> = {
			space_id: spaceId,
			activity_key: activityKey,
			state: stateMap[eventType] ?? MediaActivationState.DEACTIVATED,
			timestamp: new Date().toISOString(),
		};

		if (resolved) {
			payload.resolved = toSnakeCaseKeys(resolved);
		}

		if (summary) {
			payload.summary = toSnakeCaseKeys(summary);
		}

		if (warnings && warnings.length > 0) {
			payload.warnings = warnings;
		}

		if (steps && steps.length > 0) {
			payload.steps = steps;
		}

		this.eventEmitter.emit(eventType, payload);

		this.logger.debug(`Emitted ${eventType} for space=${spaceId} activity=${activityKey}`);
	}

	/**
	 * Emit a step progress event for real-time activation tracking
	 */
	private emitStepProgress(
		spaceId: string,
		activityKey: MediaActivityKey,
		stepIndex: number,
		stepsTotal: number,
		status: 'executing' | 'succeeded' | 'failed',
		label: string,
	): void {
		const payload = {
			space_id: spaceId,
			activity_key: activityKey,
			step_index: stepIndex,
			steps_total: stepsTotal,
			status,
			label,
			timestamp: new Date().toISOString(),
		};

		this.eventEmitter.emit(EventType.MEDIA_ACTIVITY_STEP_PROGRESS, payload);

		this.logger.debug(
			`Step progress: space=${spaceId} activity=${activityKey} step=${stepIndex}/${stepsTotal} status=${status}`,
		);
	}
}
