import type { Response } from 'express';

import { Body, Controller, Get, HttpCode, Logger, Post, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { WhatsAppBotProvider } from '../platforms/whatsapp-bot.provider';

/**
 * WhatsApp webhook controller for incoming messages and webhook verification.
 *
 * - GET /webhook — Meta webhook verification (hub.mode, hub.verify_token, hub.challenge)
 * - POST /webhook — incoming message handler
 *
 * This controller is excluded from Swagger documentation because it serves
 * as an external webhook endpoint for the WhatsApp Cloud API, not a user-facing API.
 */
@ApiExcludeController()
@Controller('webhook')
export class WhatsAppWebhookController {
	private readonly logger = new Logger(WhatsAppWebhookController.name);

	constructor(private readonly whatsAppProvider: WhatsAppBotProvider) {}

	/**
	 * Webhook verification endpoint.
	 * Meta sends a GET request with hub.mode, hub.verify_token, and hub.challenge
	 * to verify the webhook URL during registration.
	 */
	@Get()
	verify(
		@Query('hub.mode') mode: string | undefined,
		@Query('hub.verify_token') verifyToken: string | undefined,
		@Query('hub.challenge') challenge: string | undefined,
		@Res() res: Response,
	): void {
		if (mode === 'subscribe' && this.whatsAppProvider.verifyWebhookToken(verifyToken ?? '')) {
			this.logger.log('WhatsApp webhook verified successfully');

			res.status(200).send(challenge ?? '');
		} else {
			this.logger.warn('WhatsApp webhook verification failed');

			res.status(403).send('Forbidden');
		}
	}

	/**
	 * Incoming message handler.
	 * Meta sends a POST request with the webhook payload containing messages,
	 * status updates, and interactive button replies.
	 */
	@Post()
	@HttpCode(200)
	handleIncoming(@Body() body: unknown): string {
		// Fire-and-forget: process asynchronously so the 200 returns immediately.
		// WhatsApp Cloud API expects a fast response and will re-deliver on timeout.
		this.whatsAppProvider.handleWebhookPayload(body).catch((error: unknown) => {
			this.logger.error(`Error processing WhatsApp webhook: ${String(error)}`);
		});

		return 'OK';
	}
}
