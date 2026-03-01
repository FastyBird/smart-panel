import {
	BadRequestException,
	GatewayTimeoutException,
	NotFoundException,
	PayloadTooLargeException,
	ServiceUnavailableException,
	UnsupportedMediaTypeException,
} from '@nestjs/common';

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

export class BuddySuggestionNotFoundException extends NotFoundException {
	constructor(id: string) {
		super(`Suggestion with ID "${id}" was not found.`);
	}
}

export class BuddySttNotConfiguredException extends ServiceUnavailableException {
	constructor() {
		super('No STT provider is configured. Configure an STT provider in admin settings to enable voice input.');
	}
}

export class BuddyAudioTooLargeException extends PayloadTooLargeException {
	constructor(maxSizeMb: number) {
		super(`Audio file exceeds maximum allowed size of ${maxSizeMb} MB.`);
	}
}

export class BuddyAudioUnsupportedFormatException extends UnsupportedMediaTypeException {
	constructor() {
		super('Unsupported audio format. Accepted formats: WAV, WebM, OGG, MP3.');
	}
}

export class BuddyAudioMissingException extends BadRequestException {
	constructor() {
		super('No audio file provided. Upload an audio file in the "audio" field.');
	}
}

export class BuddyTranscriptionEmptyException extends BadRequestException {
	constructor() {
		super('No speech was detected in the audio. Please try again and speak clearly.');
	}
}
