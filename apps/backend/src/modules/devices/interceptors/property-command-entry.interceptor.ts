import { Observable, finalize } from 'rxjs';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

import { PropertyCommandEntrySnapshot } from '../services/property-command-entry-snapshot';
import { PropertyCommandService } from '../services/property-command.service';

const entryKey = Symbol('server-command-entry');
type EntryRequest = { [entryKey]?: PropertyCommandEntrySnapshot };

/** An HTTP body cannot forge this server-owned request slot. */
export const readPropertyCommandEntry = (request?: object): PropertyCommandEntrySnapshot | undefined => {
	const entry = (request as EntryRequest | undefined)?.[entryKey];
	return entry instanceof PropertyCommandEntrySnapshot ? entry : undefined;
};

@Injectable()
export class PropertyCommandEntryInterceptor implements NestInterceptor {
	constructor(private readonly commands: PropertyCommandService) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request = context.switchToHttp().getRequest<EntryRequest>();
		const entry = this.commands.captureCommandEntry();
		if (entry) request[entryKey] = entry;
		try {
			return next.handle().pipe(
				finalize(() => {
					delete request[entryKey];
					this.commands.releaseCommandEntry(entry);
				}),
			);
		} catch (error) {
			delete request[entryKey];
			this.commands.releaseCommandEntry(entry);
			throw error;
		}
	}
}
