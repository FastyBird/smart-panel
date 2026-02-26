import { GatewayTimeoutException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

export class BuddyProviderNotConfiguredException extends ServiceUnavailableException {
	constructor() {
		super('No AI provider is configured. Configure an AI provider in admin settings to enable chat.');
	}
}

export class BuddyProviderTimeoutException extends GatewayTimeoutException {
	constructor() {
		super('AI provider timeout. The provider did not respond in time.');
	}
}

export class BuddyConversationNotFoundException extends NotFoundException {
	constructor(id: string) {
		super(`Conversation with ID "${id}" was not found.`);
	}
}
