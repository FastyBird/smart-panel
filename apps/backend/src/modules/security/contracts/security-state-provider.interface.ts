import { SecurityAggregationContext } from './security-aggregation-context.type';
import { SecuritySignal } from './security-signal.type';

export interface SecurityStateProviderInterface {
	getKey(): string;
	getSignals(context?: SecurityAggregationContext): Promise<SecuritySignal> | SecuritySignal;
}
