import { Injectable } from '@nestjs/common';

import { StatsProvider } from '../stats.interfaces';

@Injectable()
export class StatsRegistryService {
	private readonly providers = new Map<string, StatsProvider>();

	register(name: string, provider: StatsProvider): void {
		if (this.providers.has(name)) {
			throw new Error(`Stats provider "${name}" is already registered.`);
		}

		this.providers.set(name, provider);
	}

	get(): { name: string; provider: StatsProvider }[] {
		return Array.from(this.providers.entries()).map(([name, provider]) => ({
			name,
			provider,
		}));
	}

	has(name: string): boolean {
		return this.providers.has(name);
	}
}
