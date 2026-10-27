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
 * Internal activity bridge. The application registers the producer through its Nest lifecycle.
 * Provider installation uses native source/slot/incarnation evidence and the original manager/receipt.
 * Withdrawing a matching baseline is not a general user-state reset; missing providers refuse installation.
 */
export interface SpaceClimateAutomationPort {
	preview(spaceId: string, selection: ActivityClimateModel): Promise<ActivityDomainResultModel>;
	apply(identity: SpaceActivationIdentity, selection: ActivityClimateModel): Promise<ActivityDomainResultModel>;
	withdraw(identity: SpaceActivationIdentity): Promise<void>;
}
