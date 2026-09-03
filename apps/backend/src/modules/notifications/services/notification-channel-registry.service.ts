import { Injectable } from '@nestjs/common';

import { INotificationChannel } from '../platforms/notification-channel.platform';

/**
 * Where a channel plugin registers itself, in its own `onModuleInit`, so the dispatcher can fan a
 * notification out to every configured channel without depending on any of their modules.
 *
 * Also answers the dispatcher's loop guard: a channel plugin's own `send()` failures are reported
 * back through {@link import('./notifications.service').NotificationsService.notify}, and
 * `isChannel` is what stops that report from being forwarded to every channel in turn.
 */
@Injectable()
export class NotificationChannelRegistryService {
	private readonly channels = new Map<string, INotificationChannel>();

	register(channel: INotificationChannel): void {
		const type = channel.getType();

		if (this.channels.has(type)) {
			throw new Error(`Notification channel "${type}" is already registered.`);
		}

		this.channels.set(type, channel);
	}

	unregister(type: string): void {
		this.channels.delete(type);
	}

	getChannels(): INotificationChannel[] {
		return Array.from(this.channels.values());
	}

	/** Loop guard: is `source` itself a registered channel type. */
	isChannel(source: string): boolean {
		return this.channels.has(source);
	}
}
