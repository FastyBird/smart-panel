import { Injectable } from '@nestjs/common';

import { ClientUserDto } from '../dto/client-user.dto';

type CommandEventHandler = (user: ClientUserDto, payload: any) => Promise<{ success: boolean; reason?: any } | null>;

@Injectable()
export class CommandEventRegistryService {
	private readonly events = new Map<string, { name: string; handler: CommandEventHandler }[]>();

	register(event: string, name: string, handler: CommandEventHandler): void {
		if (!this.events.has(event)) {
			this.events.set(event, []);
		}
		this.events.get(event).push({ name, handler });
	}

	get(event: string): { name: string; handler: CommandEventHandler }[] {
		return this.events.get(event) || [];
	}

	has(event: string): boolean {
		return this.events.has(event);
	}
}
