import { Injectable } from '@nestjs/common';

import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../dto/client-user.dto';

/**
 * The socket a command came from, as far as a handler may use it: it can put the socket into a room, so
 * events sent to that room with `WebsocketGateway.sendToRoom` reach it, and take it out again. A socket
 * leaves its rooms by itself when it disconnects.
 */
export interface CommandClient {
	id: string;
	join(room: string): Promise<void>;
	leave(room: string): Promise<void>;
}

type CommandEventHandler = (
	user: ClientUserDto,
	payload: unknown,
	client?: CommandClient,
) => Promise<{ success: boolean; reason?: string } | null>;

interface RegisteredHandler {
	handler: CommandEventHandler;
	requiredRoles?: UserRole[];
}

@Injectable()
export class CommandEventRegistryService {
	private readonly events = new Map<string, Map<string, RegisteredHandler>>();

	register(event: string, name: string, handler: CommandEventHandler, requiredRoles?: UserRole[]): void {
		if (!this.events.has(event)) {
			this.events.set(event, new Map<string, RegisteredHandler>());
		}

		if (this.events.get(event).has(name)) {
			throw new Error(`Command event handler "${name}" for event "${event}" is already registered.`);
		}

		this.events.get(event).set(name, { handler, requiredRoles });
	}

	get(event: string): { name: string; handler: CommandEventHandler; requiredRoles?: UserRole[] }[] {
		const handlers = this.events.get(event);

		if (!handlers) {
			return [];
		}

		return Array.from(handlers.entries()).map(([name, entry]) => ({
			name,
			handler: entry.handler,
			requiredRoles: entry.requiredRoles,
		}));
	}

	has(event: string): boolean {
		return this.events.has(event);
	}
}
