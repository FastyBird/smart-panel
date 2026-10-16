import { ActivityClimateModel } from '../models/activity-configuration.model';
import { ActivityDomainResultModel } from '../models/activity-result.model';

export const SPACE_CLIMATE_AUTOMATION_PORT = Symbol('SpaceClimateAutomationPort');
/** Internal-only identity, minted by space activation; never accepted from HTTP. */
export interface SpaceActivationIdentity {
	readonly spaceId: string;
	readonly activationId: string;
	readonly configurationRevision: number;
	readonly isCurrent: () => Promise<boolean>;
}
/**
 * Future adapter must resolve presets/ranges/deadband and implement internal owner+baseline CAS,
 * graph/controller fencing and source tombstones before dispatch. It must reject foreign or
 * legacy unowned baselines. Withdrawing a matching baseline is not a general user-state reset.
 * This foundation intentionally registers no adapter and performs no climate startup actuation.
 */
export interface SpaceClimateAutomationPort {
	preview(spaceId: string, selection: ActivityClimateModel): Promise<ActivityDomainResultModel>;
	apply(identity: SpaceActivationIdentity, selection: ActivityClimateModel): Promise<ActivityDomainResultModel>;
	withdraw(identity: SpaceActivationIdentity): Promise<void>;
}
