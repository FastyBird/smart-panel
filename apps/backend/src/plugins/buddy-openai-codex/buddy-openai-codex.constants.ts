export const BUDDY_OPENAI_CODEX_PLUGIN_PREFIX = 'buddy-openai-codex';

export const BUDDY_OPENAI_CODEX_PLUGIN_NAME = 'buddy-openai-codex-plugin';

export const BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_NAME = 'Buddy OpenAI Codex';

export const BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_DESCRIPTION =
	'LLM provider plugin for Buddy module using OpenAI Codex with OAuth authentication.';

export const BUDDY_OPENAI_CODEX_DEFAULT_MODEL = 'codex-mini-latest';

export const BUDDY_OPENAI_CODEX_TOKEN_URL = 'https://auth.openai.com/oauth/token';

export const BUDDY_OPENAI_CODEX_AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';

export const BUDDY_OPENAI_CODEX_DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';

export const BUDDY_OPENAI_CODEX_SCOPES = 'openid profile email offline_access';

// Default redirect URI for the OAuth flow. This must match a URI registered with
// the OAuth provider's application.
export const BUDDY_OPENAI_CODEX_DEFAULT_REDIRECT_URI = 'http://localhost:1455/auth/callback';

// ChatGPT OAuth tokens authenticate against the ChatGPT backend, not api.openai.com.
// This matches the Codex CLI behavior: https://chatgpt.com/backend-api/codex
export const BUDDY_OPENAI_CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex';
