import { Injectable } from '@nestjs/common';

export interface BackupContribution {
	source: string;
	label: string;
	type: 'file' | 'directory';
	path: string;
	optional: boolean;
}

@Injectable()
export class BackupContributionRegistry {
	private readonly contributions: BackupContribution[] = [];

	register(contribution: BackupContribution): void {
		this.contributions.push(contribution);
	}

	getContributions(): BackupContribution[] {
		return [...this.contributions];
	}
}
