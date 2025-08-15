import { Injectable } from '@nestjs/common';

type FactoryResetHandler = () => Promise<{ success: boolean; reason?: string } | null>;

@Injectable()
export class FactoryResetRegistryService {
	private readonly handlers = new Map<string, { priority: number; handler: FactoryResetHandler }>();

	register(name: string, handler: FactoryResetHandler, priority: number): void {
		if (this.handlers.has(name)) {
			throw new Error(`Factory reset handler "${name}" is already registered.`);
		}

		this.handlers.set(name, { priority, handler });
	}

	get(): { name: string; handler: FactoryResetHandler; priority: number }[] {
		return Array.from(this.handlers.entries()).map(([name, { priority, handler }]) => ({
			name,
			priority,
			handler,
		}));
	}

	has(name: string): boolean {
		return this.handlers.has(name);
	}
}
