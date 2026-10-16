import { activationStatus, domainResult, intentDomainResult } from './activity-result.utils';
import {
	ActivityDomain as Domain,
	ActivityActivationStatus as State,
	ActivityDomainStatus as Status,
} from './space-activity.constants';

describe('activity domain aggregation', () => {
	it('distinguishes skipped, unsupported and failed outcomes', () => {
		expect(intentDomainResult(Domain.LIGHTING, { success: true, affectedDevices: 0, failedDevices: 0 }).status).toBe(
			Status.NO_TARGETS,
		);
		expect(intentDomainResult(Domain.COVERS, { success: true, affectedDevices: 1, failedDevices: 1 }).status).toBe(
			Status.FAILED,
		);
		expect(
			intentDomainResult(Domain.COVERS, {
				success: true,
				affectedDevices: 1,
				failedDevices: 0,
				skippedOfflineDevices: 1,
			}).status,
		).toBe(Status.FAILED);
		expect(
			activationStatus([
				domainResult(Domain.LIGHTING, Status.SUCCEEDED, ''),
				domainResult(Domain.SECURITY, Status.UNSUPPORTED, ''),
			]),
		).toBe(State.PARTIAL);
		expect(activationStatus([domainResult(Domain.SECURITY, Status.UNSUPPORTED, '')])).toBe(State.FAILED);
	});
});
