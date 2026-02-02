import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/widgets.dart';

String mediaInputSourceLabel(BuildContext context, String source) {
	final localizations = AppLocalizations.of(context)!;
	final key = 'media_input_$source';
	switch (key) {
		case 'media_input_hdmi1': return localizations.media_input_hdmi1;
		case 'media_input_hdmi2': return localizations.media_input_hdmi2;
		case 'media_input_hdmi3': return localizations.media_input_hdmi3;
		case 'media_input_hdmi4': return localizations.media_input_hdmi4;
		case 'media_input_hdmi5': return localizations.media_input_hdmi5;
		case 'media_input_hdmi6': return localizations.media_input_hdmi6;
		case 'media_input_arc': return localizations.media_input_arc;
		case 'media_input_earc': return localizations.media_input_earc;
		case 'media_input_tv': return localizations.media_input_tv;
		case 'media_input_cable': return localizations.media_input_cable;
		case 'media_input_satellite': return localizations.media_input_satellite;
		case 'media_input_antenna': return localizations.media_input_antenna;
		case 'media_input_av1': return localizations.media_input_av1;
		case 'media_input_av2': return localizations.media_input_av2;
		case 'media_input_component': return localizations.media_input_component;
		case 'media_input_vga': return localizations.media_input_vga;
		case 'media_input_dvi': return localizations.media_input_dvi;
		case 'media_input_usb': return localizations.media_input_usb;
		case 'media_input_bluetooth': return localizations.media_input_bluetooth;
		case 'media_input_wifi': return localizations.media_input_wifi;
		case 'media_input_airplay': return localizations.media_input_airplay;
		case 'media_input_cast': return localizations.media_input_cast;
		case 'media_input_dlna': return localizations.media_input_dlna;
		case 'media_input_miracast': return localizations.media_input_miracast;
		case 'media_input_app_netflix': return localizations.media_input_app_netflix;
		case 'media_input_app_youtube': return localizations.media_input_app_youtube;
		case 'media_input_app_spotify': return localizations.media_input_app_spotify;
		case 'media_input_app_prime_video': return localizations.media_input_app_prime_video;
		case 'media_input_app_disney_plus': return localizations.media_input_app_disney_plus;
		case 'media_input_app_hbo_max': return localizations.media_input_app_hbo_max;
		case 'media_input_app_apple_tv': return localizations.media_input_app_apple_tv;
		case 'media_input_app_plex': return localizations.media_input_app_plex;
		case 'media_input_app_kodi': return localizations.media_input_app_kodi;
		case 'media_input_other': return localizations.media_input_other;
		default: return source;
	}
}
