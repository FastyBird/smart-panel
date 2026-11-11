import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { SceneActionEntity } from '../../scenes/entities/scenes.entity';
import { SceneExecutorService, SceneRunGuard } from '../../scenes/services/scene-executor.service';
import { AUTOMATIONS_MODULE_NAME } from '../automations.constants';
import { ActionPolicyRequest, ActionPolicyVerdict } from '../engine/automation-engine';
import { AutomationGraphSafetyCheck, AutomationGraphSafetyFinding } from '../graph/graph-validator';
import { ActionSafetyPolicy, SafetyFinding, SafetySceneAction } from '../safety/action-safety-policy';
import { SafetyWriteTarget } from '../safety/safety-rules';

import { AutomationNodeTypeRegistryService } from './node-type-registry.service';

const categoryOf = (value: unknown): string | null => {
	if (typeof value !== 'object' || value === null) return null;

	const { category } = value as { category?: unknown };

	return typeof category === 'string' ? category : null;
};

/** The categories the safety rules decide by, read from a property loaded with its channel and device */
export const toSafetyWriteTarget = (property: ChannelPropertyEntity): SafetyWriteTarget => {
	const channel = property.channel as unknown;
	const device = typeof channel === 'object' && channel !== null ? (channel as { device?: unknown }).device : undefined;

	return {
		propertyCategory: categoryOf(property),
		channelCategory: categoryOf(channel),
		deviceCategory: categoryOf(device),
	};
};

/**
 * What a scene action writes. Scene actions belong to plugins; the ones that write a device property name
 * it as `propertyId` with a `value` (the local scenes plugin) or keep both in `configuration`. An action
 * that names no property can not be read, which the policy treats as not safe.
 */
export const toSafetySceneAction = (action: SceneActionEntity): SafetySceneAction => {
	const own = action as SceneActionEntity & { propertyId?: unknown; value?: unknown };
	const configuration: Record<string, unknown> =
		typeof action.configuration === 'object' && action.configuration !== null ? action.configuration : {};

	if (typeof own.propertyId === 'string' && own.propertyId !== '') {
		return { propertyId: own.propertyId, value: own.value };
	}

	if (typeof configuration.property_id === 'string' && configuration.property_id !== '') {
		return { propertyId: configuration.property_id, value: configuration.value };
	}

	return { propertyId: null, value: undefined };
};

const describeError = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

/**
 * Keeps unlocking, disarming and opening out of automations (design § Security and safety): a thin adapter
 * (ADR 0003, decision 15) that hands the framework-free `ActionSafetyPolicy` the devices and the scenes of
 * the application. What reduces safety is listed in `safety/safety-rules.ts` and nowhere else.
 *
 * The one policy is used on every path an automation can act by:
 *
 * - `checkGraph` when a graph is saved or validated: a write that reduces safety is an error on its node
 *   and stops the save, enabled or not;
 * - `checkAction` before every action of a run, as the action policy of the engine: a refusal takes the
 *   `error` output of the action and is traced as refused;
 * - `sceneGuard` inside every scene run an automation starts, for the very actions the run would execute.
 *
 * A scene run by a person from the panel or the admin never passes through here.
 */
@Injectable()
export class AutomationSafetyService {
	private readonly logger = createExtensionLogger(AUTOMATIONS_MODULE_NAME, 'AutomationSafetyService');

	private readonly policy: ActionSafetyPolicy;

	constructor(
		private readonly nodeTypeRegistry: AutomationNodeTypeRegistryService,
		private readonly propertiesService: ChannelsPropertiesService,
		private readonly sceneExecutor: SceneExecutorService,
	) {
		this.policy = new ActionSafetyPolicy({
			findTarget: async (propertyId) => {
				const property = await this.propertiesService.findOne(propertyId);

				return property ? toSafetyWriteTarget(property) : null;
			},
			listSceneActions: async (sceneId) => {
				const actions = await this.sceneExecutor.findEnabledActions(sceneId);

				return actions ? actions.map(toSafetySceneAction) : null;
			},
		});
	}

	/**
	 * Judges an action node of a graph that is being saved. What the node itself would write is an error;
	 * what a scene it runs would do right now is a warning, because the scene is judged again, as it is
	 * then, every time the automation is about to run it.
	 */
	readonly checkGraph: AutomationGraphSafetyCheck = async (nodeType, config) => {
		const findings = await this.policy.inspect(nodeType.commands(config));

		return findings.map(
			(finding): AutomationGraphSafetyFinding => ({
				severity: finding.via === 'write' ? 'error' : 'warning',
				message:
					finding.via === 'write'
						? finding.reason
						: `${finding.reason} The automation can be saved, but this action will take its error output.`,
				...(finding.field !== undefined ? { field: finding.field } : {}),
			}),
		);
	};

	/**
	 * The action policy of the engine: asked before every action of every run. Rejects when the action
	 * could not be judged, which the engine takes as a refusal.
	 */
	readonly checkAction = async (request: ActionPolicyRequest): Promise<ActionPolicyVerdict> => {
		const nodeType = this.nodeTypeRegistry.lookup(request.type);

		if (!nodeType) {
			return { allow: false, reason: 'The action is not available, so its safety could not be checked.' };
		}

		let findings: SafetyFinding[];

		try {
			findings = await this.policy.inspect(nodeType.commands(request.config));
		} catch (error) {
			this.logger.warn(
				`[SAFETY] Could not check node id=${request.nodeId} of automation id=${request.automationId}: ${describeError(error)}`,
			);

			throw error;
		}

		if (findings.length === 0) return { allow: true };

		const reason = [...new Set(findings.map((finding) => finding.reason))].join(' ');

		this.logger.warn(`[SAFETY] Refused node id=${request.nodeId} of automation id=${request.automationId}: ${reason}`);

		return { allow: false, reason };
	};

	/**
	 * Handed to the scene runner with every scene an automation runs. It judges the actions the run is
	 * about to execute, so a scene changed after `checkAction` looked at it is still not run.
	 */
	readonly sceneGuard: SceneRunGuard = async (scene, actions) => {
		const findings = await this.policy.inspectSceneActions(actions.map(toSafetySceneAction));

		if (findings.length === 0) return null;

		const reason = [...new Set(findings.map((finding) => finding.reason))].join(' ');

		this.logger.warn(`[SAFETY] Refused scene id=${scene.id} for an automation: ${reason}`);

		return reason;
	};
}
