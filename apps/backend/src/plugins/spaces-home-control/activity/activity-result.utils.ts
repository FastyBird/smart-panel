import { ActivityDomainResultModel } from '../models/activity-result.model';
import { IntentExecutionResult } from '../services/space-intent-base.service';

import { ActivityActivationStatus, ActivityDomain, ActivityDomainStatus } from './space-activity.constants';

export function domainResult(
	domain: ActivityDomain,
	status: ActivityDomainStatus,
	reason: string,
): ActivityDomainResultModel {
	return Object.assign(new ActivityDomainResultModel(), { domain, status, reason: reason.slice(0, 300) });
}
export function intentDomainResult(
	domain: ActivityDomain,
	result: IntentExecutionResult | null,
): ActivityDomainResultModel {
	if (!result) return domainResult(domain, ActivityDomainStatus.FAILED, 'space_or_domain_unavailable');
	if (result.failedDevices || result.skippedOfflineDevices || !result.success)
		return domainResult(
			domain,
			ActivityDomainStatus.FAILED,
			`affected=${result.affectedDevices}; failed=${result.failedDevices}; offline=${result.skippedOfflineDevices ?? 0}`,
		);
	return domainResult(
		domain,
		result.affectedDevices ? ActivityDomainStatus.SUCCEEDED : ActivityDomainStatus.NO_TARGETS,
		`affected=${result.affectedDevices}`,
	);
}
export function activationStatus(results: ActivityDomainResultModel[]): ActivityActivationStatus {
	const failures = results.some((result) =>
		[ActivityDomainStatus.FAILED, ActivityDomainStatus.UNSUPPORTED].includes(result.status),
	);
	if (!failures) return ActivityActivationStatus.ACTIVE;
	return results.some((result) => result.status === ActivityDomainStatus.SUCCEEDED)
		? ActivityActivationStatus.PARTIAL
		: ActivityActivationStatus.FAILED;
}
