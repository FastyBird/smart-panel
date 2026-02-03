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
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/media_input_source_label.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/media_brightness_card.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/media_info_card.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/media_remote_card.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/media_volume_card.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/television.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class TelevisionDeviceDetail extends StatefulWidget {
	final TelevisionDeviceView _device;
	final VoidCallback? onBack;

	const TelevisionDeviceDetail({
		super.key,
		required TelevisionDeviceView device,
		this.onBack,
	}) : _device = device;

	@override
	State<TelevisionDeviceDetail> createState() => _TelevisionDeviceDetailState();
}

class _TelevisionDeviceDetailState extends State<TelevisionDeviceDetail> {
	final ScreenService _screenService = locator<ScreenService>();
	final VisualDensityService _visualDensityService = locator<VisualDensityService>();
	final DevicesService _devicesService = locator<DevicesService>();
	DeviceControlStateService? _deviceControlStateService;

	Timer? _volumeDebounceTimer;
	Timer? _brightnessDebounceTimer;
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
				debugPrint('[TelevisionDeviceDetail] Failed to get DeviceControlStateService: $e');
			}
		}
	}

	@override
	void dispose() {
		_volumeDebounceTimer?.cancel();
		_brightnessDebounceTimer?.cancel();
		_devicesService.removeListener(_onDeviceChanged);
		_deviceControlStateService?.removeListener(_onControlStateChanged);
		super.dispose();
	}

	void _onDeviceChanged() {
		if (!mounted) return;
		_checkConvergence();
		setState(() {});
	}

	void _onControlStateChanged() {
		if (mounted) setState(() {});
	}

	void _checkConvergence() {
		final controlState = _deviceControlStateService;
		if (controlState == null) return;

		final brightnessProp = _device.televisionChannel.brightnessProp;
		if (brightnessProp != null) {
			controlState.checkPropertyConvergence(
				_device.id,
				_device.televisionChannel.id,
				brightnessProp.id,
				_device.televisionBrightness,
				tolerance: 1.0,
			);
		}

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

	TelevisionDeviceView get _device {
		final updated = _devicesService.getDevice(widget._device.id);
		if (updated is TelevisionDeviceView) {
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
		final propId = _device.televisionChannel.onProp.id;

		_devicesService.setPropertyValueWithContext(
			deviceId: _device.id,
			channelId: _device.televisionChannel.id,
			propertyId: propId,
			value: !_device.isTelevisionOn,
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

	void _setBrightness(int brightness) {
		final prop = _device.televisionChannel.brightnessProp;
		if (prop == null) return;

		final channelId = _device.televisionChannel.id;
		final clamped = brightness.clamp(_device.televisionMinBrightness, _device.televisionMaxBrightness);

		_deviceControlStateService?.setPending(
			_device.id,
			channelId,
			prop.id,
			clamped,
		);
		setState(() {});

		_brightnessDebounceTimer?.cancel();
		_brightnessDebounceTimer = Timer(_debounceDuration, () {
			if (!mounted) return;

			_devicesService.setPropertyValueWithContext(
				deviceId: _device.id,
				channelId: channelId,
				propertyId: prop.id,
				value: clamped,
			);

			_deviceControlStateService?.setSettling(
				_device.id,
				channelId,
				prop.id,
			);
			setState(() {});
		});
	}

	void _sendRemoteKey(TelevisionRemoteKeyValue key) {
		final prop = _device.televisionChannel.remoteKeyProp;
		if (prop == null) return;

		_devicesService.setPropertyValueWithContext(
			deviceId: _device.id,
			channelId: _device.televisionChannel.id,
			propertyId: prop.id,
			value: key.value,
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

	int get _effectiveBrightness {
		final prop = _device.televisionChannel.brightnessProp;
		final controlState = _deviceControlStateService;

		if (controlState != null && prop != null &&
			controlState.isLocked(_device.id, _device.televisionChannel.id, prop.id)) {
			final desired = controlState.getDesiredValue(_device.id, _device.televisionChannel.id, prop.id);
			if (desired is num) return desired.toInt();
		}

		return _device.televisionBrightness;
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

	String _getStatusLabel(AppLocalizations localizations) {
		if (!_device.isTelevisionOn) {
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
		return localizations.on_state_on;
	}

	Color _getAccentColor(bool isDark) {
		if (_device.isTelevisionOn) {
			return isDark ? AppColorsDark.info : AppColorsLight.info;
		}
		return isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
	}

	Color _getAccentLightColor(bool isDark) {
		if (_device.isTelevisionOn) {
			return isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5;
		}
		return isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
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
		final isOn = _device.isTelevisionOn;

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
							MdiIcons.television,
							color: isOn ? accentColor : mutedColor,
							size: _scale(24),
						),
					),
				],
			),
			trailing: GestureDetector(
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
			),
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
						icon: MdiIcons.television,
						iconColor: accentColor,
						iconBgColor: _getAccentLightColor(isDark),
						name: _device.name,
						isOn: _device.isTelevisionOn,
						displaySource: _getDisplaySource(),
						accentColor: accentColor,
						scale: _scale,
						availableSources: _device.mediaInputAvailableSources.isNotEmpty ? _device.mediaInputAvailableSources : null,
						currentSource: _device.mediaInputSource,
						sourceLabel: _device.mediaInputAvailableSources.isNotEmpty ? (s) => mediaInputSourceLabel(context, s) : null,
						onSourceChanged: _device.mediaInputAvailableSources.isNotEmpty ? _setSource : null,
					),
					if (_device.hasSpeaker) ...[
						AppSpacings.spacingLgVertical,
						MediaVolumeCard(
							volume: _effectiveVolume,
							isMuted: _effectiveMuted,
							hasMute: _device.hasSpeakerMute || _device.speakerChannel.hasActive,
							isEnabled: _device.isTelevisionOn,
							themeColor: ThemeColors.primary,
							onVolumeChanged: _setVolume,
							onMuteToggle: _toggleMute,
							scale: _scale,
						),
					],
					if (_device.televisionChannel.brightnessProp != null) ...[
						AppSpacings.spacingLgVertical,
						MediaBrightnessCard(
							brightness: _effectiveBrightness,
							isEnabled: _device.isTelevisionOn,
							themeColor: ThemeColors.primary,
							onBrightnessChanged: _setBrightness,
							scale: _scale,
						),
					],
					if (_device.hasTelevisionRemoteKey) ...[
						AppSpacings.spacingLgVertical,
						MediaRemoteCard<TelevisionRemoteKeyValue>(
							availableKeys: _device.televisionAvailableRemoteKeys,
							isEnabled: _device.isTelevisionOn,
							onKeyPress: _sendRemoteKey,
							scale: _scale,
						),
					],
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
						icon: MdiIcons.television,
						iconColor: accentColor,
						iconBgColor: _getAccentLightColor(isDark),
						name: _device.name,
						isOn: _device.isTelevisionOn,
						displaySource: _getDisplaySource(),
						accentColor: accentColor,
						scale: _scale,
						availableSources: _device.mediaInputAvailableSources.isNotEmpty ? _device.mediaInputAvailableSources : null,
						currentSource: _device.mediaInputSource,
						sourceLabel: _device.mediaInputAvailableSources.isNotEmpty ? (s) => mediaInputSourceLabel(context, s) : null,
						onSourceChanged: _device.mediaInputAvailableSources.isNotEmpty ? _setSource : null,
					),
					if (_device.hasSpeaker) ...[
						AppSpacings.spacingMdVertical,
						MediaVolumeCard(
							volume: _effectiveVolume,
							isMuted: _effectiveMuted,
							hasMute: _device.hasSpeakerMute || _device.speakerChannel.hasActive,
							isEnabled: _device.isTelevisionOn,
							themeColor: ThemeColors.primary,
							onVolumeChanged: _setVolume,
							onMuteToggle: _toggleMute,
							scale: _scale,
						),
					],
				],
			),
			secondaryContent: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					if (_device.televisionChannel.brightnessProp != null)
						MediaBrightnessCard(
							brightness: _effectiveBrightness,
							isEnabled: _device.isTelevisionOn,
							themeColor: ThemeColors.primary,
							onBrightnessChanged: _setBrightness,
							scale: _scale,
						),
					if (_device.hasTelevisionRemoteKey) ...[
						AppSpacings.spacingLgVertical,
						MediaRemoteCard<TelevisionRemoteKeyValue>(
							availableKeys: _device.televisionAvailableRemoteKeys,
							isEnabled: _device.isTelevisionOn,
							onKeyPress: _sendRemoteKey,
							scale: _scale,
						),
					],
				],
			),
		);
	}
}
