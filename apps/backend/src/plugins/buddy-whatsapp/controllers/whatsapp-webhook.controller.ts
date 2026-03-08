import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { BUDDY_WHATSAPP_PLUGIN_API_TAG_NAME, BUDDY_WHATSAPP_PLUGIN_NAME, WhatsAppConnectionStatus } from '../buddy-whatsapp.constants';
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
	private readonly logger = createExtensionLogger(BUDDY_WHATSAPP_PLUGIN_NAME, 'WhatsAppWebhookController');

	constructor(private readonly whatsAppProvider: WhatsAppBotProvider) {}

	@Get('status')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@ApiOperation({
		summary: 'Get WhatsApp connection status and QR code',
		description: 'Returns current connection status and QR code string (only present when status is qr_ready)',
	})
	getStatus(): { status: WhatsAppConnectionStatus; qr: string | null } {
		return {
			status: this.whatsAppProvider.getConnectionStatus(),
			qr: this.whatsAppProvider.getCurrentQr(),
		};
	}

	@Post('logout')
	@Roles(UserRole.OWNER, UserRole.ADMIN)
	@HttpCode(200)
	@ApiOperation({
		summary: 'Disconnect WhatsApp and clear session',
		description: 'Session cleared, new QR code will be generated',
	})
	logout(): { status: string } {
		this.logger.log('WhatsApp logout requested via API');

		this.whatsAppProvider.logout();

		return { status: 'logged_out' };
	}
}
