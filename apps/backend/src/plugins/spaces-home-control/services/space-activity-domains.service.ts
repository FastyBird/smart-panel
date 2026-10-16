import { Inject, Injectable, Optional } from '@nestjs/common';

import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { domainResult, intentDomainResult } from '../activity/activity-result.utils';
import { ActivityDomain, ActivityDomainStatus } from '../activity/space-activity.constants';
import { ActivityConfigurationModel } from '../models/activity-configuration.model';
import { ActivityDomainResultModel } from '../models/activity-result.model';
import {
	CoversIntentType,
	LightingIntentType,
	LightingMode,
	MediaActivationState,
	MediaActivityKey,
} from '../spaces-home-control.constants';

import { CoversIntentService } from './covers-intent.service';
import { DerivedMediaEndpointService } from './derived-media-endpoint.service';
import { LightingIntentService } from './lighting-intent.service';
import {
	SPACE_CLIMATE_AUTOMATION_PORT,
	SpaceActivationIdentity,
	SpaceClimateAutomationPort,
} from './space-climate-automation.port';
import { SpaceCoversStateService } from './space-covers-state.service';
import { SpaceMediaActivityService } from './space-media-activity.service';

/** Domain readiness and execution; preview never calls a command or creates a binding. */
@Injectable()
export class SpaceActivityDomainsService {
	constructor(
		private readonly lighting: LightingIntentService,
		private readonly covers: CoversIntentService,
		private readonly coversState: SpaceCoversStateService,
		private readonly endpoints: DerivedMediaEndpointService,
		private readonly media: SpaceMediaActivityService,
		private readonly platforms: PlatformRegistryService,
		@Optional() @Inject(SPACE_CLIMATE_AUTOMATION_PORT) private readonly climate?: SpaceClimateAutomationPort,
	) {}
	async run(
		domain: ActivityDomain,
		config: ActivityConfigurationModel,
		identity: SpaceActivationIdentity | null,
		spaceId: string,
	): Promise<ActivityDomainResultModel> {
		if (!config[domain].enabled)
			return domainResult(domain, ActivityDomainStatus.DISABLED, 'disabled_in_configuration');
		try {
			if (domain === ActivityDomain.SECURITY)
				return domainResult(domain, ActivityDomainStatus.UNSUPPORTED, 'security_actuation_unavailable');
			if (domain === ActivityDomain.CLIMATE) {
				if (!this.climate)
					return domainResult(domain, ActivityDomainStatus.UNSUPPORTED, 'trusted_climate_adapter_unavailable');
				return identity ? this.climate.apply(identity, config.climate) : this.climate.preview(spaceId, config.climate);
			}
			if (identity && !(await identity.isCurrent()))
				return domainResult(domain, ActivityDomainStatus.FAILED, 'activation_superseded');
			if (domain === ActivityDomain.LIGHTING) {
				const lights = await this.lighting.getLightsInSpace(spaceId);
				if (!lights.length) return domainResult(domain, ActivityDomainStatus.NO_TARGETS, 'no_compatible_lights');
				if (!identity) return domainResult(domain, ActivityDomainStatus.READY, 'role_preserving_lighting_plan');
				if (!(await identity.isCurrent()))
					return domainResult(domain, ActivityDomainStatus.FAILED, 'activation_superseded');
				return intentDomainResult(
					domain,
					await this.lighting.executeLightingIntent(
						spaceId,
						{
							type: config.lighting.mode === LightingMode.OFF ? LightingIntentType.OFF : LightingIntentType.SET_MODE,
							mode: config.lighting.mode,
						},
						{ origin: 'panel.spaces', spaceId },
						config.lighting.brightness,
						identity.isCurrent,
					),
				);
			}
			if (domain === ActivityDomain.COVERS) {
				const targets = await this.coversState.getCoversInSpace(spaceId);
				if (!targets.length) return domainResult(domain, ActivityDomainStatus.NO_TARGETS, 'no_compatible_covers');
				// Never turn a requested intermediate position into the legacy command-only OPEN fallback.
				// Refuse the domain atomically if any selected target cannot honor the exact action.
				const position = config.covers.position;
				if (
					targets.some((target) => {
						const group = target.device.type === 'virtual' && Reflect.get(target.device, 'mode') === 'actuator_group';
						if (target.device.enabled === false || target.device.hidden || !this.platforms.get(target.device))
							return true;
						if (group && position !== 0 && position !== 100) return true;
						return !this.covers.supportsExactActivityPosition(target, position);
					})
				)
					return domainResult(
						domain,
						ActivityDomainStatus.UNSUPPORTED,
						'covers_require_compatible_writable_position_or_endpoint_command; group_percentage_unavailable',
					);
				if (!identity) return domainResult(domain, ActivityDomainStatus.READY, 'absolute_cover_position');
				if (!(await identity.isCurrent()))
					return domainResult(domain, ActivityDomainStatus.FAILED, 'activation_superseded');
				return intentDomainResult(
					domain,
					await this.covers.executeCoversIntent(
						spaceId,
						{ type: CoversIntentType.SET_POSITION, position },
						identity.isCurrent,
					),
				);
			}
			if (config.media.activity === MediaActivityKey.OFF) {
				const admission = await this.media.previewDeactivation(spaceId);
				if (admission.warnings.length)
					return domainResult(domain, ActivityDomainStatus.UNSUPPORTED, 'media_deactivation_targets_unavailable');
				if (!admission.hasActivity)
					return domainResult(domain, ActivityDomainStatus.NO_TARGETS, 'no_active_media_activity');
				if (!identity)
					return domainResult(
						domain,
						admission.targetCount ? ActivityDomainStatus.READY : ActivityDomainStatus.NO_TARGETS,
						'existing_media_deactivation_plan',
					);
				if (!(await identity.isCurrent()))
					return domainResult(domain, ActivityDomainStatus.FAILED, 'activation_superseded');
				const result = await this.media.deactivate(spaceId, identity.isCurrent);
				if (result.state !== MediaActivationState.DEACTIVATED || result.warnings?.length)
					return domainResult(domain, ActivityDomainStatus.FAILED, 'media_deactivation_failed');
				return domainResult(
					domain,
					admission.targetCount ? ActivityDomainStatus.SUCCEEDED : ActivityDomainStatus.NO_TARGETS,
					admission.targetCount
						? 'media_playback_paused_and_selection_cleared'
						: 'media_selection_cleared_without_playback_targets',
				);
			}
			const endpoints = await this.endpoints.buildEndpointsForSpace(spaceId);
			if (!endpoints.endpoints.length)
				return domainResult(domain, ActivityDomainStatus.NO_TARGETS, 'no_media_endpoints');
			// Existing preview rejects missing bindings. Never manufacture defaults during activation.
			let preview: Awaited<ReturnType<SpaceMediaActivityService['preview']>>;
			try {
				preview = await this.media.preview(spaceId, config.media.activity);
			} catch {
				return domainResult(domain, ActivityDomainStatus.UNSUPPORTED, 'operator_media_binding_missing_or_invalid');
			}
			if (!preview.plan.length || preview.warnings.length)
				return domainResult(domain, ActivityDomainStatus.UNSUPPORTED, 'media_plan_empty_or_incompatible');
			if (!identity) return domainResult(domain, ActivityDomainStatus.READY, 'existing_media_binding_plan');
			if (!(await identity.isCurrent()))
				return domainResult(domain, ActivityDomainStatus.FAILED, 'activation_superseded');
			const result = await this.media.activate(spaceId, config.media.activity, identity.isCurrent);
			const failed = result.state !== MediaActivationState.ACTIVE || result.summary?.stepsFailed;
			return domainResult(
				domain,
				failed ? ActivityDomainStatus.FAILED : ActivityDomainStatus.SUCCEEDED,
				failed ? 'media_execution_failed' : 'media_plan_executed',
			);
		} catch {
			return domainResult(domain, ActivityDomainStatus.FAILED, 'domain_execution_failed');
		}
	}
}
