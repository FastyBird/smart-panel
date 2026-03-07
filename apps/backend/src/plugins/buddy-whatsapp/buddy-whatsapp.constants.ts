export const BUDDY_WHATSAPP_PLUGIN_PREFIX = 'buddy-whatsapp';

export const BUDDY_WHATSAPP_PLUGIN_NAME = 'buddy-whatsapp-plugin';

export const BUDDY_WHATSAPP_PLUGIN_API_TAG_NAME = 'Buddy WhatsApp';

export const BUDDY_WHATSAPP_PLUGIN_API_TAG_DESCRIPTION = 'WhatsApp adapter plugin for Buddy module.';

export const WHATSAPP_AUTH_DIR = 'var/buddy/whatsapp-auth';

export const WHATSAPP_RECONNECT_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000]; // exponential backoff

export const WHATSAPP_MAX_RECONNECT_ATTEMPTS = 10;

export enum WhatsAppConnectionStatus {
	DISCONNECTED = 'disconnected',
	CONNECTING = 'connecting',
	QR_READY = 'qr_ready',
	CONNECTED = 'connected',
}
