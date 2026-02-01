import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/media_activity/media_activity.dart';
import 'package:fastybird_smart_panel/modules/spaces/services/media_activity_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

String _mediaInputSourceLabel(BuildContext context, String source) {
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

class MediaDeviceDetailPage extends StatefulWidget {
	final String spaceId;
	final MediaDeviceGroup deviceGroup;

	const MediaDeviceDetailPage({
		super.key,
		required this.spaceId,
		required this.deviceGroup,
	});

	@override
	State<MediaDeviceDetailPage> createState() => _MediaDeviceDetailPageState();
}

class _MediaDeviceDetailPageState extends State<MediaDeviceDetailPage> {
	final ScreenService _screenService = locator<ScreenService>();
	final VisualDensityService _visualDensityService = locator<VisualDensityService>();

	double _scale(double val) =>
			_screenService.scale(val, density: _visualDensityService.density);

	SocketService? _socketService;
	DevicesService? _devicesService;
	bool _wsConnected = false;

	Timer? _volumeDebounceTimer;

	MediaDeviceGroup get _group => widget.deviceGroup;

	@override
	void initState() {
		super.initState();
		try {
			_socketService = locator<SocketService>();
			_socketService?.addConnectionListener(_onConnectionChanged);
			_wsConnected = _socketService?.isConnected ?? false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDeviceDetailPage] Failed to get SocketService: $e');
			}
		}
		try {
			_devicesService = locator<DevicesService>();
			_devicesService?.addListener(_onDevicesChanged);
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDeviceDetailPage] Failed to get DevicesService: $e');
			}
		}
	}

	@override
	void dispose() {
		_volumeDebounceTimer?.cancel();
		_devicesService?.removeListener(_onDevicesChanged);
		_socketService?.removeConnectionListener(_onConnectionChanged);
		super.dispose();
	}

	void _onDevicesChanged() {
		if (mounted) {
			setState(() {});
		}
	}

	void _onConnectionChanged(bool connected) {
		if (mounted) {
			setState(() => _wsConnected = connected);
		}
	}

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		return Scaffold(
			backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
			appBar: AppBar(
				title: Text(_group.deviceName),
				backgroundColor: AppColors.blank,
				elevation: 0,
			),
			body: Stack(
				children: [
					ListView(
						padding: EdgeInsets.all(AppSpacings.pLg),
						children: [
							// Display controls
							if (_group.hasDisplay) _buildDisplaySection(context, _group.displayEndpoint!),
							// Audio controls
							if (_group.hasAudio) _buildAudioSection(context, _group.audioEndpoint!),
							// Source controls
							if (_group.hasSource) _buildSourceSection(context, _group.sourceEndpoint!),
							// Remote controls
							if (_group.hasRemote) _buildRemoteSection(context),
						],
					),
					if (!_wsConnected) _buildDetailOfflineOverlay(context),
				],
			),
		);
	}

	Widget _buildDetailOfflineOverlay(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;

		return GestureDetector(
			behavior: HitTestBehavior.opaque,
			onTap: () {},
			child: Container(
				color: isDark ? AppBgColorDark.pageOverlay70 : AppBgColorLight.pageOverlay70,
				child: Center(
					child: Card(
						margin: EdgeInsets.all(AppSpacings.pXl + AppSpacings.pMd),
						child: Padding(
							padding: EdgeInsets.all(AppSpacings.pXl),
							child: Column(
								mainAxisSize: MainAxisSize.min,
								children: [
									Icon(MdiIcons.wifiOff, size: _scale(48), color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder),
									AppSpacings.spacingLgVertical,
									Text(
										localizations.media_detail_connection_lost,
										style: Theme.of(context).textTheme.titleMedium,
										textAlign: TextAlign.center,
									),
									AppSpacings.spacingMdVertical,
									Text(
										localizations.media_detail_connection_lost_description,
										style: Theme.of(context).textTheme.bodySmall,
										textAlign: TextAlign.center,
									),
									AppSpacings.spacingLgVertical,
									OutlinedButton(
										onPressed: () => Navigator.of(context).pop(),
										child: Text(localizations.media_detail_go_back),
									),
								],
							),
						),
					),
				),
			),
		);
	}

	Widget _buildDisplaySection(BuildContext context, MediaEndpointModel endpoint) {
		final localizations = AppLocalizations.of(context)!;

		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppBorderRadius.round)),
			child: Padding(
				padding: EdgeInsets.all(AppSpacings.pLg),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: localizations.media_detail_section_display, icon: MdiIcons.television),
						AppSpacings.spacingMdVertical,
						if (endpoint.capabilities.power)
							_buildPowerToggle(context, endpoint),
						if (endpoint.capabilities.input) ...[
							AppSpacings.spacingMdVertical,
							_buildInputRow(context, endpoint),
						],
						if (endpoint.capabilities.volume) ...[
							AppSpacings.spacingMdVertical,
							_buildVolumeRow(context, endpoint),
						],
					],
				),
			),
		);
	}

	Widget _buildAudioSection(BuildContext context, MediaEndpointModel endpoint) {
		final localizations = AppLocalizations.of(context)!;

		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppBorderRadius.round)),
			margin: EdgeInsets.only(top: AppSpacings.pMd),
			child: Padding(
				padding: EdgeInsets.all(AppSpacings.pLg),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: localizations.media_detail_section_audio, icon: MdiIcons.speaker),
						AppSpacings.spacingMdVertical,
						if (endpoint.capabilities.volume)
							_buildVolumeRow(context, endpoint),
						if (endpoint.capabilities.mute) ...[
							AppSpacings.spacingMdVertical,
							_buildMuteToggle(context, endpoint),
						],
						if (endpoint.capabilities.playback) ...[
							AppSpacings.spacingMdVertical,
							_buildPlaybackRow(context, endpoint),
						],
						if (endpoint.capabilities.trackMetadata) ...[
							AppSpacings.spacingMdVertical,
							_buildTrackInfo(context, endpoint),
						],
					],
				),
			),
		);
	}

	Widget _buildSourceSection(BuildContext context, MediaEndpointModel endpoint) {
		final localizations = AppLocalizations.of(context)!;

		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppBorderRadius.round)),
			margin: EdgeInsets.only(top: AppSpacings.pMd),
			child: Padding(
				padding: EdgeInsets.all(AppSpacings.pLg),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: localizations.media_detail_section_source, icon: MdiIcons.playCircle),
						AppSpacings.spacingMdVertical,
						if (endpoint.capabilities.playback)
							_buildPlaybackRow(context, endpoint),
						if (endpoint.capabilities.trackMetadata) ...[
							AppSpacings.spacingMdVertical,
							_buildTrackInfo(context, endpoint),
						],
					],
				),
			),
		);
	}

	Widget _buildRemoteSection(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final remoteEndpoint = _group.remoteEndpoint;

		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppBorderRadius.round)),
			margin: EdgeInsets.only(top: AppSpacings.pMd),
			child: Padding(
				padding: EdgeInsets.all(AppSpacings.pLg),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: localizations.media_detail_section_remote, icon: MdiIcons.remote),
						AppSpacings.spacingMdVertical,
						Center(
							child: Column(
								children: [
									IconButton(
										icon: Icon(MdiIcons.chevronUp, size: _scale(32)),
										onPressed: () => _sendRemoteCommand(remoteEndpoint, 'up'),
									),
									Row(
										mainAxisSize: MainAxisSize.min,
										children: [
											IconButton(
												icon: Icon(MdiIcons.chevronLeft, size: _scale(32)),
												onPressed: () => _sendRemoteCommand(remoteEndpoint, 'left'),
											),
											AppSpacings.spacingMdHorizontal,
											FilledButton(
												onPressed: () => _sendRemoteCommand(remoteEndpoint, 'ok'),
												child: Text(localizations.media_remote_ok),
											),
											AppSpacings.spacingMdHorizontal,
											IconButton(
												icon: Icon(MdiIcons.chevronRight, size: _scale(32)),
												onPressed: () => _sendRemoteCommand(remoteEndpoint, 'right'),
											),
										],
									),
									IconButton(
										icon: Icon(MdiIcons.chevronDown, size: _scale(32)),
										onPressed: () => _sendRemoteCommand(remoteEndpoint, 'down'),
									),
									AppSpacings.spacingMdVertical,
									Row(
										mainAxisAlignment: MainAxisAlignment.center,
										children: [
											TextButton(
												onPressed: () => _sendRemoteCommand(remoteEndpoint, 'back'),
												child: Text(localizations.media_remote_back),
											),
											AppSpacings.spacingLgHorizontal,
											TextButton(
												onPressed: () => _sendRemoteCommand(remoteEndpoint, 'home'),
												child: Text(localizations.media_detail_home),
											),
											AppSpacings.spacingLgHorizontal,
											TextButton(
												onPressed: () => _sendRemoteCommand(remoteEndpoint, 'menu'),
												child: Text(localizations.media_detail_menu),
											),
										],
									),
								],
							),
						),
					],
				),
			),
		);
	}

	Widget _buildPowerToggle(BuildContext context, MediaEndpointModel endpoint) {
		final localizations = AppLocalizations.of(context)!;
		final propId = endpoint.links.powerPropertyId;

		return Row(
			children: [
				Icon(MdiIcons.power, size: _scale(20)),
				AppSpacings.spacingMdHorizontal,
				Text(localizations.media_capability_power),
				const Spacer(),
				FilledButton(
					onPressed: propId != null ? () => _sendCommand(propId, true) : null,
					child: Text(localizations.media_action_power_on),
				),
				AppSpacings.spacingMdHorizontal,
				OutlinedButton(
					onPressed: propId != null ? () => _sendCommand(propId, false) : null,
					child: Text(localizations.media_action_power_off),
				),
			],
		);
	}

	Widget _buildInputRow(BuildContext context, MediaEndpointModel endpoint) {
		final localizations = AppLocalizations.of(context)!;
		final propId = endpoint.links.inputPropertyId;
		String? currentInput;
		List<String> sources = [];

		if (propId != null && _devicesService != null) {
			final prop = _devicesService!.getChannelProperty(propId);
			if (prop?.value is StringValueType) {
				currentInput = (prop!.value as StringValueType).value;
			}
			if (prop?.format is StringListFormatType) {
				sources = (prop!.format as StringListFormatType).value;
			}
		}

		return Row(
			children: [
				Icon(MdiIcons.audioInputStereoMinijack, size: _scale(20)),
				AppSpacings.spacingMdHorizontal,
				Text(localizations.media_detail_input),
				const Spacer(),
				if (currentInput != null)
					Text(
						_mediaInputSourceLabel(context, currentInput),
						style: TextStyle(
							fontSize: AppFontSize.small,
							color: Theme.of(context).brightness == Brightness.dark
									? AppTextColorDark.secondary
									: AppTextColorLight.secondary,
						),
					),
				if (propId != null && sources.isNotEmpty)
					TextButton(
						onPressed: () => _showDetailInputSelector(sources, currentInput, propId),
						child: Text(localizations.media_detail_select),
					)
				else
					TextButton(
						onPressed: null,
						child: Text(localizations.media_detail_select),
					),
			],
		);
	}

	void _showDetailInputSelector(List<String> sources, String? currentValue, String propId) {
		final localizations = AppLocalizations.of(context)!;

		showModalBottomSheet(
			context: context,
			isScrollControlled: true,
			backgroundColor: AppColors.blank,
			builder: (ctx) => ValueSelectorSheet<String>(
				currentValue: currentValue,
				options: sources
						.map((s) => ValueOption<String>(value: s, label: _mediaInputSourceLabel(context, s)))
						.toList(),
				title: localizations.media_input_select_title,
				columns: 3,
				onConfirm: (value) {
					Navigator.pop(ctx);
					if (value != null) {
						_sendCommand(propId, value);
					}
				},
			),
		);
	}

	Widget _buildVolumeRow(BuildContext context, MediaEndpointModel endpoint) {
		final localizations = AppLocalizations.of(context)!;
		final propId = endpoint.links.volumePropertyId;

		int currentVolume = 0;
		if (propId != null && _devicesService != null) {
			final prop = _devicesService!.getChannelProperty(propId);
			if (prop?.value is NumberValueType) {
				currentVolume = (prop!.value as NumberValueType).value.toInt();
			}
		}

		return Row(
			children: [
				Icon(MdiIcons.volumeHigh, size: _scale(20)),
				AppSpacings.spacingMdHorizontal,
				Text(localizations.media_volume),
				AppSpacings.spacingSmHorizontal,
				Text(
					'$currentVolume%',
					style: TextStyle(
						fontSize: AppFontSize.small,
						color: Theme.of(context).brightness == Brightness.dark
								? AppTextColorDark.secondary
								: AppTextColorLight.secondary,
					),
				),
				const Spacer(),
				IconButton(
					icon: Icon(MdiIcons.volumeMinus),
					iconSize: _scale(20),
					onPressed: propId != null
							? () => _sendVolumeStep(propId, currentVolume, -5)
							: null,
				),
				IconButton(
					icon: Icon(MdiIcons.volumePlus),
					iconSize: _scale(20),
					onPressed: propId != null
							? () => _sendVolumeStep(propId, currentVolume, 5)
							: null,
				),
			],
		);
	}

	void _sendVolumeStep(String propId, int currentVolume, int step) {
		final newVolume = (currentVolume + step).clamp(0, 100);

		_volumeDebounceTimer?.cancel();
		_volumeDebounceTimer = Timer(const Duration(milliseconds: 150), () {
			_devicesService?.setPropertyValue(propId, newVolume);
		});
	}

	Widget _buildMuteToggle(BuildContext context, MediaEndpointModel endpoint) {
		final localizations = AppLocalizations.of(context)!;
		final propId = endpoint.links.mutePropertyId;

		return Row(
			children: [
				Icon(MdiIcons.volumeMute, size: _scale(20)),
				AppSpacings.spacingMdHorizontal,
				Text(localizations.media_capability_mute),
				const Spacer(),
				TextButton(
					onPressed: propId != null ? () => _sendCommand(propId, true) : null,
					child: Text(localizations.media_action_mute),
				),
				TextButton(
					onPressed: propId != null ? () => _sendCommand(propId, false) : null,
					child: Text(localizations.media_action_unmute),
				),
			],
		);
	}

	Widget _buildPlaybackRow(BuildContext context, MediaEndpointModel endpoint) {
		final propId = endpoint.links.playbackCommandId;

		return Row(
			mainAxisAlignment: MainAxisAlignment.center,
			children: [
				IconButton(
					icon: Icon(MdiIcons.skipPrevious),
					onPressed: propId != null ? () => _sendCommand(propId, 'previous') : null,
				),
				IconButton(
					icon: Icon(MdiIcons.play),
					iconSize: _scale(32),
					onPressed: propId != null ? () => _sendCommand(propId, 'play') : null,
				),
				IconButton(
					icon: Icon(MdiIcons.pause),
					iconSize: _scale(32),
					onPressed: propId != null ? () => _sendCommand(propId, 'pause') : null,
				),
				IconButton(
					icon: Icon(MdiIcons.stop),
					onPressed: propId != null ? () => _sendCommand(propId, 'stop') : null,
				),
				IconButton(
					icon: Icon(MdiIcons.skipNext),
					onPressed: propId != null ? () => _sendCommand(propId, 'next') : null,
				),
			],
		);
	}

	Widget _buildTrackInfo(BuildContext context, MediaEndpointModel endpoint) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;
		final links = endpoint.links;

		String? trackName;
		String? artistName;
		String? albumName;

		if (links.trackMetadataPropertyId != null && _devicesService != null) {
			final prop = _devicesService!.getChannelProperty(links.trackMetadataPropertyId!);
			if (prop?.value is StringValueType) {
				trackName = (prop!.value as StringValueType).value;
			}
		}
		if (links.artistPropertyId != null && _devicesService != null) {
			final prop = _devicesService!.getChannelProperty(links.artistPropertyId!);
			if (prop?.value is StringValueType) {
				artistName = (prop!.value as StringValueType).value;
			}
		}
		if (links.albumPropertyId != null && _devicesService != null) {
			final prop = _devicesService!.getChannelProperty(links.albumPropertyId!);
			if (prop?.value is StringValueType) {
				albumName = (prop!.value as StringValueType).value;
			}
		}

		final hasData = trackName != null || artistName != null || albumName != null;

		return Container(
			width: double.infinity,
			padding: EdgeInsets.all(AppSpacings.pMd),
			decoration: BoxDecoration(
				color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
				borderRadius: BorderRadius.circular(AppBorderRadius.medium),
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					Text(
						localizations.media_detail_now_playing,
						style: Theme.of(context).textTheme.labelSmall,
					),
					AppSpacings.spacingSmVertical,
					if (!hasData)
						Text(
							localizations.media_detail_no_track_info,
							style: Theme.of(context).textTheme.bodySmall?.copyWith(
								color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
							),
						),
					if (trackName != null)
						Text(
							trackName,
							style: TextStyle(
								fontSize: AppFontSize.small,
								fontWeight: FontWeight.w600,
								color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
							),
							maxLines: 1,
							overflow: TextOverflow.ellipsis,
						),
					if (artistName != null || albumName != null)
						Text(
							[artistName, albumName].whereType<String>().join(' \u2014 '),
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
							),
							maxLines: 1,
							overflow: TextOverflow.ellipsis,
						),
				],
			),
		);
	}

	void _sendCommand(String propertyId, dynamic value) {
		_devicesService?.setPropertyValue(propertyId, value);
	}

	void _sendRemoteCommand(MediaEndpointModel? endpoint, String command) {
		if (endpoint == null || _devicesService == null) return;

		final propId = endpoint.links.remotePropertyId;
		if (propId != null) {
			_devicesService!.setPropertyValue(propId, command);
		}
	}
}
