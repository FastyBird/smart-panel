import { Injectable } from '@nestjs/common';

export type BackupContributionType = 'file' | 'directory';

/**
 * `path` accepts either a literal string or a callback that resolves the path
 * at backup/restore time. The callback form is required for modules whose
 * paths are user-configurable (e.g. buddy personality) — registering the
 * default at module init would diverge from the live configured path.
 */
export interface BackupContributionRegistration {
	source: string;
	label: string;
	type: BackupContributionType;
	path: string | (() => string);
	optional: boolean;
}

export interface BackupContribution {
	source: string;
	label: string;
	type: BackupContributionType;
	path: string;
	optional: boolean;
}

@Injectable()
export class BackupContributionRegistry {
	private readonly contributions: BackupContributionRegistration[] = [];

	register(contribution: BackupContributionRegistration): void {
		this.contributions.push(contribution);
	}

	getContributions(): BackupContribution[] {
		return this.contributions.map((contribution) => ({
			source: contribution.source,
			label: contribution.label,
			type: contribution.type,
			path: typeof contribution.path === 'function' ? contribution.path() : contribution.path,
			optional: contribution.optional,
		}));
	}
}
