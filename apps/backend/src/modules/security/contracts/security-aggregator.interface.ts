import { SecurityStatusModel } from '../models/security-status.model';

export interface SecurityAggregatorInterface {
	aggregate(): Promise<SecurityStatusModel>;
}
