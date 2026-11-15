import { ConfigService } from '../../../modules/config/services/config.service';
import { DEVICES_UNIFI_PROTECT_PLUGIN_NAME, ProtectStreamQuality } from '../devices-unifi-protect.constants';
import { ProtectConfigModel } from '../models/config.model';

const FALLBACK_STREAM_QUALITY: ProtectStreamQuality = 'medium';

/** The configured default stream quality; an unreadable or unset configuration falls back to `medium`. */
export const readDefaultStreamQuality = (configService: ConfigService): ProtectStreamQuality => {
	try {
		return (
			configService.getPluginConfig<ProtectConfigModel>(DEVICES_UNIFI_PROTECT_PLUGIN_NAME).defaultStreamQuality ??
			FALLBACK_STREAM_QUALITY
		);
	} catch {
		return FALLBACK_STREAM_QUALITY;
	}
};
