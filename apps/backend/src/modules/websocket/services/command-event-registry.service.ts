import { Injectable } from '@nestjs/common';

import { ClientUserDto } from '../dto/client-user.dto';

type CommandEventHandler = (user: ClientUserDto, payload: any) => Promise<{ success: boolean; reason?: string } | null>;

@Injectable()
export class CommandEventRegistryService {
	private readonly events = new Map<string, Map<string, CommandEventHandler>>();

	register(event: string, name: string, handler: CommandEventHandler): void {
		if (!this.events.has(event)) {
			this.events.set(event, new Map<string, CommandEventHandler>());
		}

		if (this.events.get(event).has(name)) {
			throw new Error(`Command event handler "${name}" for event "${event}" is already registered.`);
		}

		this.events.get(event).set(name, handler);
	}

	get(event: string): { name: string; handler: CommandEventHandler }[] {
		const handlers = this.events.get(event);

		if (!handlers) {
			return [];
		}

		return Array.from(handlers.entries()).map(([name, handler]) => ({
			name,
			handler,
		}));
	}

	has(event: string): boolean {
		return this.events.has(event);
	}
}
