import { SecurityStatusModel } from '../models/security-status.model';

export interface AggregationResult {
	status: SecurityStatusModel;
	providerErrors: number;
}

export interface SecurityAggregatorInterface {
	aggregate(): Promise<SecurityStatusModel>;
	aggregateWithErrors(): Promise<AggregationResult>;
}
