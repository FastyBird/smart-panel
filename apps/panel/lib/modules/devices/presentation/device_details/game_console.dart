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
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
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

	Color _getAccentColor(bool isDark) {
		if (_isOn) {
			return isDark ? AppColorsDark.info : AppColorsLight.info;
		}
		return isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
	}

	Color _getAccentLightColor(bool isDark) {
		if (_isOn) {
			return isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5;
		}
		return isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
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
		final secondaryColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
		final mutedColor = isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;
		final isOn = _isOn;

		return PageHeader(
			title: _device.name,
			subtitle: _getStatusLabel(localizations),
			subtitleColor: isOn ? accentColor : secondaryColor,
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
							color: isOn
								? _getAccentLightColor(isDark)
								: (isDark ? AppFillColorDark.darker : AppFillColorLight.darker),
							borderRadius: BorderRadius.circular(AppBorderRadius.base),
						),
						child: Icon(
							MdiIcons.gamepadVariant,
							color: isOn ? accentColor : mutedColor,
							size: _scale(24),
						),
					),
				],
			),
			trailing: _device.hasSwitcher
				? GestureDetector(
					onTap: _togglePower,
					child: AnimatedContainer(
						duration: const Duration(milliseconds: 200),
						width: _scale(48),
						height: _scale(32),
						decoration: BoxDecoration(
							color: isOn
								? accentColor
								: (isDark ? AppFillColorDark.light : AppFillColorLight.light),
							borderRadius: BorderRadius.circular(AppBorderRadius.base),
							border: (!isOn && !isDark)
								? Border.all(color: AppBorderColorLight.base, width: _scale(1))
								: null,
						),
						child: Icon(
							MdiIcons.power,
							size: _scale(18),
							color: isOn
								? AppColors.white
								: (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
						),
					),
				)
				: null,
		);
	}

	// --------------------------------------------------------------------------
	// PORTRAIT LAYOUT
	// --------------------------------------------------------------------------

	Widget _buildPortraitLayout(BuildContext context, bool isDark) {
		final accentColor = _getAccentColor(isDark);

		return DevicePortraitLayout(
			content: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					MediaInfoCard(
						icon: MdiIcons.gamepadVariant,
						iconColor: accentColor,
						iconBgColor: _getAccentLightColor(isDark),
						name: _device.name,
						isOn: _isOn,
						accentColor: accentColor,
						scale: _scale,
						playbackTrack: _device.hasMediaPlayback ? _device.isMediaPlaybackTrack : null,
						playbackArtist: _device.hasMediaPlayback ? _device.mediaPlaybackArtist : null,
						playbackAlbum: _device.hasMediaPlayback ? _device.mediaPlaybackAlbum : null,
						playbackStatus: _device.hasMediaPlayback ? _effectivePlaybackStatus : null,
						playbackAvailableCommands: _device.hasMediaPlayback ? _device.mediaPlaybackAvailableCommands : const [],
						playbackHasPosition: _device.hasMediaPlayback && _device.hasMediaPlaybackPosition,
						playbackPosition: _device.hasMediaPlayback ? _device.mediaPlaybackPosition : 0,
						playbackHasDuration: _device.hasMediaPlayback && _device.hasMediaPlaybackDuration,
						playbackDuration: _device.hasMediaPlayback ? _device.mediaPlaybackDuration : 0,
						playbackIsPositionWritable: _device.hasMediaPlayback && (_device.mediaPlaybackChannel?.positionProp?.isWritable ?? false),
						onPlaybackCommand: _device.hasMediaPlayback ? _sendPlaybackCommand : null,
						onPlaybackSeek: _device.hasMediaPlayback ? _seekPosition : null,
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

		return DeviceLandscapeLayout(
			mainContent: Column(
				mainAxisAlignment: MainAxisAlignment.center,
				children: [
					MediaInfoCard(
						icon: MdiIcons.gamepadVariant,
						iconColor: accentColor,
						iconBgColor: _getAccentLightColor(isDark),
						name: _device.name,
						isOn: _isOn,
						accentColor: accentColor,
						scale: _scale,
						playbackTrack: _device.hasMediaPlayback ? _device.isMediaPlaybackTrack : null,
						playbackArtist: _device.hasMediaPlayback ? _device.mediaPlaybackArtist : null,
						playbackAlbum: _device.hasMediaPlayback ? _device.mediaPlaybackAlbum : null,
						playbackStatus: _device.hasMediaPlayback ? _effectivePlaybackStatus : null,
						playbackAvailableCommands: _device.hasMediaPlayback ? _device.mediaPlaybackAvailableCommands : const [],
						playbackHasPosition: _device.hasMediaPlayback && _device.hasMediaPlaybackPosition,
						playbackPosition: _device.hasMediaPlayback ? _device.mediaPlaybackPosition : 0,
						playbackHasDuration: _device.hasMediaPlayback && _device.hasMediaPlaybackDuration,
						playbackDuration: _device.hasMediaPlayback ? _device.mediaPlaybackDuration : 0,
						playbackIsPositionWritable: _device.hasMediaPlayback && (_device.mediaPlaybackChannel?.positionProp?.isWritable ?? false),
						onPlaybackCommand: _device.hasMediaPlayback ? _sendPlaybackCommand : null,
						onPlaybackSeek: _device.hasMediaPlayback ? _seekPosition : null,
					),
				],
			),
			secondaryContent: const SizedBox.shrink(),
		);
	}

}
