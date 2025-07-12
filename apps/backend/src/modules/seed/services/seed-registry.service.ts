import { Injectable } from '@nestjs/common';

type DataSeeder = () => Promise<void>;

@Injectable()
export class SeedRegistryService {
	private readonly seeders = new Map<string, { seeder: DataSeeder; priority: number }>();

	register(name: string, seeder: DataSeeder, priority: number): void {
		if (this.seeders.has(name)) {
			throw new Error(`Seeder seeder "${name}" is already registered.`);
		}

		this.seeders.set(name, { seeder, priority });
	}

	get(): { name: string; seeder: DataSeeder; priority: number }[] {
		return Array.from(this.seeders.entries()).map(([name, { seeder, priority }]) => ({
			name,
			seeder,
			priority,
		}));
	}

	has(name: string): boolean {
		return this.seeders.has(name);
	}
}
