import { Injectable, Logger } from '@nestjs/common';

import { UpdatePluginConfigDto } from '../../config/dto/config.dto';
import { ConfigService } from '../../config/services/config.service';

import { OAuthFlowService } from './oauth-flow.service';

@Injectable()
export class OAuthCallbackService {
	private readonly logger = new Logger(OAuthCallbackService.name);

	constructor(
		private readonly oauthFlowService: OAuthFlowService,
		private readonly configService: ConfigService,
	) {}

	async handleCallback(code: string, state: string): Promise<{ success: boolean; pluginType: string; error?: string }> {
		try {
			// Claude may return code#state combined in the code param
			let resolvedCode = code;
			let resolvedState = state;

			if (code && code.includes('#')) {
				const parts = code.split('#');

				resolvedCode = parts[0];
				resolvedState = parts[1];
			}

			if (!resolvedState) {
				return { success: false, pluginType: '', error: 'Missing OAuth state parameter' };
			}

			const tokens = await this.oauthFlowService.exchangeCode(resolvedState, resolvedCode);

			const updateData: Record<string, unknown> = {
				type: tokens.pluginType,
				clientId: tokens.clientId,
			};

			if (tokens.accessToken) {
				updateData.accessToken = tokens.accessToken;
			}

			if (tokens.refreshToken) {
				updateData.refreshToken = tokens.refreshToken;
			}

			this.configService.setPluginConfig(tokens.pluginType, updateData as unknown as UpdatePluginConfigDto);

			this.logger.log(`OAuth tokens saved for plugin=${tokens.pluginType}`);

			return { success: true, pluginType: tokens.pluginType };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);

			this.logger.error(`OAuth callback failed: ${message}`);

			return { success: false, pluginType: '', error: message };
		}
	}

	renderCallbackHtml(success: boolean, pluginType: string, error?: string): string {
		const message = JSON.stringify({
			type: 'oauth-callback',
			provider: pluginType,
			success,
			error: error ?? null,
		});

		// Escape for safe embedding in HTML text content
		const escapeHtml = (str: string): string =>
			str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

		// Escape </script> sequences for safe embedding inside <script> tags
		const safeMessage = message.replace(/<\//g, '<\\/');
		// Additionally escape single quotes for safe embedding inside a JS single-quoted string
		const safeMessageStr = safeMessage.replace(/'/g, '\\u0027');

		const statusText = success
			? 'Authorization successful! This window will close automatically.'
			: `Authorization failed: ${escapeHtml(error ?? 'Unknown error')}`;

		return `<!DOCTYPE html>
<html>
<head><title>OAuth Callback</title></head>
<body>
<p>${statusText}</p>
<script>
try {
	localStorage.setItem('oauth-callback', '${safeMessageStr}');
} catch (e) {}
if (window.opener) {
	try { window.opener.postMessage(${safeMessage}, window.location.origin); } catch (e) {}
}
setTimeout(function() { window.close(); }, 1500);
</script>
</body>
</html>`;
	}
}
