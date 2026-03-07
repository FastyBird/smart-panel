import { Controller, Get, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { BUDDY_WHATSAPP_PLUGIN_API_TAG_NAME, WhatsAppConnectionStatus } from '../buddy-whatsapp.constants';
import { WhatsAppBotProvider } from '../platforms/whatsapp-bot.provider';

/**
 * WhatsApp bot status and control endpoints.
 *
 * - GET /status — current connection status and QR code (if available)
 * - POST /logout — disconnect and clear session to generate a new QR
 */
@ApiTags(BUDDY_WHATSAPP_PLUGIN_API_TAG_NAME)
@Controller()
export class WhatsAppWebhookController {
	private readonly logger = new Logger(WhatsAppWebhookController.name);

	constructor(private readonly whatsAppProvider: WhatsAppBotProvider) {}

	@Get('status')
	@ApiOperation({ summary: 'Get WhatsApp connection status and QR code' })
	@ApiResponse({
		status: 200,
		description: 'Current connection status',
		schema: {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					enum: Object.values(WhatsAppConnectionStatus),
				},
				qr: {
					type: 'string',
					nullable: true,
					description: 'QR code string to render (only present when status is qr_ready)',
				},
			},
		},
	})
	getStatus(): { status: WhatsAppConnectionStatus; qr: string | null } {
		return {
			status: this.whatsAppProvider.getConnectionStatus(),
			qr: this.whatsAppProvider.getCurrentQr(),
		};
	}

	@Post('logout')
	@HttpCode(200)
	@ApiOperation({ summary: 'Disconnect WhatsApp and clear session' })
	@ApiResponse({ status: 200, description: 'Session cleared, new QR code will be generated' })
	async logout(): Promise<{ status: string }> {
		this.logger.log('WhatsApp logout requested via API');

		await this.whatsAppProvider.logout();

		return { status: 'logged_out' };
	}
}
