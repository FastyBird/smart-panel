import { Injectable, Logger } from '@nestjs/common';

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
	private readonly logger = new Logger(BackupContributionRegistry.name);

	private readonly contributions: BackupContributionRegistration[] = [];

	register(contribution: BackupContributionRegistration): void {
		this.contributions.push(contribution);
	}

	/**
	 * Raw registrations (with lazy callbacks unresolved) — for callers that need to
	 * resolve paths at a specific moment rather than all at once. Used by restore()
	 * so lazy callbacks read the filesystem AFTER any preceding static-path
	 * contributions have been written (e.g. buddy's personality path reading from
	 * the already-restored config file, not the pre-restore one).
	 */
	getRegistrations(): readonly BackupContributionRegistration[] {
		return this.contributions;
	}

	getContributions(): BackupContribution[] {
		const resolved: BackupContribution[] = [];

		for (const contribution of this.contributions) {
			try {
				const path = typeof contribution.path === 'function' ? contribution.path() : contribution.path;

				resolved.push({
					source: contribution.source,
					label: contribution.label,
					type: contribution.type,
					path,
					optional: contribution.optional,
				});
			} catch (error) {
				// Isolate per-contribution resolution so one broken callback (e.g. an
				// optional module with an invalid user-configured path) doesn't abort
				// every backup. Propagate only for non-optional entries.
				if (!contribution.optional) {
					throw error;
				}

				const err = error as Error;

				this.logger.warn(
					`Skipping optional contribution ${contribution.label} (${contribution.source}): ${err.message}`,
				);
			}
		}

		return resolved;
	}
}
