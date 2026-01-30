import { SecuritySignal } from './security-signal.type';

export interface SecurityStateProviderInterface {
	getKey(): string;
	getSignals(): Promise<SecuritySignal> | SecuritySignal;
}
