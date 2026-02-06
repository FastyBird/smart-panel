import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_landscape_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_portrait_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_offline_overlay.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/media_info_card.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/media_playback_card.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/game_console.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class GameConsoleDeviceDetail extends StatefulWidget {
	final GameConsoleDeviceView _device;
	final VoidCallback? onBack;

	const GameConsoleDeviceDetail({
		super.key,
		required GameConsoleDeviceView device,
		this.onBack,
	}) : _device = device;

	@override
	State<GameConsoleDeviceDetail> createState() => _GameConsoleDeviceDetailState();
}

class _GameConsoleDeviceDetailState extends State<GameConsoleDeviceDetail> {
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

	GameConsoleDeviceView get _device {
		final updated = _devicesService.getDevice(widget._device.id);
		if (updated is GameConsoleDeviceView) {
			return updated;
		}
		return widget._device;
	}

	double _scale(double value) =>
		_screenService.scale(value, density: _visualDensityService.density);

	// --------------------------------------------------------------------------
	// COMMAND HELPERS
	// --------------------------------------------------------------------------

	void _togglePower() {
		final switcherChannel = _device.switcherChannel;
		if (switcherChannel == null) return;

		_devicesService.setPropertyValueWithContext(
			deviceId: _device.id,
			channelId: switcherChannel.id,
			propertyId: switcherChannel.onProp.id,
			value: !_device.isSwitcherOn,
		);
	}

	void _sendPlaybackCommand(MediaPlaybackCommandValue command) {
		final channel = _device.mediaPlaybackChannel;
		if (channel == null || !channel.hasCommand) return;

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
		if (channel == null || !channel.hasPosition) return;
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

	bool get _isOn => _device.isOn;

	String _getStatusLabel(AppLocalizations localizations) {
		if (_device.hasSwitcher && !_device.isSwitcherOn) {
			return localizations.on_state_off;
		}
		if (_device.hasMediaPlayback && _device.isMediaPlaybackPlaying) {
			final track = _device.isMediaPlaybackTrack;
			if (track != null) return track;
			return localizations.on_state_on;
		}
		return localizations.on_state_on;
	}

	ThemeColors _getThemeColor() => _isOn ? ThemeColors.primary : ThemeColors.neutral;

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
		final secondaryColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
		final isOn = _isOn;
		final accentColor = isOn
			? ThemeColorFamily.get(isDark ? Brightness.dark : Brightness.light, _getThemeColor()).base
			: secondaryColor;

		return PageHeader(
			title: _device.name,
			subtitle: _getStatusLabel(localizations),
			subtitleColor: accentColor,
			leading: Row(
				mainAxisSize: MainAxisSize.min,
				spacing: AppSpacings.pMd,
				children: [
					HeaderIconButton(
						icon: MdiIcons.arrowLeft,
						onTap: widget.onBack ?? () => Navigator.of(context).pop(),
					),
					HeaderMainIcon(
						icon: buildDeviceIcon(_device.category, _device.icon),
						color: isOn ? ThemeColors.primary : ThemeColors.neutral,
					),
				],
			),
			trailing: _device.hasSwitcher
				? HeaderIconButton(
					icon: MdiIcons.power,
					onTap: _togglePower,
					color: isOn ? ThemeColors.primary : ThemeColors.neutral,
				)
				: null,
		);
	}

	// --------------------------------------------------------------------------
	// PORTRAIT LAYOUT
	// --------------------------------------------------------------------------

	Widget _buildPortraitLayout(BuildContext context, bool isDark) {
		return DevicePortraitLayout(
			content: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				spacing: AppSpacings.pMd,
				children: [
					MediaInfoCard(
						icon: MdiIcons.gamepadVariant,
						name: _device.name,
						isOn: _isOn,
						themeColor: _getThemeColor(),
						scale: _scale,
					),
					if (_device.hasMediaPlayback &&
						MediaPlaybackCard.hasContent(
							playbackTrack: _device.isMediaPlaybackTrack,
							playbackArtist: _device.mediaPlaybackArtist,
							playbackAlbum: _device.mediaPlaybackAlbum,
							playbackAvailableCommands: _device.mediaPlaybackAvailableCommands,
							playbackHasDuration: _device.hasMediaPlaybackDuration,
							playbackDuration: _device.mediaPlaybackDuration,
						))
						MediaPlaybackCard(
							playbackTrack: _device.isMediaPlaybackTrack,
							playbackArtist: _device.mediaPlaybackArtist,
							playbackAlbum: _device.mediaPlaybackAlbum,
							playbackStatus: _effectivePlaybackStatus,
							playbackAvailableCommands: _device.mediaPlaybackAvailableCommands,
							playbackHasPosition: _device.hasMediaPlaybackPosition,
							playbackPosition: _device.mediaPlaybackPosition,
							playbackHasDuration: _device.hasMediaPlaybackDuration,
							playbackDuration: _device.mediaPlaybackDuration,
							playbackIsPositionWritable: _device.mediaPlaybackChannel?.positionProp?.isWritable ?? false,
							onPlaybackCommand: _sendPlaybackCommand,
							onPlaybackSeek: _seekPosition,
							themeColor: _getThemeColor(),
							isEnabled: _isOn,
							scale: _scale,
						),
				],
			),
		);
	}

	// --------------------------------------------------------------------------
	// LANDSCAPE LAYOUT
	// --------------------------------------------------------------------------

	Widget _buildLandscapeLayout(BuildContext context, bool isDark) {
		return DeviceLandscapeLayout(
			mainContent: Column(
				mainAxisAlignment: MainAxisAlignment.center,
				spacing: AppSpacings.pMd,
				children: [
					MediaInfoCard(
						icon: MdiIcons.gamepadVariant,
						name: _device.name,
						isOn: _isOn,
						themeColor: _getThemeColor(),
						scale: _scale,
					),
					if (_device.hasMediaPlayback &&
						MediaPlaybackCard.hasContent(
							playbackTrack: _device.isMediaPlaybackTrack,
							playbackArtist: _device.mediaPlaybackArtist,
							playbackAlbum: _device.mediaPlaybackAlbum,
							playbackAvailableCommands: _device.mediaPlaybackAvailableCommands,
							playbackHasDuration: _device.hasMediaPlaybackDuration,
							playbackDuration: _device.mediaPlaybackDuration,
						))
						MediaPlaybackCard(
							playbackTrack: _device.isMediaPlaybackTrack,
							playbackArtist: _device.mediaPlaybackArtist,
							playbackAlbum: _device.mediaPlaybackAlbum,
							playbackStatus: _effectivePlaybackStatus,
							playbackAvailableCommands: _device.mediaPlaybackAvailableCommands,
							playbackHasPosition: _device.hasMediaPlaybackPosition,
							playbackPosition: _device.mediaPlaybackPosition,
							playbackHasDuration: _device.hasMediaPlaybackDuration,
							playbackDuration: _device.mediaPlaybackDuration,
							playbackIsPositionWritable: _device.mediaPlaybackChannel?.positionProp?.isWritable ?? false,
							onPlaybackCommand: _sendPlaybackCommand,
							onPlaybackSeek: _seekPosition,
							themeColor: _getThemeColor(),
							isEnabled: _isOn,
							scale: _scale,
						),
				],
			),
			secondaryContent: const SizedBox.shrink(),
		);
	}

}
