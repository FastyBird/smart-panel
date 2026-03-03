import { ConfigService } from '../../config/services/config.service';

import { OAuthCallbackService } from './oauth-callback.service';
import { OAuthFlowService, OAuthTokens } from './oauth-flow.service';

jest.mock('../../config/services/config.service', () => ({
	ConfigService: jest.fn(),
}));

describe('OAuthCallbackService', () => {
	let service: OAuthCallbackService;
	let oauthFlowService: { exchangeCode: jest.Mock };
	let configService: { setPluginConfig: jest.Mock };

	const makeTokens = (overrides: Partial<OAuthTokens> = {}): OAuthTokens => ({
		accessToken: overrides.accessToken ?? 'access-token-123',
		refreshToken: overrides.refreshToken ?? 'refresh-token-456',
		clientId: overrides.clientId ?? 'client-id-abc',
		pluginType: overrides.pluginType ?? 'buddy-claude-plugin',
	});

	beforeEach(() => {
		oauthFlowService = {
			exchangeCode: jest.fn().mockResolvedValue(makeTokens()),
		};

		configService = {
			setPluginConfig: jest.fn(),
		};

		service = new OAuthCallbackService(
			oauthFlowService as unknown as OAuthFlowService,
			configService as unknown as ConfigService,
		);
	});

	describe('handleCallback', () => {
		it('should parse code and state and exchange for tokens', async () => {
			const result = await service.handleCallback('auth-code-xyz', 'state-abc');

			expect(oauthFlowService.exchangeCode).toHaveBeenCalledWith('state-abc', 'auth-code-xyz');
			expect(result.success).toBe(true);
			expect(result.pluginType).toBe('buddy-claude-plugin');
		});

		it('should parse code#state combined in the code param', async () => {
			const result = await service.handleCallback('auth-code-xyz#state-from-hash', '');

			expect(oauthFlowService.exchangeCode).toHaveBeenCalledWith('state-from-hash', 'auth-code-xyz');
			expect(result.success).toBe(true);
		});

		it('should return success with pluginType on successful exchange', async () => {
			const tokens = makeTokens({ pluginType: 'buddy-openai-plugin' });

			oauthFlowService.exchangeCode.mockResolvedValue(tokens);

			const result = await service.handleCallback('code', 'state');

			expect(result).toEqual({ success: true, pluginType: 'buddy-openai-plugin' });
		});

		it('should return error when state is missing and code has no hash fragment', async () => {
			const result = await service.handleCallback('code-only', '');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Missing OAuth state parameter');
			expect(oauthFlowService.exchangeCode).not.toHaveBeenCalled();
		});

		it('should return error when both code and state are empty', async () => {
			const result = await service.handleCallback('', '');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Missing OAuth state parameter');
		});

		it('should return error when token exchange fails', async () => {
			oauthFlowService.exchangeCode.mockRejectedValue(new Error('Token exchange failed: 401'));

			const result = await service.handleCallback('code', 'state');

			expect(result.success).toBe(false);
			expect(result.pluginType).toBe('');
			expect(result.error).toBe('Token exchange failed: 401');
		});

		it('should handle non-Error throw from exchange', async () => {
			oauthFlowService.exchangeCode.mockRejectedValue('string-error');

			const result = await service.handleCallback('code', 'state');

			expect(result.success).toBe(false);
			expect(result.error).toBe('string-error');
		});

		it('should save config with accessToken and refreshToken on success', async () => {
			const tokens = makeTokens({
				accessToken: 'at-123',
				refreshToken: 'rt-456',
				clientId: 'cid',
				pluginType: 'buddy-claude-plugin',
			});

			oauthFlowService.exchangeCode.mockResolvedValue(tokens);

			await service.handleCallback('code', 'state');

			expect(configService.setPluginConfig).toHaveBeenCalledWith('buddy-claude-plugin', {
				type: 'buddy-claude-plugin',
				clientId: 'cid',
				accessToken: 'at-123',
				refreshToken: 'rt-456',
			});
		});

		it('should omit accessToken from config when it is null', async () => {
			const tokens: OAuthTokens = {
				accessToken: null,
				refreshToken: 'rt-456',
				clientId: 'cid',
				pluginType: 'buddy-claude-plugin',
			};

			oauthFlowService.exchangeCode.mockResolvedValue(tokens);

			await service.handleCallback('code', 'state');

			const savedConfig = (configService.setPluginConfig.mock.calls[0] as [string, Record<string, unknown>])[1];

			expect(savedConfig).not.toHaveProperty('accessToken');
			expect(savedConfig.refreshToken).toBe('rt-456');
		});

		it('should omit refreshToken from config when it is null', async () => {
			const tokens: OAuthTokens = {
				accessToken: 'at-123',
				refreshToken: null,
				clientId: 'cid',
				pluginType: 'buddy-claude-plugin',
			};

			oauthFlowService.exchangeCode.mockResolvedValue(tokens);

			await service.handleCallback('code', 'state');

			const savedConfig = (configService.setPluginConfig.mock.calls[0] as [string, Record<string, unknown>])[1];

			expect(savedConfig.accessToken).toBe('at-123');
			expect(savedConfig).not.toHaveProperty('refreshToken');
		});

		it('should not save config when exchange fails', async () => {
			oauthFlowService.exchangeCode.mockRejectedValue(new Error('Exchange failed'));

			await service.handleCallback('code', 'state');

			expect(configService.setPluginConfig).not.toHaveBeenCalled();
		});
	});

	describe('renderCallbackHtml', () => {
		it('should return success HTML with correct message', () => {
			const html = service.renderCallbackHtml(true, 'buddy-claude-plugin');

			expect(html).toContain('Authorization successful!');
			expect(html).toContain('This window will close automatically.');
			expect(html).toContain('"success":true');
			expect(html).toContain('"provider":"buddy-claude-plugin"');
		});

		it('should return failure HTML with error message', () => {
			const html = service.renderCallbackHtml(false, '', 'Token exchange failed');

			expect(html).toContain('Authorization failed: Token exchange failed');
			expect(html).toContain('"success":false');
		});

		it('should escape HTML in error messages', () => {
			const html = service.renderCallbackHtml(false, '', '<script>alert("xss")</script>');

			expect(html).toContain('&lt;script&gt;');
			expect(html).not.toContain('<script>alert("xss")</script>');
		});

		it('should display Unknown error when error is undefined', () => {
			const html = service.renderCallbackHtml(false, '');

			expect(html).toContain('Authorization failed: Unknown error');
		});

		it('should include localStorage setItem call', () => {
			const html = service.renderCallbackHtml(true, 'buddy-claude-plugin');

			expect(html).toContain("localStorage.setItem('oauth-callback'");
		});

		it('should include postMessage for window.opener', () => {
			const html = service.renderCallbackHtml(true, 'buddy-claude-plugin');

			expect(html).toContain('window.opener.postMessage');
		});

		it('should include setTimeout for window.close', () => {
			const html = service.renderCallbackHtml(true, 'buddy-claude-plugin');

			expect(html).toContain('setTimeout');
			expect(html).toContain('window.close()');
		});

		it('should set error to null in JSON message on success', () => {
			const html = service.renderCallbackHtml(true, 'buddy-claude-plugin');

			expect(html).toContain('"error":null');
		});
	});
});
