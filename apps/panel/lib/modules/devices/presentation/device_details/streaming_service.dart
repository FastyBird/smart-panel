import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_landscape_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_portrait_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/device_offline_overlay.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/media_info_card.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/streaming_service.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class StreamingServiceDeviceDetail extends StatefulWidget {
	final StreamingServiceDeviceView _device;
	final VoidCallback? onBack;

	const StreamingServiceDeviceDetail({
		super.key,
		required StreamingServiceDeviceView device,
		this.onBack,
	}) : _device = device;

	@override
	State<StreamingServiceDeviceDetail> createState() => _StreamingServiceDeviceDetailState();
}

class _StreamingServiceDeviceDetailState extends State<StreamingServiceDeviceDetail> {
	final ScreenService _screenService = locator<ScreenService>();
	final VisualDensityService _visualDensityService = locator<VisualDensityService>();
	final DevicesService _devicesService = locator<DevicesService>();

	Timer? _playbackSettleTimer;
	MediaPlaybackStatusValue? _optimisticPlaybackStatus;

	@override
	void initState() {
		super.initState();
		_devicesService.addListener(_onDeviceChanged);
	}

	@override
	void dispose() {
		_playbackSettleTimer?.cancel();
		_devicesService.removeListener(_onDeviceChanged);
		super.dispose();
	}

	void _onDeviceChanged() {
		if (!mounted) return;
		if (_playbackSettleTimer != null && _playbackSettleTimer!.isActive) return;
		setState(() {});
	}

	StreamingServiceDeviceView get _device {
		final updated = _devicesService.getDevice(widget._device.id);
		if (updated is StreamingServiceDeviceView) {
			return updated;
		}
		return widget._device;
	}

	double _scale(double value) =>
		_screenService.scale(value, density: _visualDensityService.density);

	// --------------------------------------------------------------------------
	// COMMAND HELPERS
	// --------------------------------------------------------------------------

	void _sendPlaybackCommand(MediaPlaybackCommandValue command) {
		final channel = _device.mediaPlaybackChannel;
		if (!channel.hasCommand) return;

		final optimisticStatus = switch (command) {
			MediaPlaybackCommandValue.play => MediaPlaybackStatusValue.playing,
			MediaPlaybackCommandValue.pause => MediaPlaybackStatusValue.paused,
			MediaPlaybackCommandValue.stop => MediaPlaybackStatusValue.stopped,
			_ => null,
		};

		if (optimisticStatus != null) {
			setState(() => _optimisticPlaybackStatus = optimisticStatus);
		}

		_playbackSettleTimer?.cancel();
		_playbackSettleTimer = Timer(const Duration(seconds: 3), () {
			if (!mounted) return;
			setState(() => _optimisticPlaybackStatus = null);
		});

		_devicesService.setPropertyValueWithContext(
			deviceId: _device.id,
			channelId: channel.id,
			propertyId: channel.commandProp!.id,
			value: command.value,
		);
	}

	void _seekPosition(int position) {
		final channel = _device.mediaPlaybackChannel;
		if (!channel.hasPosition) return;
		final prop = channel.positionProp;
		if (prop == null || !prop.isWritable) return;

		_devicesService.setPropertyValueWithContext(
			deviceId: _device.id,
			channelId: channel.id,
			propertyId: prop.id,
			value: position,
		);
	}

	// --------------------------------------------------------------------------
	// UI HELPERS
	// --------------------------------------------------------------------------

	MediaPlaybackStatusValue? get _effectivePlaybackStatus =>
		_optimisticPlaybackStatus ?? _device.mediaPlaybackStatus;

	String _getStatusLabel(AppLocalizations localizations) {
		if (_device.isMediaPlaybackPlaying) {
			final track = _device.isMediaPlaybackTrack;
			if (track != null) return track;
			return localizations.media_playing;
		}
		final status = _device.mediaPlaybackStatus;
		if (status == MediaPlaybackStatusValue.paused || status == MediaPlaybackStatusValue.stopped) {
			return localizations.media_idle;
		}
		return localizations.on_state_on;
	}

	Color _getAccentColor(bool isDark) {
		return isDark ? AppColorsDark.info : AppColorsLight.info;
	}

	Color _getAccentLightColor(bool isDark) {
		return isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5;
	}

	// --------------------------------------------------------------------------
	// BUILD
	// --------------------------------------------------------------------------

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;

		final lastSeenText = widget._device.lastStateChange != null
			? DatetimeUtils.formatTimeAgo(widget._device.lastStateChange!, localizations)
			: null;

		return Scaffold(
			backgroundColor: isDark ? AppBgColorDark.base : AppBgColorLight.page,
			body: SafeArea(
				child: Column(
					children: [
						_buildHeader(context, isDark),
						Expanded(
							child: Stack(
								children: [
									OrientationBuilder(
										builder: (context, orientation) {
											return orientation == Orientation.landscape
												? _buildLandscapeLayout(context, isDark)
												: _buildPortraitLayout(context, isDark);
										},
									),
									if (!widget._device.isOnline)
										DeviceOfflineState(
											isDark: isDark,
											lastSeenText: lastSeenText,
										),
								],
							),
						),
					],
				),
			),
		);
	}

	Widget _buildHeader(BuildContext context, bool isDark) {
		final localizations = AppLocalizations.of(context)!;
		final accentColor = _getAccentColor(isDark);

		return PageHeader(
			title: _device.name,
			subtitle: _getStatusLabel(localizations),
			subtitleColor: accentColor,
			backgroundColor: AppColors.blank,
			leading: Row(
				mainAxisSize: MainAxisSize.min,
				children: [
					HeaderIconButton(
						icon: MdiIcons.arrowLeft,
						onTap: widget.onBack ?? () => Navigator.of(context).pop(),
					),
					AppSpacings.spacingMdHorizontal,
					Container(
						width: _scale(44),
						height: _scale(44),
						decoration: BoxDecoration(
							color: _getAccentLightColor(isDark),
							borderRadius: BorderRadius.circular(AppBorderRadius.medium),
						),
						child: Icon(
							MdiIcons.playNetwork,
							color: accentColor,
							size: _scale(24),
						),
					),
				],
			),
		);
	}

	// --------------------------------------------------------------------------
	// PORTRAIT LAYOUT
	// --------------------------------------------------------------------------

	Widget _buildPortraitLayout(BuildContext context, bool isDark) {
		final accentColor = _getAccentColor(isDark);

		return DeviceDetailPortraitLayout(
			content: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					MediaInfoCard(
						icon: MdiIcons.playNetwork,
						iconColor: accentColor,
						iconBgColor: _getAccentLightColor(isDark),
						name: _device.name,
						isOn: true,
						accentColor: accentColor,
						scale: _scale,
						playbackTrack: _device.isMediaPlaybackTrack,
						playbackArtist: _device.mediaPlaybackArtist,
						playbackAlbum: _device.mediaPlaybackAlbum,
						playbackStatus: _effectivePlaybackStatus,
						playbackAvailableCommands: _device.mediaPlaybackAvailableCommands,
						playbackHasPosition: _device.hasMediaPlaybackPosition,
						playbackPosition: _device.mediaPlaybackPosition,
						playbackHasDuration: _device.hasMediaPlaybackDuration,
						playbackDuration: _device.mediaPlaybackDuration,
						playbackIsPositionWritable: _device.mediaPlaybackChannel.positionProp?.isWritable ?? false,
						onPlaybackCommand: _sendPlaybackCommand,
						onPlaybackSeek: _seekPosition,
					),
				],
			),
		);
	}

	// --------------------------------------------------------------------------
	// LANDSCAPE LAYOUT
	// --------------------------------------------------------------------------

	Widget _buildLandscapeLayout(BuildContext context, bool isDark) {
		final accentColor = _getAccentColor(isDark);

		return DeviceDetailLandscapeLayout(
			mainContent: Column(
				mainAxisAlignment: MainAxisAlignment.center,
				children: [
					MediaInfoCard(
						icon: MdiIcons.playNetwork,
						iconColor: accentColor,
						iconBgColor: _getAccentLightColor(isDark),
						name: _device.name,
						isOn: true,
						accentColor: accentColor,
						scale: _scale,
						playbackTrack: _device.isMediaPlaybackTrack,
						playbackArtist: _device.mediaPlaybackArtist,
						playbackAlbum: _device.mediaPlaybackAlbum,
						playbackStatus: _effectivePlaybackStatus,
						playbackAvailableCommands: _device.mediaPlaybackAvailableCommands,
						playbackHasPosition: _device.hasMediaPlaybackPosition,
						playbackPosition: _device.mediaPlaybackPosition,
						playbackHasDuration: _device.hasMediaPlaybackDuration,
						playbackDuration: _device.mediaPlaybackDuration,
						playbackIsPositionWritable: _device.mediaPlaybackChannel.positionProp?.isWritable ?? false,
						onPlaybackCommand: _sendPlaybackCommand,
						onPlaybackSeek: _seekPosition,
					),
				],
			),
			secondaryContent: const SizedBox.shrink(),
		);
	}

}
