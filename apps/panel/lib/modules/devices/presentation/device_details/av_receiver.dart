import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_landscape_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_portrait_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_offline_overlay.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/media_input_source_label.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/media_info_card.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/media_playback_card.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/media_source_select_card.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/media_volume_card.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/av_receiver.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class AvReceiverDeviceDetail extends StatefulWidget {
	final AvReceiverDeviceView _device;
	final VoidCallback? onBack;

	const AvReceiverDeviceDetail({
		super.key,
		required AvReceiverDeviceView device,
		this.onBack,
	}) : _device = device;

	@override
	State<AvReceiverDeviceDetail> createState() => _AvReceiverDeviceDetailState();
}

class _AvReceiverDeviceDetailState extends State<AvReceiverDeviceDetail> {
	final DevicesService _devicesService = locator<DevicesService>();
	DeviceControlStateService? _deviceControlStateService;

	Timer? _volumeDebounceTimer;
	Timer? _playbackSettleTimer;
	MediaPlaybackStatusValue? _optimisticPlaybackStatus;
	static const _debounceDuration = Duration(milliseconds: 300);

	@override
	void initState() {
		super.initState();
		_devicesService.addListener(_onDeviceChanged);

		try {
			_deviceControlStateService = locator<DeviceControlStateService>();
			_deviceControlStateService?.addListener(_onControlStateChanged);
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[AvReceiverDeviceDetail] Failed to get DeviceControlStateService: $e');
			}
		}
	}

	@override
	void dispose() {
		_volumeDebounceTimer?.cancel();
		_playbackSettleTimer?.cancel();
		_devicesService.removeListener(_onDeviceChanged);
		_deviceControlStateService?.removeListener(_onControlStateChanged);
		super.dispose();
	}

	void _onDeviceChanged() {
		if (!mounted) return;
		if (_playbackSettleTimer != null && _playbackSettleTimer!.isActive) return;
		_checkConvergence();
		setState(() {});
	}

	void _onControlStateChanged() {
		if (mounted) setState(() {});
	}

	void _checkConvergence() {
		final controlState = _deviceControlStateService;
		if (controlState == null) return;

		final speakerChannel = _device.speakerChannel;
		final volumeProp = speakerChannel.volumeProp;
		if (volumeProp != null) {
			controlState.checkPropertyConvergence(
				_device.id,
				speakerChannel.id,
				volumeProp.id,
				speakerChannel.volume,
				tolerance: 1.0,
			);
		}

		if (speakerChannel.hasMute) {
			final muteProp = speakerChannel.muteProp!;
			controlState.checkPropertyConvergence(
				_device.id,
				speakerChannel.id,
				muteProp.id,
				speakerChannel.isMuted,
			);
		} else if (speakerChannel.hasActive) {
			controlState.checkPropertyConvergence(
				_device.id,
				speakerChannel.id,
				speakerChannel.activeProp.id,
				speakerChannel.isActive,
			);
		}
	}

	AvReceiverDeviceView get _device {
		final updated = _devicesService.getDevice(widget._device.id);
		if (updated is AvReceiverDeviceView) {
			return updated;
		}
		return widget._device;
	}

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

	void _setSource(String source) {
		final mediaInput = _device.mediaInputChannel;
		if (mediaInput == null) return;

		_devicesService.setPropertyValueWithContext(
			deviceId: _device.id,
			channelId: mediaInput.id,
			propertyId: mediaInput.sourceProp.id,
			value: source,
		);
	}

	void _setVolume(int volume) {
		final speakerChannel = _device.speakerChannel;
		final prop = speakerChannel.volumeProp;
		if (prop == null) return;

		final clamped = volume.clamp(_device.speakerMinVolume, _device.speakerMaxVolume);

		_deviceControlStateService?.setPending(
			_device.id,
			speakerChannel.id,
			prop.id,
			clamped,
		);
		setState(() {});

		_volumeDebounceTimer?.cancel();
		_volumeDebounceTimer = Timer(_debounceDuration, () {
			if (!mounted) return;

			_devicesService.setPropertyValueWithContext(
				deviceId: _device.id,
				channelId: speakerChannel.id,
				propertyId: prop.id,
				value: clamped,
			);

			_deviceControlStateService?.setSettling(
				_device.id,
				speakerChannel.id,
				prop.id,
			);
			setState(() {});
		});
	}

	int get _effectiveVolume {
		final speakerChannel = _device.speakerChannel;
		final prop = speakerChannel.volumeProp;
		final controlState = _deviceControlStateService;

		if (controlState != null && prop != null &&
			controlState.isLocked(_device.id, speakerChannel.id, prop.id)) {
			final desired = controlState.getDesiredValue(_device.id, speakerChannel.id, prop.id);
			if (desired is num) return desired.toInt();
		}

		return _device.speakerVolume;
	}

	void _toggleMute() {
		final speakerChannel = _device.speakerChannel;

		if (speakerChannel.hasMute) {
			final prop = speakerChannel.muteProp!;
			final newValue = !_effectiveMuted;

			_deviceControlStateService?.setPending(
				_device.id,
				speakerChannel.id,
				prop.id,
				newValue,
			);
			setState(() {});

			_devicesService.setPropertyValueWithContext(
				deviceId: _device.id,
				channelId: speakerChannel.id,
				propertyId: prop.id,
				value: newValue,
			);

			_deviceControlStateService?.setSettling(
				_device.id,
				speakerChannel.id,
				prop.id,
			);
			setState(() {});
		} else if (speakerChannel.hasActive) {
			final prop = speakerChannel.activeProp;
			final newValue = _effectiveMuted;

			_deviceControlStateService?.setPending(
				_device.id,
				speakerChannel.id,
				prop.id,
				newValue,
			);
			setState(() {});

			_devicesService.setPropertyValueWithContext(
				deviceId: _device.id,
				channelId: speakerChannel.id,
				propertyId: prop.id,
				value: newValue,
			);

			_deviceControlStateService?.setSettling(
				_device.id,
				speakerChannel.id,
				prop.id,
			);
			setState(() {});
		}
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

	bool get _effectiveMuted {
		final speakerChannel = _device.speakerChannel;
		final controlState = _deviceControlStateService;

		if (controlState != null) {
			if (speakerChannel.hasMute) {
				final prop = speakerChannel.muteProp!;
				if (controlState.isLocked(_device.id, speakerChannel.id, prop.id)) {
					final desired = controlState.getDesiredValue(_device.id, speakerChannel.id, prop.id);
					if (desired is bool) return desired;
				}
				return speakerChannel.isMuted;
			} else if (speakerChannel.hasActive) {
				final prop = speakerChannel.activeProp;
				if (controlState.isLocked(_device.id, speakerChannel.id, prop.id)) {
					final desired = controlState.getDesiredValue(_device.id, speakerChannel.id, prop.id);
					if (desired is bool) return !desired;
				}
				return !speakerChannel.isActive;
			}
		}

		return _device.hasSpeakerMute
			? _device.isSpeakerMuted
			: !_device.isSpeakerActive;
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
		if (_device.hasMediaInputSourceLabel) {
			return _device.mediaInputSourceLabel!;
		}
		final source = _device.mediaInputSource;
		if (source != null) {
			if (_device.mediaInputAvailableSources.isNotEmpty) {
				return mediaInputSourceLabel(context, source);
			}
			return source;
		}
		if (_device.hasMediaPlayback && _device.isMediaPlaybackPlaying) {
			final track = _device.isMediaPlaybackTrack;
			if (track != null) return track;
			return localizations.on_state_on;
		}
		return _device.hasSwitcher
			? localizations.on_state_on
			: localizations.on_state_on;
	}

	String? _getDisplaySource() {
		if (_device.hasMediaInputSourceLabel) {
			return _device.mediaInputSourceLabel;
		}

		final source = _device.mediaInputSource;
		if (source == null) return null;

		if (_device.mediaInputAvailableSources.isNotEmpty) {
			return mediaInputSourceLabel(context, source);
		}

		return source;
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
						icon: MdiIcons.audioVideo,
						name: _device.name,
						isOn: _isOn,
						displaySource: _getDisplaySource(),
						themeColor: _getThemeColor(),
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
							),
					if (_device.hasSpeaker)
						MediaVolumeCard(
							volume: _effectiveVolume,
							isMuted: _effectiveMuted,
							hasMute: _device.hasSpeakerMute || _device.speakerChannel.hasActive,
							isEnabled: _isOn,
							themeColor: _getThemeColor(),
							onVolumeChanged: _setVolume,
							onMuteToggle: _toggleMute,
						),
					if (_device.mediaInputAvailableSources.isNotEmpty)
						MediaSourceSelectCard(
							availableSources: _device.mediaInputAvailableSources,
							currentSource: _device.mediaInputSource,
							sourceLabel: (s) => mediaInputSourceLabel(context, s),
							onSourceChanged: _setSource,
							isEnabled: _isOn,
							themeColor: _getThemeColor(),
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
						icon: MdiIcons.audioVideo,
						name: _device.name,
						isOn: _isOn,
						displaySource: _getDisplaySource(),
						themeColor: _getThemeColor(),
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
							),
					if (_device.hasSpeaker)
						MediaVolumeCard(
							volume: _effectiveVolume,
							isMuted: _effectiveMuted,
							hasMute: _device.hasSpeakerMute || _device.speakerChannel.hasActive,
							isEnabled: _isOn,
							themeColor: _getThemeColor(),
							onVolumeChanged: _setVolume,
							onMuteToggle: _toggleMute,
						),
					if (_device.mediaInputAvailableSources.isNotEmpty)
						MediaSourceSelectCard(
							availableSources: _device.mediaInputAvailableSources,
							currentSource: _device.mediaInputSource,
							sourceLabel: (s) => mediaInputSourceLabel(context, s),
							onSourceChanged: _setSource,
							isEnabled: _isOn,
							themeColor: _getThemeColor(),
						),
				],
			),
			secondaryContent: const Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [],
			),
		);
	}

}
