import { ShellyCoverSession } from '../services/shelly-cover-session';

/** Internal provider lease; a public context or operator acknowledgement is never command evidence. */
export interface CoverRecoveryTarget {
	readonly physicalIdentity: string;
	readonly revision: string;
	isCurrent(): boolean;
	retire(): void;
	begin(): {
		session: ShellyCoverSession;
		isCurrent(): boolean;
		install(): void;
		dispose(): void;
	};
}
