import 'dart:async';
import 'dart:math' as math;

import 'package:event_bus/event_bus.dart';
import 'package:flutter/services.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/utils/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/navigate_event.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/media_activity/media_activity.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/services/media_activity_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

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

class MediaDomainViewPage extends StatefulWidget {
	final DomainViewItem viewItem;

	const MediaDomainViewPage({super.key, required this.viewItem});

	@override
	State<MediaDomainViewPage> createState() => _MediaDomainViewPageState();
}

class _MediaDomainViewPageState extends State<MediaDomainViewPage>
		with SingleTickerProviderStateMixin {
	final ScreenService _screenService = locator<ScreenService>();
	final VisualDensityService _visualDensityService = locator<VisualDensityService>();

	double _scale(double val) =>
			_screenService.scale(val, density: _visualDensityService.density);

	double? get _portraitContentHeight =>
			_screenService.isPortrait ? _screenService.screenHeight * 3 / 5 : null;

	MediaActivityService? _mediaService;
	SpacesService? _spacesService;
	DeckService? _deckService;
	EventBus? _eventBus;
	SocketService? _socketService;
	DevicesService? _devicesService;

	bool _isLoading = true;
	bool _isSending = false;
	bool _wsConnected = false;
	// Local optimistic state for volume/mute — no server-side aggregated state
	// is available, so these track user interactions only and reset on navigation.
	int _volume = 0;
	bool _isMuted = false;
	/// Current playback state read from device status property.
	/// Values: 'playing', 'paused', 'stopped' (or null if unknown).
	String? _playbackState;
	/// Track metadata read from device properties.
	String? _trackName;
	String? _artistName;
	/// Playback position and duration in seconds.
	double? _position;
	double? _duration;

	Timer? _volumeDebounceTimer;
	Timer? _playbackSettleTimer;

	late AnimationController _pulseController;

	String get _roomId => widget.viewItem.roomId;

	@override
	void initState() {
		super.initState();

		_pulseController = AnimationController(
			vsync: this,
			duration: const Duration(milliseconds: 1500),
		)..repeat();

		try {
			_mediaService = locator<MediaActivityService>();
			_mediaService?.addListener(_onDataChanged);
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Failed to get MediaActivityService: $e');
			}
		}

		try {
			_spacesService = locator<SpacesService>();
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Failed to get SpacesService: $e');
			}
		}


		try {
			_deckService = locator<DeckService>();
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Failed to get DeckService: $e');
			}
		}

		try {
			_eventBus = locator<EventBus>();
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Failed to get EventBus: $e');
			}
		}

		try {
			_socketService = locator<SocketService>();
			_socketService?.addConnectionListener(_onConnectionChanged);
			_wsConnected = _socketService?.isConnected ?? false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Failed to get SocketService: $e');
			}
		}

		try {
			_devicesService = locator<DevicesService>();
			_devicesService?.addListener(_onDevicesChanged);
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Failed to get DevicesService: $e');
			}
		}

		WidgetsBinding.instance.addPostFrameCallback((_) => _prefetch());
	}

	Future<void> _prefetch() async {
		if (_mediaService == null) return;
		try {
			await _mediaService!.fetchAllForSpace(_roomId);
		} finally {
			if (mounted) {
				_syncDeviceState();
				setState(() => _isLoading = false);
			}
		}
	}

	Future<void> _refresh() async {
		await _prefetch();
	}

	@override
	void dispose() {
		_volumeDebounceTimer?.cancel();
		_playbackSettleTimer?.cancel();
		_pulseController.dispose();
		_mediaService?.removeListener(_onDataChanged);
		_devicesService?.removeListener(_onDevicesChanged);
		_socketService?.removeConnectionListener(_onConnectionChanged);
		super.dispose();
	}

	void _onDataChanged() {
		if (!mounted) return;
		_syncDeviceState();
		WidgetsBinding.instance.addPostFrameCallback((_) {
			if (mounted) setState(() {});
		});
	}

	void _onDevicesChanged() {
		if (!mounted) return;
		// Sync volume/mute from device properties when backend pushes updates
		// Skip if a debounce timer is active (user is dragging the slider)
		if (_volumeDebounceTimer == null || !_volumeDebounceTimer!.isActive) {
			_syncDeviceState();
			WidgetsBinding.instance.addPostFrameCallback((_) {
				if (mounted) setState(() {});
			});
		}
	}

	/// Read volume/mute/playback state from device properties.
	/// Called on data changes to keep UI in sync with actual device values.
	void _syncDeviceState() {
		final targets = _mediaService?.resolveControlTargets(_roomId);
		if (targets == null) return;

		// Volume: read from the resolved volume property
		if (targets.hasVolume) {
			final propId = targets.volumeTarget!.links.volumePropertyId;
			if (propId != null) {
				final prop = _devicesService?.getChannelProperty(propId);
				final val = prop?.value;
				if (val is NumberValueType) {
					_volume = val.value.toInt();
					
				}
			}

			// Mute: read from the resolved mute property
			final muteId = targets.volumeTarget!.links.mutePropertyId;
			if (muteId != null) {
				final prop = _devicesService?.getChannelProperty(muteId);
				final val = prop?.value;
				if (val is BooleanValueType) {
					_isMuted = val.value;
				}
			}
		}

		// Playback state and track metadata
		if (targets.hasPlayback) {
			final playbackLinks = targets.playbackTarget!.links;

			// Only sync playback state from device when not in optimistic settle window
			final isSettling = _playbackSettleTimer != null && _playbackSettleTimer!.isActive;
			if (!isSettling) {
				final stateId = playbackLinks.playbackStatePropertyId;
				if (stateId != null) {
					final prop = _devicesService?.getChannelProperty(stateId);
					final val = prop?.value;
					if (val is StringValueType) {
						_playbackState = val.value;
					}
				}
			}

			// Track metadata
			final trackId = playbackLinks.trackMetadataPropertyId;
			if (trackId != null) {
				final prop = _devicesService?.getChannelProperty(trackId);
				if (prop?.value is StringValueType) {
					_trackName = (prop!.value as StringValueType).value;
				}
			}

			final artistId = playbackLinks.artistPropertyId;
			if (artistId != null) {
				final prop = _devicesService?.getChannelProperty(artistId);
				if (prop?.value is StringValueType) {
					_artistName = (prop!.value as StringValueType).value;
				}
			}

			// Position & duration
			final posId = playbackLinks.positionPropertyId;
			if (posId != null) {
				final prop = _devicesService?.getChannelProperty(posId);
				final val = prop?.value;
				if (val is NumberValueType) {
					_position = val.value.toDouble();
				}
			}

			final durId = playbackLinks.durationPropertyId;
			if (durId != null) {
				final prop = _devicesService?.getChannelProperty(durId);
				final val = prop?.value;
				if (val is NumberValueType) {
					_duration = val.value.toDouble();
				}
			}

		}
	}

	void _onConnectionChanged(bool isConnected) {
		if (!mounted) return;
		setState(() => _wsConnected = isConnected);
	}

	void _navigateToHome() {
		final deck = _deckService?.deck;
		if (deck == null || deck.items.isEmpty) {
			Navigator.pop(context);
			return;
		}

		final homeIndex = deck.startIndex;
		if (homeIndex >= 0 && homeIndex < deck.items.length) {
			final homeItem = deck.items[homeIndex];
			_eventBus?.fire(NavigateToDeckItemEvent(homeItem.id));
		}
	}

	Future<void> _onActivitySelected(MediaActivityKey key) async {
		if (_mediaService == null || _isSending) return;
		setState(() {
			_isSending = true;
			// Reset local state when switching activities

			_volume = 0;
			_isMuted = false;
			_playbackState = null;
			_trackName = null;
			_artistName = null;
			_position = null;
			_duration = null;
		});
		try {
			if (key == MediaActivityKey.off) {
				await _mediaService!.deactivateActivity(_roomId);
			} else {
				await _mediaService!.activateActivity(_roomId, key);
			}
		} finally {
			if (mounted) {
				_syncDeviceState();
				setState(() => _isSending = false);
			}
		}
	}

	@override
	Widget build(BuildContext context) {
		return Consumer<MediaActivityService>(
			builder: (context, mediaService, _) {
				final isDark = Theme.of(context).brightness == Brightness.dark;
				final activeState = mediaService.getActiveState(_roomId);
				final deviceGroups = mediaService.getDeviceGroups(_roomId);
				final endpoints = mediaService.getEndpoints(_roomId);
				final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';
				final hasEndpoints = endpoints.isNotEmpty;

				if (_isLoading) {
					return Scaffold(
						backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
						body: const Center(child: CircularProgressIndicator()),
					);
				}

				// No media-capable devices in this space
				if (!hasEndpoints) {
					return Scaffold(
						backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
						body: SafeArea(
							child: Column(
								children: [
									_buildHeader(context, roomName, activeState),
									Expanded(
										child: RefreshIndicator(
											onRefresh: _refresh,
											child: ListView(
												padding: EdgeInsets.all(AppSpacings.pXl + AppSpacings.pMd),
												children: [
													SizedBox(height: AppSpacings.pXl * 2),
													Icon(
														MdiIcons.monitorOff,
														size: _scale(64),
														color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
													),
													AppSpacings.spacingLgVertical,
													Text(
														AppLocalizations.of(context)!.media_no_endpoints_title,
														textAlign: TextAlign.center,
														style: Theme.of(context).textTheme.titleMedium,
													),
													AppSpacings.spacingMdVertical,
													Text(
														AppLocalizations.of(context)!.media_no_endpoints_description,
														textAlign: TextAlign.center,
														style: Theme.of(context).textTheme.bodyMedium?.copyWith(
															color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
														),
													),
												],
											),
										),
									),
								],
							),
						),
					);
				}

				final isOff = activeState == null || activeState.isDeactivated;
				final isActivating = activeState != null && activeState.isActivating;
				final isFailed = activeState != null && activeState.isFailed;

				return Scaffold(
					backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
					body: SafeArea(
						child: Stack(
							children: [
								Column(
									children: [
										_buildHeader(context, roomName, activeState),
										Expanded(
											child: OrientationBuilder(
												builder: (context, orientation) {
													final isLandscape = orientation == Orientation.landscape;
													return isLandscape
															? _buildLandscapeLayout(
																	context, activeState, deviceGroups, isOff, isActivating, isFailed)
															: _buildPortraitLayout(
																	context, activeState, deviceGroups, isOff, isActivating, isFailed);
												},
											),
										),
									],
								),
							],
						),
					),
				);
			},
		);
	}

	// ============================================
	// HEADER
	// ============================================

	Widget _buildHeader(
		BuildContext context,
		String roomName,
		MediaActiveStateModel? activeState,
	) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;
		final hasActive = activeState != null && activeState.isActive;
		final subtitle = hasActive
				? '${_activityLabel(activeState.activityKey)} active'
				: localizations.media_mode_off;

		return PageHeader(
			title: localizations.domain_media,
			subtitle: subtitle,
			subtitleColor:
					hasActive ? (isDark ? AppColorsDark.primary : AppColorsLight.primary) : null,
			backgroundColor: AppColors.blank,
			leading: HeaderDeviceIcon(
				icon: hasActive ? MdiIcons.musicNote : MdiIcons.musicNoteOff,
				backgroundColor: isDark
						? (hasActive ? AppColorsDark.primaryLight5 : AppFillColorDark.light)
						: (hasActive ? AppColorsLight.primaryLight5 : AppFillColorLight.light),
				iconColor: hasActive
						? (isDark ? AppColorsDark.primary : AppColorsLight.primary)
						: (isDark ? AppTextColorDark.secondary : AppTextColorLight.primary),
			),
			trailing: HeaderHomeButton(
				onTap: _navigateToHome,
			),
		);
	}

	// ============================================
	// PORTRAIT LAYOUT
	// ============================================

	Widget _buildPortraitLayout(
		BuildContext context,
		MediaActiveStateModel? activeState,
		List<MediaDeviceGroup> deviceGroups,
		bool isOff,
		bool isActivating,
		bool isFailed,
	) {
		return PortraitViewLayout(
			content: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					_buildActivityContent(context, activeState, isOff, isActivating, isFailed),
					AppSpacings.spacingLgVertical,
					_buildDevicesList(context, deviceGroups),
				],
			),
			modeSelector: _buildModeSelector(context, activeState),
		);
	}

	// ============================================
	// LANDSCAPE LAYOUT
	// ============================================

	Widget _buildLandscapeLayout(
		BuildContext context,
		MediaActiveStateModel? activeState,
		List<MediaDeviceGroup> deviceGroups,
		bool isOff,
		bool isActivating,
		bool isFailed,
	) {
		return LandscapeViewLayout(
			mainContent: _buildActivityContent(context, activeState, isOff, isActivating, isFailed),
			mainContentScrollable: true,
			modeSelector: _buildLandscapeModeSelector(context, activeState),
			additionalContent: _buildDevicesList(context, deviceGroups),
		);
	}

	// ============================================
	// ACTIVITY CONTENT (state-dependent)
	// ============================================

	Widget _buildActivityContent(
		BuildContext context,
		MediaActiveStateModel? activeState,
		bool isOff,
		bool isActivating,
		bool isFailed,
	) {
		// Off state: no card, no border, no background
		if (isOff) return _buildOffStateContent(context);

		final isLight = Theme.of(context).brightness == Brightness.light;

		Widget content;
		if (isActivating) {
			content = _buildActivatingContent(context, activeState!);
		} else if (isFailed) {
			content = _buildFailedContent(context, activeState!);
		} else if (activeState != null && (activeState.isActive || activeState.isActiveWithWarnings)) {
			content = _buildActiveCard(context, activeState);
		} else {
			return _buildOffStateContent(context);
		}

		return Container(
			width: double.infinity,
			padding: AppSpacings.paddingLg,
			decoration: BoxDecoration(
				color: isLight ? AppFillColorLight.light : AppFillColorDark.light,
				borderRadius: BorderRadius.circular(AppBorderRadius.medium),
				border: isLight
						? Border.all(color: AppBorderColorLight.base)
						: null,
			),
			child: content,
		);
	}

	// ============================================
	// MODE SELECTOR (using core ModeSelector widget)
	// ============================================

	List<ModeOption<MediaActivityKey>> _getActivityModeOptions() {
		final availableKeys = _mediaService?.getAvailableActivities(_roomId) ?? MediaActivityKey.values;
		return availableKeys.map((key) => ModeOption<MediaActivityKey>(
			value: key,
			icon: _activityIcon(key),
			label: _activityLabel(key),
		)).toList();
	}

	MediaActivityKey? _getSelectedActivityKey(MediaActiveStateModel? activeState) {
		if (activeState == null || activeState.isDeactivated || activeState.isDeactivating) {
			return MediaActivityKey.off;
		}
		return activeState.activityKey ?? MediaActivityKey.off;
	}

	Widget _buildModeSelector(BuildContext context, MediaActiveStateModel? activeState) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		return Container(
			padding: AppSpacings.paddingMd,
			decoration: BoxDecoration(
				color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
				borderRadius: BorderRadius.circular(AppBorderRadius.medium),
				border: Border.all(
					color: isDark ? AppFillColorDark.light : AppBorderColorLight.light,
					width: 1,
				),
			),
			child: IgnorePointer(
				ignoring: !_wsConnected || _isSending,
				child: ModeSelector<MediaActivityKey>(
					modes: _getActivityModeOptions(),
					selectedValue: _getSelectedActivityKey(activeState),
					onChanged: _onActivitySelected,
					orientation: ModeSelectorOrientation.horizontal,
					iconPlacement: ModeSelectorIconPlacement.top,
				),
			),
		);
	}

	Widget _buildLandscapeModeSelector(BuildContext context, MediaActiveStateModel? activeState) {
		return IgnorePointer(
			ignoring: !_wsConnected || _isSending,
			child: ModeSelector<MediaActivityKey>(
				modes: _getActivityModeOptions(),
				selectedValue: _getSelectedActivityKey(activeState),
				onChanged: _onActivitySelected,
				orientation: ModeSelectorOrientation.vertical,
				iconPlacement: ModeSelectorIconPlacement.top,
			),
		);
	}

	// ============================================
	// OFF STATE CONTENT
	// ============================================

	Widget _buildOffStateContent(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;


		return Container(
			width: double.infinity,
			height: _portraitContentHeight,
			alignment: Alignment.center,
			child: Column(
				mainAxisAlignment: MainAxisAlignment.center,
				mainAxisSize: MainAxisSize.min,
				children: [
					Container(
						width: _scale(90),
						height: _scale(90),
						decoration: BoxDecoration(
							color: isDark ? AppFillColorDark.darker : AppFillColorLight.darker,
							shape: BoxShape.circle,
						),
						child: Icon(
							MdiIcons.televisionClassic,
							size: _scale(56),
							color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
						),
					),
					AppSpacings.spacingLgVertical,
					Text(
						'Media Off',
						style: TextStyle(
							fontSize: AppFontSize.extraLarge,
							fontWeight: FontWeight.w600,
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					),
					AppSpacings.spacingSmVertical,
					Text(
						'Select an activity above to begin',
						style: TextStyle(
							fontSize: AppFontSize.base,
							color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
						),
					),
				],
			),
		);
	}

	// ============================================
	// ACTIVATING STATE CONTENT
	// ============================================

	Widget _buildActivatingContent(BuildContext context, MediaActiveStateModel activeState) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final accentColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		final activityName = _activityLabel(activeState.activityKey);

		return Container(
			width: double.infinity,
			height: _portraitContentHeight,
			alignment: Alignment.center,
			child: Column(
				mainAxisAlignment: MainAxisAlignment.center,
				mainAxisSize: MainAxisSize.min,
				children: [
					AnimatedBuilder(
						animation: _pulseController,
						builder: (context, child) {
							return Transform.rotate(
								angle: _pulseController.value * 2 * math.pi,
								child: Container(
									width: _scale(56),
									height: _scale(56),
									decoration: BoxDecoration(
										shape: BoxShape.circle,
										border: Border.all(
											color: accentColor.withValues(alpha: 0.2),
											width: _scale(3),
										),
									),
									child: CustomPaint(
										painter: _SpinnerArcPainter(
											color: accentColor,
										),
									),
								),
							);
						},
					),
					AppSpacings.spacingLgVertical,
					Text(
						'Starting $activityName...',
						style: TextStyle(
							fontSize: AppFontSize.large,
							fontWeight: FontWeight.w600,
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					),
			],
			),
		);
	}

	// ============================================
	// FAILED STATE CONTENT
	// ============================================

	Widget _buildFailedContent(BuildContext context, MediaActiveStateModel activeState) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final accentColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		final errorColor = isDark ? AppColorsDark.error : AppColorsLight.error;
		final errorBg = isDark ? AppColorsDark.errorLight9 : AppColorsLight.errorLight9;
		final activityName = _activityLabel(activeState.activityKey);


		return Container(
			width: double.infinity,
			height: _portraitContentHeight,
			alignment: Alignment.center,
			child: Column(
				mainAxisAlignment: MainAxisAlignment.center,
				mainAxisSize: MainAxisSize.min,
				children: [
					Container(
						width: _scale(90),
						height: _scale(90),
						decoration: BoxDecoration(
							color: errorBg,
							shape: BoxShape.circle,
						),
						child: Icon(
							MdiIcons.closeCircleOutline,
							size: _scale(56),
							color: errorColor,
						),
					),
					AppSpacings.spacingLgVertical,
					Text(
						'$activityName Failed',
						style: TextStyle(
							fontSize: AppFontSize.extraLarge,
							fontWeight: FontWeight.w600,
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					),
					AppSpacings.spacingSmVertical,
					Text(
						'Activity failed to apply. Check device connectivity.',
						style: TextStyle(
							fontSize: AppFontSize.base,
							color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
						),
					),
					AppSpacings.spacingLgVertical,
					Row(
						mainAxisAlignment: MainAxisAlignment.center,
						children: [
							ElevatedButton(
								onPressed: () => _retryActivity(activeState),
								style: ElevatedButton.styleFrom(
									backgroundColor: accentColor,
									foregroundColor: Colors.white,
									padding: EdgeInsets.symmetric(
										horizontal: AppSpacings.pXl,
										vertical: AppSpacings.pMd,
									),
									shape: RoundedRectangleBorder(
										borderRadius: BorderRadius.circular(AppBorderRadius.medium),
									),
									elevation: 0,
								),
								child: const Text('Retry'),
							),
							AppSpacings.spacingMdHorizontal,
							OutlinedButton(
								onPressed: _deactivateActivity,
								style: OutlinedButton.styleFrom(
									foregroundColor: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
									padding: EdgeInsets.symmetric(
										horizontal: AppSpacings.pXl,
										vertical: AppSpacings.pMd,
									),
									side: BorderSide(color: isDark ? AppBorderColorDark.base : AppBorderColorLight.base),
									shape: RoundedRectangleBorder(
										borderRadius: BorderRadius.circular(AppBorderRadius.medium),
									),
								),
								child: const Text('Turn Off'),
							),
						],
					),
				],
			),
		);
	}

	// ============================================
	// ACTIVE ACTIVITY CARD
	// ============================================

	Widget _buildActiveCard(
		BuildContext context,
		MediaActiveStateModel activeState,
	) {
		final targets = _mediaService?.resolveControlTargets(_roomId) ?? const ActiveControlTargets();
		final compositionEntries = _mediaService?.getActiveCompositionEntries(_roomId) ?? [];
		// Resolve display names and online status for composition entries
		final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';
		final displayItems = <_CompositionDisplayItem>[];
		final offlineRoles = <String>[];

		for (final entry in compositionEntries) {
			final device = _devicesService?.getDevice(entry.deviceId);
			var name = device?.name ?? entry.endpointName;
			name = stripRoomNameFromDevice(name, roomName);
			// Strip endpoint type suffix like "(Display)", "(Audio Output)", "(Source)", "(Remote Target)"
			name = name.replaceFirst(RegExp(r'\s*\((Display|Audio Output|Source|Remote Target)\)\s*$'), '');
			final isOnline = device?.isOnline ?? true;

			// Resolve input property ID for this role's endpoint
			String? inputPropId;
			switch (entry.role) {
				case 'Display':
					inputPropId = targets.displayTarget?.links.inputPropertyId;
					break;
				case 'Audio':
					inputPropId = targets.volumeTarget?.links.inputPropertyId;
					break;
				case 'Source':
					inputPropId = targets.playbackTarget?.links.inputPropertyId;
					break;
			}

			displayItems.add(_CompositionDisplayItem(
				role: entry.role,
				displayName: name,
				isOnline: isOnline,
				inputPropertyId: inputPropId,
			));
			if (!isOnline) offlineRoles.add(entry.role);
		}

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			children: [
					// Warning banner
					if (activeState.hasWarnings && !activeState.isFailed) ...[
						AppSpacings.spacingLgVertical,
						_buildWarningBanner(context, activeState),
					],

					// Offline device banner
					if (offlineRoles.isNotEmpty && !activeState.hasWarnings) ...[
						AppSpacings.spacingMdVertical,
						_buildOfflineDeviceBanner(context, offlineRoles),
					],

					// Composition preview
					if (displayItems.isNotEmpty) ...[
						AppSpacings.spacingMdVertical,
						_buildCompositionPreview(context, displayItems),
					],

					// Capability-driven controls
					if (_trackName != null || _artistName != null || (_duration != null && _duration! > 0)) ...[
						AppSpacings.spacingLgVertical,
						_buildNowPlaying(context),
					],
					if (targets.hasPlayback) ...[
						AppSpacings.spacingMdVertical,
						_buildPlaybackControl(context),
					],
					if (_duration != null && _duration! > 0) ...[
						AppSpacings.spacingMdVertical,
						_buildProgressBar(context),
					],
					if (targets.hasVolume) ...[
						AppSpacings.spacingLgVertical,
						_buildVolumeControl(context),
					],
					if (targets.hasRemote) ...[
						AppSpacings.spacingLgVertical,
						_buildRemoteButton(context),
					],

					// Failure details
				if (activeState.isFailed) ...[
					AppSpacings.spacingMdVertical,
					_buildFailureDetails(context, activeState),
				],
			],
		);
	}

	Widget _buildWarningBanner(BuildContext context, MediaActiveStateModel state) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
		final warningBg = isDark ? AppColorsDark.warningLight9 : AppColorsLight.warningLight9;

		final warningCount = state.lastResult?.warningCount ?? state.warnings.length;
		final String label;
		if (warningCount > 0) {
			label = 'Some steps failed ($warningCount warning${warningCount != 1 ? 's' : ''})';
		} else if (state.warnings.isNotEmpty) {
			label = state.warnings.first;
		} else {
			label = 'Some steps had issues';
		}

		return GestureDetector(
			onTap: () => _showFailureDetailsSheet(context, state),
			child: Container(
				width: double.infinity,
				padding: AppSpacings.paddingMd,
				decoration: BoxDecoration(
					color: warningBg,
					borderRadius: BorderRadius.circular(AppBorderRadius.medium),
				),
				child: Row(
					children: [
						Icon(
							MdiIcons.alertOutline,
							color: warningColor,
							size: _scale(18),
						),
						AppSpacings.spacingMdHorizontal,
						Expanded(
							child: Text(
								label,
								style: TextStyle(
									fontSize: AppFontSize.small,
									color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
								),
							),
						),
						Icon(
							MdiIcons.chevronRight,
							color: warningColor,
							size: _scale(18),
						),
					],
				),
			),
		);
	}

	Widget _buildOfflineDeviceBanner(BuildContext context, List<String> offlineRoles) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
		final warningBg = isDark ? AppColorsDark.warningLight9 : AppColorsLight.warningLight9;


		final String label;
		if (offlineRoles.length == 1 && offlineRoles.first == 'Audio') {
			label = 'Audio output offline – using display speakers';
		} else {
			label = 'Some devices offline';
		}

		return Container(
			width: double.infinity,
			padding: AppSpacings.paddingMd,
			decoration: BoxDecoration(
				color: warningBg,
				borderRadius: BorderRadius.circular(AppBorderRadius.medium),
			),
			child: Row(
				children: [
					Icon(
						MdiIcons.alertOutline,
						color: warningColor,
						size: _scale(18),
					),
					AppSpacings.spacingMdHorizontal,
					Expanded(
						child: Text(
							label,
							style: TextStyle(
								fontSize: AppFontSize.small,
								color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
							),
						),
					),
				],
			),
		);
	}

	Widget _buildCompositionPreview(BuildContext context, List<_CompositionDisplayItem> items) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final isLight = !isDark;
		final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;

		return Container(
			padding: AppSpacings.paddingLg,
			decoration: BoxDecoration(
				color: isDark ? AppFillColorDark.base : AppFillColorLight.darker,
				borderRadius: BorderRadius.circular(AppBorderRadius.medium),
			),
			child: Column(
				spacing: AppSpacings.pMd,
				children: items.map((item) {
					final icon = _roleIcon(item.role);
					final nameText = item.isOnline ? item.displayName : '${item.displayName} (offline)';
					final nameColor = item.isOnline
							? (isLight ? AppTextColorLight.primary : AppTextColorDark.primary)
							: warningColor;

					// Resolve input source value and format
					String? inputValue;
					List<String>? inputOptions;
					if (item.inputPropertyId != null && _devicesService != null) {
						final prop = _devicesService!.getChannelProperty(item.inputPropertyId!);
						if (prop?.value is StringValueType) {
							inputValue = (prop!.value as StringValueType).value;
						}
						if (prop?.format is StringListFormatType) {
							inputOptions = (prop!.format as StringListFormatType).value;
						}
					}

					return Row(
						children: [
							Container(
								width: _scale(32),
								height: _scale(32),
								decoration: BoxDecoration(
									color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
									borderRadius: BorderRadius.circular(AppBorderRadius.base),
								),
								child: Icon(
									icon,
									size: _scale(16),
									color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
								),
							),
							AppSpacings.spacingMdHorizontal,
							Expanded(
								child: Column(
									crossAxisAlignment: CrossAxisAlignment.start,
									children: [
										if (item.role.isNotEmpty)
											Text(
												item.role.toUpperCase(),
												style: TextStyle(
													fontSize: AppFontSize.extraSmall,
													fontWeight: FontWeight.w500,
													color: isLight ? AppTextColorLight.secondary : AppTextColorDark.placeholder,
													letterSpacing: 0.5,
												),
											),
										Text(
											nameText,
											style: TextStyle(
												fontSize: AppFontSize.extraSmall,
												fontWeight: FontWeight.w500,
												color: nameColor,
											),
										),
									],
								),
							),
							// Input source on the right
							if (inputValue != null && inputOptions != null && inputOptions.isNotEmpty)
								GestureDetector(
									onTap: _isSending
											? null
											: () => _showInputSelectorSheet(inputOptions!, inputValue, item.inputPropertyId!),
									child: Container(
										padding: EdgeInsets.symmetric(
											horizontal: AppSpacings.pMd,
											vertical: AppSpacings.pSm,
										),
										decoration: BoxDecoration(
											color: isDark
													? AppFillColorDark.base
													: AppFillColorLight.base,
											borderRadius: BorderRadius.circular(AppBorderRadius.base),
											border: Border.all(
												color: isDark
														? AppBorderColorDark.dark
														: AppBorderColorLight.dark,
											),
										),
										child: Row(
											mainAxisSize: MainAxisSize.min,
											children: [
												Text(
													_inputSourceLabel(context, inputValue),
													style: TextStyle(
														fontSize: AppFontSize.extraSmall,
														fontWeight: FontWeight.w500,
														color: isDark
																? AppTextColorDark.regular
																: AppTextColorLight.regular,
													),
												),
												AppSpacings.spacingXsHorizontal,
												Icon(
													MdiIcons.chevronDown,
													size: _scale(12),
													color: isDark
															? AppTextColorDark.regular
															: AppTextColorLight.regular,
												),
											],
										),
									),
								)
							else if (inputValue != null)
								Container(
									padding: EdgeInsets.symmetric(
										horizontal: AppSpacings.pMd,
										vertical: AppSpacings.pSm,
									),
									decoration: BoxDecoration(
										color: isDark
												? AppFillColorDark.base
												: AppFillColorLight.base,
										borderRadius: BorderRadius.circular(AppBorderRadius.base),
										border: Border.all(
											color: isDark
													? AppBorderColorDark.dark
													: AppBorderColorLight.dark,
										),
									),
									child: Text(
										_inputSourceLabel(context, inputValue),
										style: TextStyle(
											fontSize: AppFontSize.extraSmall,
											fontWeight: FontWeight.w500,
											color: isDark
													? AppTextColorDark.regular
													: AppTextColorLight.regular,
										),
									),
								),
						],
					);
				}).toList(),
			),
		);
	}

	Widget _buildVolumeControl(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final accentColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		final volume = _volume;
		final isMuted = _isMuted;

		final columnWidth = _scale(40);

		return Row(
			children: [
				SizedBox(
					width: columnWidth,
					child: Material(
						color: isMuted
								? (isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight9)
								: (isDark ? AppFillColorDark.base : AppFillColorLight.base),
						borderRadius: BorderRadius.circular(AppBorderRadius.medium),
						child: InkWell(
							onTap: _isSending
									? null
									: () {
											HapticFeedback.lightImpact();
											_toggleMute();
										},
							borderRadius: BorderRadius.circular(AppBorderRadius.medium),
							child: Container(
								padding: EdgeInsets.all(AppSpacings.pMd),
								decoration: BoxDecoration(
									border: Border.all(
										color: isMuted
												? (isDark ? AppColorsDark.primary : AppColorsLight.primary)
												: (isDark ? AppBorderColorDark.light : AppBorderColorLight.light),
									),
									borderRadius: BorderRadius.circular(AppBorderRadius.medium),
								),
								child: Icon(
									isMuted ? MdiIcons.volumeOff : MdiIcons.volumeHigh,
									size: AppFontSize.large,
									color: isMuted
											? (isDark ? AppColorsDark.primary : AppColorsLight.primary)
											: (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
								),
							),
						),
					),
				),
				AppSpacings.spacingMdHorizontal,
				Expanded(
					child: GestureDetector(
						onHorizontalDragUpdate: (_) {},
						child: SliderWithSteps(
							value: volume / 100,
							activeColor: accentColor,
							showSteps: false,
							enabled: !_isSending,
							onChanged: (val) => _setVolume((val * 100).round()),
						),
					),
				),
				AppSpacings.spacingMdHorizontal,
				SizedBox(
					width: columnWidth,
					child: Text(
						'$volume%',
						style: TextStyle(
							fontSize: AppFontSize.small,
							fontWeight: FontWeight.w600,
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
						textAlign: TextAlign.right,
					),
				),
			],
		);
	}

	Widget _buildPlaybackControl(BuildContext context) {
		final isPlaying = _playbackState == 'playing';
		final isPaused = _playbackState == 'paused';
		final isStopped = _playbackState == 'stopped' || _playbackState == null;

		return LayoutBuilder(
			builder: (context, constraints) {
				// Calculate if buttons fit: 5 buttons + 4 gaps
				// Default: 1 main (56) + 4 regular (44) = 232 + 4*pLg gaps
				final defaultTotal = _scale(56) + 4 * _scale(44) + 4 * AppSpacings.pLg;
				final compact = constraints.maxWidth < defaultTotal;
				final spacing = compact ? AppSpacings.pSm : AppSpacings.pLg;

				return Row(
					mainAxisAlignment: MainAxisAlignment.center,
					spacing: spacing,
					children: [
						_buildTransportButton(
							context,
							icon: MdiIcons.skipPrevious,
							compact: compact,
							onTap: _isSending ? null : () => _sendPlaybackCommand('previous'),
						),
						_buildTransportButton(
							context,
							icon: MdiIcons.play,
							isActive: isPlaying,
							isMain: true,
							compact: compact,
							onTap: _isSending ? null : () => _sendPlaybackCommand(isPlaying ? 'pause' : 'play'),
						),
						_buildTransportButton(
							context,
							icon: MdiIcons.pause,
							isActive: isPaused,
							compact: compact,
							onTap: _isSending ? null : () => _sendPlaybackCommand(isPaused ? 'play' : 'pause'),
						),
						_buildTransportButton(
							context,
							icon: MdiIcons.stop,
							isActive: isStopped && _playbackState != null,
							compact: compact,
							onTap: _isSending ? null : () => _sendPlaybackCommand('stop'),
						),
						_buildTransportButton(
							context,
							icon: MdiIcons.skipNext,
							compact: compact,
							onTap: _isSending ? null : () => _sendPlaybackCommand('next'),
						),
					],
				);
			},
		);
	}

	Widget _buildNowPlaying(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		return Column(
			crossAxisAlignment: CrossAxisAlignment.stretch,
			children: [
				if (_trackName != null)
					Text(
						_trackName!,
						style: TextStyle(
							fontSize: AppFontSize.large,
							fontWeight: FontWeight.w600,
							color: isDark ? AppTextColorDark.regular : AppTextColorLight.regular,
						),
						maxLines: 1,
						overflow: TextOverflow.ellipsis,
						textAlign: TextAlign.center,
					),
				if (_artistName != null)
					Text(
						_artistName!,
						style: TextStyle(
							fontSize: AppFontSize.small,
							color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
						),
						maxLines: 1,
						overflow: TextOverflow.ellipsis,
						textAlign: TextAlign.center,
					),
			],
		);
	}

	Widget _buildProgressBar(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final accentColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		final trackColor = isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
		final secondaryColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

		final pos = _position ?? 0;
		final dur = _duration ?? 1;
		final progress = (pos / dur).clamp(0.0, 1.0);

		final timeWidth = _scale(52);

		// Check if position property is writable for seek support
		final targets = _mediaService?.resolveControlTargets(_roomId);
		final posId = targets?.playbackTarget?.links.positionPropertyId;
		final isSeekable = posId != null && _devicesService != null &&
				(_devicesService!.getChannelProperty(posId)?.isWritable ?? false);

		return Row(
			children: [
				SizedBox(
					width: timeWidth,
					child: Text(
						_formatTime(pos.toInt()),
						style: TextStyle(
							fontSize: AppFontSize.extraSmall,
							color: secondaryColor,
						),
					),
				),
				AppSpacings.spacingMdHorizontal,
				Expanded(
					child: LayoutBuilder(
						builder: (context, constraints) {
							final barWidth = constraints.maxWidth;
							final bar = ClipRRect(
								borderRadius: BorderRadius.circular(_scale(2)),
								child: LinearProgressIndicator(
									value: progress,
									minHeight: _scale(3),
									backgroundColor: trackColor,
									valueColor: AlwaysStoppedAnimation<Color>(accentColor),
								),
							);

							if (!isSeekable) return bar;

							return GestureDetector(
								behavior: HitTestBehavior.opaque,
								onTapDown: (details) {
									final tapX = details.localPosition.dx;
									final ratio = (tapX / barWidth).clamp(0.0, 1.0);
									final newPos = (ratio * dur).roundToDouble();
									setState(() => _position = newPos);
									_devicesService!.setPropertyValue(posId, newPos.toInt());
								},
								child: Padding(
									padding: EdgeInsets.symmetric(vertical: _scale(20)),
									child: bar,
								),
							);
						},
					),
				),
				AppSpacings.spacingMdHorizontal,
				SizedBox(
					width: timeWidth,
					child: Text(
						_formatTime(dur.toInt()),
						style: TextStyle(
							fontSize: AppFontSize.extraSmall,
							color: secondaryColor,
						),
						textAlign: TextAlign.right,
					),
				),
			],
		);
	}

	String _formatTime(int totalSeconds) {
		final hours = totalSeconds ~/ 3600;
		final minutes = (totalSeconds % 3600) ~/ 60;
		final seconds = totalSeconds % 60;
		if (hours > 0) {
			return '$hours:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
		}
		return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
	}

	Widget _buildTransportButton(
		BuildContext context, {
		required IconData icon,
		bool isMain = false,
		bool isActive = false,
		bool compact = false,
		VoidCallback? onTap,
	}) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final accentColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		final baseColor = isDark ? AppFillColorDark.base : AppFillColorLight.base;

		final size = _scale(isMain ? (compact ? 44 : 56) : (compact ? 34 : 44));
		final iconSize = _scale(isMain ? (compact ? 22 : 28) : (compact ? 16 : 20));

		final Color bgColor;
		final Color iconColor;
		final BorderSide borderSide;

		if (isActive) {
			bgColor = accentColor;
			iconColor = Colors.white;
			borderSide = BorderSide.none;
		} else {
			bgColor = baseColor;
			iconColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
			borderSide = BorderSide(color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light);
		}

		return SizedBox(
			width: size,
			height: size,
			child: Material(
				color: bgColor,
				shape: CircleBorder(side: borderSide),
				child: InkWell(
					onTap: onTap == null
							? null
							: () {
									HapticFeedback.lightImpact();
									onTap();
								},
					customBorder: const CircleBorder(),
					splashColor: isActive
							? AppColors.white.withValues(alpha: 0.2)
							: accentColor.withValues(alpha: 0.15),
					highlightColor: isActive
							? AppColors.white.withValues(alpha: 0.1)
							: accentColor.withValues(alpha: 0.08),
					child: Icon(
						icon,
						size: iconSize,
						color: iconColor,
					),
				),
			),
		);
	}

	Widget _buildRemoteButton(BuildContext context) {
		final isLight = Theme.of(context).brightness == Brightness.light;

		return Material(
			color: isLight ? AppFillColorLight.base : AppFillColorDark.base,
			borderRadius: BorderRadius.circular(AppBorderRadius.base),
			child: InkWell(
				onTap: _isSending
						? null
						: () {
								HapticFeedback.lightImpact();
								_showRemote();
							},
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
				child: Container(
					padding: AppSpacings.paddingMd,
					decoration: BoxDecoration(
						borderRadius: BorderRadius.circular(AppBorderRadius.base),
						border: isLight ? Border.all(color: AppBorderColorLight.base) : null,
					),
					child: Row(
						mainAxisAlignment: MainAxisAlignment.center,
						children: [
							Icon(
								MdiIcons.remote,
								size: _scale(18),
								color: isLight ? AppTextColorLight.regular : AppTextColorDark.regular,
							),
							AppSpacings.spacingXsHorizontal,
							Text(
								'Remote Control',
								style: TextStyle(
									fontSize: AppFontSize.small,
									fontWeight: FontWeight.w500,
									color: isLight ? AppTextColorLight.regular : AppTextColorDark.regular,
								),
							),
						],
					),
				),
			),
		);
	}

	Widget _buildFailureDetails(BuildContext context, MediaActiveStateModel state) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final errorColor = isDark ? AppColorsDark.error : AppColorsLight.error;
		final errorBg = isDark ? AppColorsDark.errorLight9 : AppColorsLight.errorLight9;

		final errorCount = state.lastResult?.errorCount ?? 0;
		final warningCount = state.lastResult?.warningCount ?? 0;

		return Container(
			width: double.infinity,
			padding: AppSpacings.paddingMd,
			decoration: BoxDecoration(
				color: errorBg,
				borderRadius: BorderRadius.circular(AppBorderRadius.medium),
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					Row(
						children: [
							Icon(
								MdiIcons.alertCircleOutline,
								color: errorColor,
								size: _scale(18),
							),
							AppSpacings.spacingSmHorizontal,
							Expanded(
								child: Text(
									'Activity failed to apply ($errorCount error${errorCount != 1 ? 's' : ''}, $warningCount warning${warningCount != 1 ? 's' : ''})',
									style: TextStyle(fontWeight: FontWeight.w600, color: errorColor, fontSize: AppFontSize.small),
								),
							),
						],
					),
					AppSpacings.spacingMdVertical,
					Row(
						children: [
							OutlinedButton.icon(
								icon: Icon(MdiIcons.refresh, size: _scale(16)),
								label: const Text('Retry'),
								onPressed: () => _retryActivity(state),
							),
							AppSpacings.spacingMdHorizontal,
							OutlinedButton.icon(
								icon: Icon(MdiIcons.stop, size: _scale(16)),
								label: const Text('Deactivate'),
								onPressed: _deactivateActivity,
							),
						],
					),
				],
			),
		);
	}

	void _showFailureDetailsSheet(BuildContext context, MediaActiveStateModel state) {
		final lastResult = state.lastResult;
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final errors = lastResult?.errors ?? [];
		final warnings = lastResult?.warnings ?? [];

		final bgColor = isDark ? AppFillColorDark.base : AppFillColorLight.blank;
		final handleColor = isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
		final textColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
		final secondaryColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

		showModalBottomSheet(
			context: context,
			isScrollControlled: true,
			backgroundColor: AppColors.blank,
			builder: (ctx) {
				return Container(
					decoration: BoxDecoration(
						color: bgColor,
						borderRadius: BorderRadius.vertical(top: Radius.circular(_scale(24))),
					),
					child: SafeArea(
						top: false,
						child: Padding(
							padding: EdgeInsets.fromLTRB(
								AppSpacings.pLg,
								_scale(12),
								AppSpacings.pLg,
								AppSpacings.pXl,
							),
							child: Column(
								mainAxisSize: MainAxisSize.min,
								crossAxisAlignment: CrossAxisAlignment.start,
								children: [
									// Handle
									Center(
										child: Container(
											width: _scale(36),
											height: _scale(4),
											decoration: BoxDecoration(
												color: handleColor,
												borderRadius: BorderRadius.circular(AppBorderRadius.small),
											),
										),
									),
									AppSpacings.spacingMdVertical,

									// Header with close button
									Row(
										mainAxisAlignment: MainAxisAlignment.spaceBetween,
										children: [
											Text(
												'Activation Details',
												style: TextStyle(
													color: textColor,
													fontSize: AppFontSize.extraLarge,
													fontWeight: FontWeight.w600,
												),
											),
											GestureDetector(
												onTap: () => Navigator.pop(ctx),
												child: Container(
													width: _scale(32),
													height: _scale(32),
													decoration: BoxDecoration(
														color: handleColor,
														borderRadius: BorderRadius.circular(_scale(16)),
													),
													child: Icon(
														MdiIcons.close,
														color: secondaryColor,
														size: _scale(18),
													),
												),
											),
										],
									),
									AppSpacings.spacingLgVertical,

									// Summary counts
									if (lastResult != null) ...[
										Wrap(
											spacing: AppSpacings.pMd,
											runSpacing: AppSpacings.pSm,
											children: [
												_summaryChip('Total', lastResult.stepsTotal, Colors.grey),
												_summaryChip('OK', lastResult.stepsSucceeded, Colors.green),
												_summaryChip('Errors', lastResult.errorCount, Colors.red),
												_summaryChip('Warnings', lastResult.warningCount, Colors.orange),
											],
										),
										AppSpacings.spacingLgVertical,
									],

									// Errors
									if (errors.isNotEmpty) ...[
										Text(
											'Errors (critical)',
											style: TextStyle(
												fontWeight: FontWeight.w600,
												color: Colors.red.shade700,
												fontSize: AppFontSize.small,
											),
										),
										AppSpacings.spacingSmVertical,
										...errors.map((f) => _failureRow(f, Colors.red)),
										AppSpacings.spacingMdVertical,
									],

									// Warnings
									if (warnings.isNotEmpty) ...[
										Text(
											'Warnings (non-critical)',
											style: TextStyle(
												fontWeight: FontWeight.w600,
												color: Colors.orange.shade700,
												fontSize: AppFontSize.small,
											),
										),
										AppSpacings.spacingSmVertical,
										...warnings.map((f) => _failureRow(f, Colors.orange)),
										AppSpacings.spacingMdVertical,
									],

									// Legacy string warnings
									if (state.warnings.isNotEmpty && warnings.isEmpty) ...[
										Text(
											'Warnings',
											style: TextStyle(
												fontWeight: FontWeight.w600,
												color: Colors.orange.shade700,
												fontSize: AppFontSize.small,
											),
										),
										AppSpacings.spacingSmVertical,
										...state.warnings.map((w) => Padding(
											padding: EdgeInsets.only(bottom: AppSpacings.pSm),
											child: Text('- $w', style: TextStyle(fontSize: AppFontSize.small)),
										)),
										AppSpacings.spacingMdVertical,
									],

									// Actions
									AppSpacings.spacingMdVertical,
									Row(
										children: [
											if (state.isFailed && state.activityKey != null)
												Expanded(
													child: FilledButton.icon(
														icon: Icon(MdiIcons.refresh, size: _scale(16)),
														label: const Text('Retry activity'),
														onPressed: () {
															Navigator.pop(ctx);
															_retryActivity(state);
														},
													),
												),
											if (state.isFailed) AppSpacings.spacingMdHorizontal,
											Expanded(
												child: OutlinedButton.icon(
													icon: Icon(MdiIcons.stop, size: _scale(16)),
													label: const Text('Deactivate'),
													onPressed: () {
														Navigator.pop(ctx);
														_deactivateActivity();
													},
												),
											),
										],
									),
								],
							),
						),
					),
				);
			},
		);
	}

	Widget _summaryChip(String label, int count, Color color) {
		return Container(
			padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd, vertical: AppSpacings.pSm),
			decoration: BoxDecoration(
				color: color.withValues(alpha: 0.1),
				borderRadius: BorderRadius.circular(AppBorderRadius.medium),
			),
			child: Text(
				'$label: $count',
				style: TextStyle(fontSize: AppFontSize.extraSmall, fontWeight: FontWeight.w600, color: color),
			),
		);
	}

	Widget _failureRow(MediaStepFailureModel failure, Color color) {
		return Padding(
			padding: EdgeInsets.only(bottom: AppSpacings.pSm),
			child: Container(
				width: double.infinity,
				padding: EdgeInsets.all(AppSpacings.pMd),
				decoration: BoxDecoration(
					color: color.withValues(alpha: 0.05),
					borderRadius: BorderRadius.circular(AppBorderRadius.base),
					border: Border.all(color: color.withValues(alpha: 0.2)),
				),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						if (failure.label != null)
							Text(
								failure.label!,
								style: TextStyle(fontSize: AppFontSize.small, fontWeight: FontWeight.w600, color: color),
							),
						Text(
							failure.reason,
							style: TextStyle(fontSize: AppFontSize.extraSmall, color: color.withValues(alpha: 0.8)),
						),
						if (failure.targetDeviceId != null)
							Text(
								'Device: ${failure.targetDeviceId}',
								style: TextStyle(fontSize: AppFontSize.extraSmall, color: Colors.grey.shade600),
							),
					],
				),
			),
		);
	}

	void _retryActivity(MediaActiveStateModel state) {
		if (state.activityKey != null) {
			_onActivitySelected(state.activityKey!);
		}
	}

	void _deactivateActivity() {
		_onActivitySelected(MediaActivityKey.off);
	}

	// ============================================
	// DEVICES LIST (restyled)
	// ============================================

	Widget _buildDevicesList(
		BuildContext context,
		List<MediaDeviceGroup> deviceGroups,
	) {
		final localizations = AppLocalizations.of(context)!;
		final activeState = _mediaService?.getActiveState(_roomId);

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			children: [
				SectionTitle(
					title: localizations.media_targets_title,
					icon: MdiIcons.monitorSpeaker,
				),
				AppSpacings.spacingMdVertical,
				if (deviceGroups.isEmpty)
					Text(
						localizations.media_no_bindings_description,
						style: Theme.of(context).textTheme.bodyMedium,
					)
				else
					...deviceGroups.map(
						(group) => Padding(
							padding: EdgeInsets.only(bottom: AppSpacings.pMd),
							child: _buildDeviceTile(context, group, activeState),
						),
					),
			],
		);
	}

	String _deviceStatus(MediaDeviceGroup group, MediaActiveStateModel? activeState) {
		if (activeState == null || activeState.isDeactivated) return 'Standby';

		final resolved = activeState.resolved;
		if (resolved == null) return 'Standby';

		final deviceId = group.deviceId;
		final isResolved = resolved.displayDeviceId == deviceId ||
				resolved.audioDeviceId == deviceId ||
				resolved.sourceDeviceId == deviceId ||
				resolved.remoteDeviceId == deviceId;

		if (!isResolved) return 'Standby';

		if (activeState.isActivating) return 'Activating...';
		if (activeState.isFailed) return 'Failed';
		if (activeState.isDeactivating) return 'Stopping...';
		if (activeState.isActiveWithWarnings) return 'Active with issues';
		if (activeState.isActive) return 'Active';

		return 'Ready';
	}

	Widget _buildDeviceTile(BuildContext context, MediaDeviceGroup group, MediaActiveStateModel? activeState) {
		final isDark = Theme.of(context).brightness == Brightness.dark;


		final accessories = Row(
			mainAxisSize: MainAxisSize.min,
			children: [
				..._deviceCapabilityIcons(group).take(3).map((capIcon) {
					return Padding(
						padding: EdgeInsets.only(left: AppSpacings.pSm),
						child: Container(
							width: _scale(22),
							height: _scale(22),
							decoration: BoxDecoration(
								color: isDark ? AppFillColorDark.base : AppFillColorLight.base,
								borderRadius: BorderRadius.circular(AppBorderRadius.base),
							),
							child: Icon(
								capIcon,
								size: _scale(12),
								color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
							),
						),
					);
				}),
				AppSpacings.spacingMdHorizontal,
				Icon(
					MdiIcons.chevronRight,
					size: _scale(28),
					color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
				),
			],
		);

		final status = _deviceStatus(group, activeState);

		return OrientationBuilder(
			builder: (context, orientation) {
				if (orientation == Orientation.landscape) {
					return DeviceTileLandscape(
						icon: _deviceGroupIcon(group),
						name: group.deviceName,
						status: status,
						onTileTap: () => _navigateToDeviceDetail(group),
						accessories: accessories,
					);
				}
				return DeviceTilePortrait(
					icon: _deviceGroupIcon(group),
					name: group.deviceName,
					status: status,
					onTileTap: () => _navigateToDeviceDetail(group),
					accessories: accessories,
				);
			},
		);
	}

	List<IconData> _deviceCapabilityIcons(MediaDeviceGroup group) {
		final icons = <IconData>[];
		if (group.hasDisplay) icons.add(MdiIcons.television);
		if (group.hasAudio) icons.add(MdiIcons.volumeHigh);
		if (group.hasSource) icons.add(MdiIcons.playCircle);
		if (group.hasRemote) icons.add(MdiIcons.remote);
		return icons;
	}

	// ============================================
	// HELPERS
	// ============================================

	String _activityLabel(MediaActivityKey? key) {
		switch (key) {
			case MediaActivityKey.watch:
				return 'Watch';
			case MediaActivityKey.listen:
				return 'Listen';
			case MediaActivityKey.gaming:
				return 'Gaming';
			case MediaActivityKey.background:
				return 'Bgnd';
			case MediaActivityKey.off:
			case null:
				return 'Off';
		}
	}

	IconData _activityIcon(MediaActivityKey? key) {
		switch (key) {
			case MediaActivityKey.watch:
				return MdiIcons.television;
			case MediaActivityKey.listen:
				return MdiIcons.musicNote;
			case MediaActivityKey.gaming:
				return MdiIcons.gamepadVariant;
			case MediaActivityKey.background:
				return MdiIcons.speaker;
			case MediaActivityKey.off:
			case null:
				return MdiIcons.powerPlugOff;
		}
	}

	IconData _deviceGroupIcon(MediaDeviceGroup group) {
		if (group.hasDisplay) return MdiIcons.television;
		if (group.hasAudio) return MdiIcons.speaker;
		if (group.hasSource) return MdiIcons.playCircle;
		if (group.hasRemote) return MdiIcons.remote;
		return MdiIcons.devices;
	}

	IconData _roleIcon(String role) {
		switch (role.toLowerCase()) {
			case 'display':
				return MdiIcons.television;
			case 'audio':
				return MdiIcons.volumeHigh;
			case 'source':
				return MdiIcons.playCircle;
			default:
				return MdiIcons.devices;
		}
	}


	String _inputSourceLabel(BuildContext context, String source) => _mediaInputSourceLabel(context, source);

	void _navigateToDeviceDetail(MediaDeviceGroup group) {
		Navigator.push(
			context,
			MaterialPageRoute(
				builder: (context) => MediaDeviceDetailPage(
					spaceId: _roomId,
					deviceGroup: group,
				),
			),
		);
	}

	void _setVolume(int volume) {
		setState(() => _volume = volume);

		final targets = _mediaService?.resolveControlTargets(_roomId);
		final propId = targets?.volumeTarget?.links.volumePropertyId;
		if (propId == null || _devicesService == null) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Volume: no property ID (propId=$propId, links=${targets?.volumeTarget?.links.raw})');
			}
			return;
		}

		_volumeDebounceTimer?.cancel();
		_volumeDebounceTimer = Timer(const Duration(milliseconds: 150), () {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Setting volume=$volume on property=$propId');
			}
			_devicesService!.setPropertyValue(propId, volume);
		});
	}

	void _toggleMute() {
		final newMuted = !_isMuted;
		setState(() => _isMuted = newMuted);

		final targets = _mediaService?.resolveControlTargets(_roomId);
		final propId = targets?.volumeTarget?.links.mutePropertyId;
		if (propId == null || _devicesService == null) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Mute: no property ID (propId=$propId, links=${targets?.volumeTarget?.links.raw})');
			}
			return;
		}

		if (kDebugMode) {
			debugPrint('[MediaDomainViewPage] Setting mute=$newMuted on property=$propId');
		}
		_devicesService!.setPropertyValue(propId, newMuted);
	}

	void _showInputSelectorSheet(List<String> sources, String? currentValue, String propId) {
		final localizations = AppLocalizations.of(context)!;

		showModalBottomSheet(
			context: context,
			isScrollControlled: true,
			backgroundColor: AppColors.blank,
			builder: (ctx) => ValueSelectorSheet<String>(
				currentValue: currentValue,
				options: sources
						.map((s) => ValueOption<String>(value: s, label: _inputSourceLabel(context, s)))
						.toList(),
				title: localizations.media_input_select_title,
				columns: 3,
				onConfirm: (value) {
					Navigator.pop(ctx);
					if (value != null) {
						_devicesService!.setPropertyValue(propId, value);
					}
				},
			),
		);
	}

	void _sendPlaybackCommand(String command) {
		final targets = _mediaService?.resolveControlTargets(_roomId);
		final propId = targets?.playbackTarget?.links.playbackCommandId;
		if (propId == null || _devicesService == null) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Playback: no property ID (propId=$propId, links=${targets?.playbackTarget?.links.raw})');
			}
			return;
		}

		// Optimistic state: map command to expected status
		final optimisticState = switch (command) {
			'play' => 'playing',
			'pause' => 'paused',
			'stop' => 'stopped',
			_ => _playbackState,
		};
		setState(() => _playbackState = optimisticState);

		// Block _syncDeviceState from overwriting during settle window.
		// After timeout, re-read the actual device value (backend truth).
		_playbackSettleTimer?.cancel();
		_playbackSettleTimer = Timer(const Duration(seconds: 3), () {
			if (!mounted) return;
			_syncDeviceState();
			setState(() {});
		});

		if (kDebugMode) {
			debugPrint('[MediaDomainViewPage] Sending playback=$command on property=$propId');
		}
		_devicesService!.setPropertyValue(propId, command);
	}

	void _showRemote() {
		final targets = _mediaService?.resolveControlTargets(_roomId);
		if (targets == null || !targets.hasRemote) return;

		final deviceGroups = _mediaService?.getDeviceGroups(_roomId) ?? [];
		final remoteDeviceId = targets.remoteTarget!.deviceId;
		final remoteGroup = deviceGroups.cast<MediaDeviceGroup?>().firstWhere(
			(g) => g!.deviceId == remoteDeviceId,
			orElse: () => null,
		);

		if (remoteGroup != null) {
			_navigateToDeviceDetail(remoteGroup);
		}
	}
}

// ============================================================================
// COMPOSITION DISPLAY ITEM
// ============================================================================

class _CompositionDisplayItem {
	final String role;
	final String displayName;
	final bool isOnline;
	final String? inputPropertyId;

	const _CompositionDisplayItem({
		required this.role,
		required this.displayName,
		required this.isOnline,
		this.inputPropertyId,
	});
}

// ============================================================================
// SPINNER ARC PAINTER
// ============================================================================

class _SpinnerArcPainter extends CustomPainter {
	final Color color;

	_SpinnerArcPainter({required this.color});

	@override
	void paint(Canvas canvas, Size size) {
		final paint = Paint()
			..color = color
			..style = PaintingStyle.stroke
			..strokeWidth = 3
			..strokeCap = StrokeCap.round;

		final rect = Rect.fromLTWH(0, 0, size.width, size.height);
		canvas.drawArc(rect, -math.pi / 2, math.pi / 2, false, paint);
	}

	@override
	bool shouldRepaint(covariant _SpinnerArcPainter oldDelegate) {
		return oldDelegate.color != color;
	}
}

// ============================================================================
// DEVICE DETAIL PAGE
// ============================================================================

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
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDeviceDetailPage] Failed to get DevicesService: $e');
			}
		}
	}

	@override
	void dispose() {
		_volumeDebounceTimer?.cancel();
		_socketService?.removeConnectionListener(_onConnectionChanged);
		super.dispose();
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
		return GestureDetector(
			behavior: HitTestBehavior.opaque,
			onTap: () {},
			child: Container(
				color: Colors.black.withValues(alpha: 0.7),
				child: Center(
					child: Card(
						margin: EdgeInsets.all(AppSpacings.pXl + AppSpacings.pMd),
						child: Padding(
							padding: EdgeInsets.all(AppSpacings.pXl),
							child: Column(
								mainAxisSize: MainAxisSize.min,
								children: [
									Icon(MdiIcons.wifiOff, size: _scale(48), color: Colors.grey),
									AppSpacings.spacingLgVertical,
									Text(
										'Connection lost',
										style: Theme.of(context).textTheme.titleMedium,
										textAlign: TextAlign.center,
									),
									AppSpacings.spacingMdVertical,
									Text(
										'Media controls require a live WebSocket connection.',
										style: Theme.of(context).textTheme.bodySmall,
										textAlign: TextAlign.center,
									),
									AppSpacings.spacingLgVertical,
									OutlinedButton(
										onPressed: () => Navigator.of(context).pop(),
										child: const Text('Go back'),
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
		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppBorderRadius.round)),
			child: Padding(
				padding: EdgeInsets.all(AppSpacings.pLg),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: 'Display', icon: MdiIcons.television),
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
		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppBorderRadius.round)),
			margin: EdgeInsets.only(top: AppSpacings.pMd),
			child: Padding(
				padding: EdgeInsets.all(AppSpacings.pLg),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: 'Audio', icon: MdiIcons.speaker),
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
		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppBorderRadius.round)),
			margin: EdgeInsets.only(top: AppSpacings.pMd),
			child: Padding(
				padding: EdgeInsets.all(AppSpacings.pLg),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: 'Source', icon: MdiIcons.playCircle),
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
		final remoteEndpoint = _group.remoteEndpoint;

		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppBorderRadius.round)),
			margin: EdgeInsets.only(top: AppSpacings.pMd),
			child: Padding(
				padding: EdgeInsets.all(AppSpacings.pLg),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: 'Remote', icon: MdiIcons.remote),
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
												child: const Text('OK'),
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
												child: const Text('Back'),
											),
											AppSpacings.spacingLgHorizontal,
											TextButton(
												onPressed: () => _sendRemoteCommand(remoteEndpoint, 'home'),
												child: const Text('Home'),
											),
											AppSpacings.spacingLgHorizontal,
											TextButton(
												onPressed: () => _sendRemoteCommand(remoteEndpoint, 'menu'),
												child: const Text('Menu'),
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
				const Text('Input'),
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
						child: const Text('Select'),
					)
				else
					TextButton(
						onPressed: null,
						child: const Text('Select'),
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
						'Now Playing',
						style: Theme.of(context).textTheme.labelSmall,
					),
					AppSpacings.spacingSmVertical,
					if (!hasData)
						Text(
							'No track information available',
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

		// Remote commands use the playback command ID as the command channel
		final propId = endpoint.links.playbackCommandId;
		if (propId != null) {
			_devicesService!.setPropertyValue(propId, command);
		}
	}
}
