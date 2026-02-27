import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';

export class BuddyProviderNotConfiguredException extends HttpException {
	constructor() {
		super(
			'No AI provider is configured. Configure an AI provider in admin settings to enable chat.',
			HttpStatus.SERVICE_UNAVAILABLE,
		);
	}
}

export class BuddyConversationNotFoundException extends NotFoundException {
	constructor(id: string) {
		super(`Buddy conversation with ID "${id}" was not found.`);
	}
}
