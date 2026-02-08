/// Media domain view: room-level media control for a single space/room.
///
/// **Purpose:** One screen per room for AV control: activity selection (Watch,
/// Listen, Gaming, Background, Off), composition preview (Display/Audio/Source
/// roles and input source), volume/mute, playback transport, progress bar,
/// and remote control. Media-capable devices are listed in a bottom sheet
/// opened from the header.
///
/// **Data flow:**
/// - [MediaActivityService] provides active state, endpoints, control targets
///   (volume, playback, display, remote), and device groups for the room.
/// - [DevicesService] provides live device views and property values (volume,
///   mute, playback state, track metadata, position/duration) used for UI.
/// - [SpacesService] provides room name. [DeckService] / [EventBus] for navigation.
/// - Local state: _volume, _isMuted, _playbackState, _trackName, _artistName,
///   _position, _duration are synced from device properties in [_syncDeviceState].
///
/// **Key concepts:**
/// - Activity on/off and mode (Watch/Listen/etc.) are server-driven; volume,
///   mute, and playback commands are sent to device properties with optimistic
///   UI and debounce/settle timers where needed.
/// - Portrait: activity content card + mode selector at bottom. Landscape:
///   main content + vertical mode selector + optional controls column (volume,
///   mute, playback tile, remote).
/// - Failure/warning state: inline banners and [_showFailureDetailsSheet] for
///   step results; retry and deactivate actions.
///
/// **File structure (for humans and AI):**
/// Search for the exact section header (e.g. "// CONSTANTS", "// LIFECYCLE") to
/// jump to that part of the file. Sections appear in this order:
///
/// - **CONSTANTS** — debounce/settle durations for volume and playback.
/// - **MEDIA DOMAIN VIEW PAGE** — [MediaDomainViewPage] and state: LIFECYCLE,
///   LISTENERS, STATE SYNC, NAVIGATION, ACTIVITY ACTIONS, BUILD.
/// - **HEADER, THEME & LABELS** — header builder, mode colors, activity labels/icons.
/// - **LAYOUTS** — portrait/landscape, activity content, mode selector.
/// - **STATE CONTENT** — off, activating, failed content builders.
/// - **ACTIVE CARD** — composition preview, warnings, volume/playback/remote controls.
/// - **FAILURE DETAILS** — inline failure, sheet, retry/deactivate.
/// - **LANDSCAPE CONTROLS** — playback tile, volume selector, mute, remote.
/// - **HELPERS** — activity/device labels and icons, navigation, device sheet.
/// - **ACTIONS** — volume, mute, input selector, playback command, playback sheet, remote.
/// - **DATA MODELS / PAINTER** — [_CompositionDisplayItem], [_SpinnerArcPainter].
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:event_bus/event_bus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_banner.dart';
import 'package:fastybird_smart_panel/core/widgets/app_card.dart';
import 'package:fastybird_smart_panel/core/widgets/app_bottom_sheet.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/domain_data_loader.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_page_activated_event.dart';
import 'package:fastybird_smart_panel/modules/deck/utils/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/media_input_source_label.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/media_activity/media_activity.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/services/media_activity_service.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

// =============================================================================
// CONSTANTS
// =============================================================================
// Debounce and settle timers for volume (avoid flooding backend) and playback
// (optimistic UI until device state is re-read).

class _MediaDomainConstants {
	/// Volume slider debounce (ms) before sending value to device.
	static const int volumeDebounceMs = 150;

	/// Playback command settle window (seconds) before re-reading device state.
	static const int playbackSettleSeconds = 3;
}

// =============================================================================
// MEDIA DOMAIN VIEW PAGE
// =============================================================================

class MediaDomainViewPage extends StatefulWidget {
	final DomainViewItem viewItem;

	const MediaDomainViewPage({super.key, required this.viewItem});

	@override
	State<MediaDomainViewPage> createState() => _MediaDomainViewPageState();
}

class _MediaDomainViewPageState extends State<MediaDomainViewPage>
		with SingleTickerProviderStateMixin {
	final ScreenService _screenService = locator<ScreenService>();

	double? get _portraitContentHeight =>
			_screenService.isPortrait ? _screenService.screenHeight * 3 / 5 : null;

	MediaActivityService? _mediaService;
	SpacesService? _spacesService;
	EventBus? _eventBus;
	SocketService? _socketService;
	DevicesService? _devicesService;
	BottomNavModeNotifier? _bottomNavModeNotifier;
	StreamSubscription<DeckPageActivatedEvent>? _pageActivatedSubscription;
	bool _isActivePage = false;

	bool _isLoading = true;
	bool _hasError = false;
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

	/// Notifier to rebuild playback sheet when state changes.
	final ValueNotifier<int> _playbackSheetNotifier = ValueNotifier(0);

	late AnimationController _pulseController;

	String get _roomId => widget.viewItem.roomId;

	T? _tryLocator<T extends Object>(String debugLabel, {void Function(T)? onSuccess}) {
		try {
			final s = locator<T>();
			onSuccess?.call(s);
			return s;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Failed to get $debugLabel: $e');
			}
			return null;
		}
	}

	// -------------------------------------------------------------------------
	// LIFECYCLE
	// -------------------------------------------------------------------------

	@override
	void initState() {
		super.initState();

		_pulseController = AnimationController(
			vsync: this,
			duration: const Duration(milliseconds: 1500),
		)..repeat();

		_mediaService = _tryLocator<MediaActivityService>('MediaActivityService', onSuccess: (s) => s.addListener(_onDataChanged));
		_spacesService = _tryLocator<SpacesService>('SpacesService');
		_eventBus = _tryLocator<EventBus>('EventBus');
		_socketService = _tryLocator<SocketService>('SocketService', onSuccess: (s) => s.addConnectionListener(_onConnectionChanged));
		if (_socketService != null) _wsConnected = _socketService!.isConnected;
		_devicesService = _tryLocator<DevicesService>('DevicesService', onSuccess: (s) => s.addListener(_onDevicesChanged));
		_bottomNavModeNotifier = _tryLocator<BottomNavModeNotifier>('BottomNavModeNotifier');

		// Subscribe to page activation events for bottom nav mode registration
		_pageActivatedSubscription = _eventBus?.on<DeckPageActivatedEvent>().listen(_onPageActivated);

		// Fetch data immediately (not deferred)
		_fetchMediaData();
	}

	/// Fetches media activity for the room and syncs device state; clears loading.
	Future<void> _fetchMediaData() async {
		if (_mediaService == null) {
			if (mounted) {
				setState(() {
					_isLoading = false;
					_hasError = false;
				});
				_registerModeConfig();
			}
			return;
		}
		try {
			// Check if data is already available (cached) before fetching
			final existingEndpoints = _mediaService!.getEndpoints(_roomId);
			if (existingEndpoints.isEmpty) {
				await _mediaService!.fetchAllForSpace(_roomId);
			}

			if (mounted) {
				_syncDeviceState();
				setState(() {
					_isLoading = false;
					_hasError = false;
				});
				_registerModeConfig();
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Failed to fetch media data: $e');
			}
			if (mounted) {
				setState(() {
					_isLoading = false;
					_hasError = true;
				});
			}
		}
	}

	/// Retry loading data after an error.
	Future<void> _retryLoad() async {
		setState(() {
			_isLoading = true;
			_hasError = false;
		});
		await _fetchMediaData();
	}

	/// Called by RefreshIndicator; re-fetches and syncs state.
	Future<void> _refresh() async {
		await _fetchMediaData();
	}

	@override
	void dispose() {
		_pageActivatedSubscription?.cancel();
		_volumeDebounceTimer?.cancel();
		_playbackSettleTimer?.cancel();
		_playbackSheetNotifier.dispose();
		_pulseController.dispose();
		_mediaService?.removeListener(_onDataChanged);
		_devicesService?.removeListener(_onDevicesChanged);
		_socketService?.removeConnectionListener(_onConnectionChanged);
		super.dispose();
	}

	// -------------------------------------------------------------------------
	// LISTENERS
	// -------------------------------------------------------------------------

	// -------------------------------------------------------------------------
	// BOTTOM NAV MODE REGISTRATION
	// -------------------------------------------------------------------------

	void _onPageActivated(DeckPageActivatedEvent event) {
		if (!mounted) return;
		_isActivePage = event.itemId == widget.viewItem.id;

		if (_isActivePage) {
			_registerModeConfig();
		}
	}

	void _registerModeConfig() {
		if (!_isActivePage || _isLoading) return;

		final activeState = _mediaService?.getActiveState(_roomId);
		final currentKey = _getSelectedActivityKey(activeState) ?? MediaActivityKey.off;
		final modeOptions = _getActivityModeOptions();
		if (modeOptions.isEmpty) return;

		final currentOption = modeOptions.firstWhere(
			(o) => o.value == currentKey,
			orElse: () => modeOptions.first,
		);

		_bottomNavModeNotifier?.setConfig(BottomNavModeConfig(
			icon: currentOption.icon,
			label: currentOption.label,
			color: currentOption.color ?? ThemeColors.neutral,
			popupBuilder: _buildModePopupContent,
		));
	}

	Widget _buildModePopupContent(BuildContext context, VoidCallback dismiss) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final modes = _getActivityModeOptions();
		final activeState = _mediaService?.getActiveState(_roomId);
		final selectedKey = _getSelectedActivityKey(activeState);

		return Column(
			mainAxisSize: MainAxisSize.min,
			crossAxisAlignment: CrossAxisAlignment.start,
			children: [
				Padding(
					padding: EdgeInsets.only(bottom: AppSpacings.pSm),
					child: Text(
						'ACTIVITY',
						style: TextStyle(
							fontSize: AppFontSize.extraSmall,
							fontWeight: FontWeight.w600,
							letterSpacing: 1.0,
							color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
						),
					),
				),
				for (final mode in modes)
					_buildPopupModeItem(
						context,
						mode: mode,
						isActive: selectedKey == mode.value,
						onTap: () {
							_onActivitySelected(mode.value);
							dismiss();
						},
					),
			],
		);
	}

	Widget _buildPopupModeItem(
		BuildContext context, {
		required ModeOption<MediaActivityKey> mode,
		required bool isActive,
		required VoidCallback onTap,
	}) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final colorFamily = ThemeColorFamily.get(
			isDark ? Brightness.dark : Brightness.light,
			mode.color ?? ThemeColors.neutral,
		);

		return GestureDetector(
			onTap: (!_wsConnected || _isSending) ? null : onTap,
			behavior: HitTestBehavior.opaque,
			child: Container(
				padding: EdgeInsets.symmetric(
					vertical: AppSpacings.pMd,
					horizontal: AppSpacings.pMd,
				),
				margin: EdgeInsets.only(bottom: AppSpacings.pXs),
				decoration: BoxDecoration(
					color: isActive ? colorFamily.light9 : Colors.transparent,
					borderRadius: BorderRadius.circular(AppBorderRadius.small),
					border: isActive
						? Border.all(color: colorFamily.light7, width: AppSpacings.scale(1))
						: null,
				),
				child: Row(
					spacing: AppSpacings.pMd,
					children: [
						Icon(
							mode.icon,
							color: isActive ? colorFamily.base : (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
							size: AppSpacings.scale(20),
						),
						Expanded(
							child: Text(
								mode.label,
								style: TextStyle(
									fontSize: AppFontSize.base,
									fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
									color: isActive ? colorFamily.base : (isDark ? AppTextColorDark.regular : AppTextColorLight.regular),
								),
							),
						),
						if (isActive)
							Icon(Icons.check, color: colorFamily.base, size: AppSpacings.scale(16)),
					],
				),
			),
		);
	}

	void _onDataChanged() {
		if (!mounted) return;
		_syncDeviceState();
		_playbackSheetNotifier.value++;
		WidgetsBinding.instance.addPostFrameCallback((_) {
			if (mounted) {
				setState(() {});
				_registerModeConfig();
			}
		});
	}

	void _onDevicesChanged() {
		if (!mounted) return;
		// Sync volume/mute from device properties when backend pushes updates
		// Skip if a debounce timer is active (user is dragging the slider)
		if (_volumeDebounceTimer == null || !_volumeDebounceTimer!.isActive) {
			_syncDeviceState();
			_playbackSheetNotifier.value++;
			WidgetsBinding.instance.addPostFrameCallback((_) {
				if (mounted) {
					setState(() {});
					_registerModeConfig();
				}
			});
		}
	}

	// -------------------------------------------------------------------------
	// STATE SYNC
	// -------------------------------------------------------------------------
	/// Reads volume, mute, playback state, track metadata, position/duration from
	/// device properties. Called on data changes and after fetch; skips playback
	/// state during optimistic settle window.
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
					_playbackState = val is StringValueType ? val.value : null;
				} else {
					_playbackState = null;
				}
			}

			// Track metadata
			final trackId = playbackLinks.trackMetadataPropertyId;
			if (trackId != null) {
				final prop = _devicesService?.getChannelProperty(trackId);
				_trackName = prop?.value is StringValueType ? (prop!.value as StringValueType).value : null;
			} else {
				_trackName = null;
			}

			final artistId = playbackLinks.artistPropertyId;
			if (artistId != null) {
				final prop = _devicesService?.getChannelProperty(artistId);
				_artistName = prop?.value is StringValueType ? (prop!.value as StringValueType).value : null;
			} else {
				_artistName = null;
			}

			// Position & duration
			final posId = playbackLinks.positionPropertyId;
			if (posId != null) {
				final prop = _devicesService?.getChannelProperty(posId);
				final val = prop?.value;
				_position = val is NumberValueType ? val.value.toDouble() : null;
			} else {
				_position = null;
			}

			final durId = playbackLinks.durationPropertyId;
			if (durId != null) {
				final prop = _devicesService?.getChannelProperty(durId);
				final val = prop?.value;
				_duration = val is NumberValueType ? val.value.toDouble() : null;
			} else {
				_duration = null;
			}
		} else {
			// No playback target — clear all metadata
			_playbackState = null;
			_trackName = null;
			_artistName = null;
			_position = null;
			_duration = null;
		}
	}

	void _onConnectionChanged(bool isConnected) {
		if (!mounted) return;
		setState(() => _wsConnected = isConnected);
	}

	// -------------------------------------------------------------------------
	// NAVIGATION
	// -------------------------------------------------------------------------



	// -------------------------------------------------------------------------
	// ACTIVITY ACTIONS
	// -------------------------------------------------------------------------

	Future<void> _onActivitySelected(MediaActivityKey key) async {
		if (_mediaService == null || _isSending) return;

		// Skip if the selected activity is already active
		final activeState = _mediaService!.getActiveState(_roomId);
		if (activeState != null && (activeState.isActive || activeState.isActivating) && activeState.activityKey == key) return;
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

	// -------------------------------------------------------------------------
	// BUILD
	// -------------------------------------------------------------------------

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;

		// Handle loading and error states using DomainStateView
		final loadState = _isLoading
				? DomainLoadState.loading
				: _hasError
						? DomainLoadState.error
						: DomainLoadState.loaded;

		if (loadState != DomainLoadState.loaded) {
			return DomainStateView(
				state: loadState,
				onRetry: _retryLoad,
				domainName: localizations.domain_media,
				child: const SizedBox.shrink(),
			);
		}

		return Consumer<MediaActivityService>(
			builder: (context, mediaService, _) {
				final isDark = Theme.of(context).brightness == Brightness.dark;
				final activeState = mediaService.getActiveState(_roomId);
				final endpoints = mediaService.getEndpoints(_roomId);
				final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';
				final hasEndpoints = endpoints.isNotEmpty;

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
												padding: AppSpacings.paddingXl,
												children: [
													SizedBox(height: AppSpacings.pXl * 2),
													Icon(
														MdiIcons.monitorOff,
														size: AppSpacings.scale(64),
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
				final isDeactivating = activeState?.isDeactivating ?? false;
				final showOffContent = isOff || isDeactivating;
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
																	context, activeState, showOffContent, isActivating, isFailed)
															: _buildPortraitLayout(
																	context, activeState, showOffContent, isActivating, isFailed);
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

	// =============================================================================
	// HEADER
	// =============================================================================

	Widget _buildHeader(
		BuildContext context,
		String roomName,
		MediaActiveStateModel? activeState,
	) {
		final localizations = AppLocalizations.of(context)!;
		final hasActive = activeState != null && activeState.isActive;
		final subtitle = hasActive
				? localizations.media_activity_active(_activityLabel(context, activeState.activityKey))
				: localizations.media_mode_off;

		final modeColorFamily = _getModeColorFamily(context);
		final deviceGroups = _mediaService?.getDeviceGroups(_roomId) ?? [];
		final showDevicesButton = deviceGroups.isNotEmpty;

		return PageHeader(
			title: localizations.domain_media,
			subtitle: subtitle,
			subtitleColor: hasActive ? modeColorFamily.dark2 : null,
			leading: HeaderMainIcon(
				icon: MdiIcons.playBoxOutline,
				color: _getModeColor(),
			),
			trailing: showDevicesButton
				? HeaderIconButton(
						icon: MdiIcons.monitorSpeaker,
						onTap: _showMediaDevicesSheet,
					)
				: null,
		);
	}

	// =============================================================================
	// THEME & LABELS
	// =============================================================================
	// Mode → theme color (primary when active, neutral when off). Use
	// [_getModeColor] and [_getModeColorFamily] as the only source of color
	// for the domain view.

	/// Current activity key from media service (for color resolution when not passed).
	MediaActivityKey _getCurrentActivityKey() {
		final activeState = _mediaService?.getActiveState(_roomId);
		return _getSelectedActivityKey(activeState) ?? MediaActivityKey.off;
	}

	/// Theme color for current or given activity. Use this (and [_getModeColorFamily])
	/// for all mode-based colors; avoid using [ThemeColors] or [AppColors*] directly.
	ThemeColors _getModeColor([MediaActivityKey? mode]) {
		final key = mode ?? _getCurrentActivityKey();
		return key == MediaActivityKey.off ? ThemeColors.neutral : ThemeColors.primary;
	}

	/// Resolved colors for current mode (used for header subtitle, accents, borders).
	ThemeColorFamily _getModeColorFamily(BuildContext context, [MediaActivityKey? mode]) =>
		ThemeColorFamily.get(Theme.of(context).brightness, _getModeColor(mode));

	// =============================================================================
	// PORTRAIT LAYOUT
	// =============================================================================

	Widget _buildPortraitLayout(
		BuildContext context,
		MediaActiveStateModel? activeState,
		bool showOffContent,
		bool isActivating,
		bool isFailed,
	) {
		final content = showOffContent
			? _buildOffStateContent(context)
			: isActivating
				? _buildActivatingContent(context, activeState!)
				: isFailed
					? _buildFailedContent(context, activeState!)
					: _buildActivityContent(context, activeState);
		return PortraitViewLayout(
			content: content,
			scrollable: !showOffContent && !isActivating && !isFailed,
			modeSelector: null,
		);
	}

	// =============================================================================
	// LANDSCAPE LAYOUT
	// =============================================================================

	Widget _buildLandscapeLayout(
		BuildContext context,
		MediaActiveStateModel? activeState,
		bool showOffContent,
		bool isActivating,
		bool isFailed,
	) {
		final isLargeScreen = _screenService.isLargeScreen;
		final mainContent = showOffContent
			? _buildOffStateContent(context)
			: isActivating
				? _buildActivatingContent(context, activeState!)
				: isFailed
					? _buildFailedContent(context, activeState!)
					: _buildActivityContent(context, activeState);
		return LandscapeViewLayout(
			mainContent: mainContent,
			mainContentScrollable: false,
			modeSelector: _buildLandscapeModeSelector(
				context,
				activeState,
				showLabels: isLargeScreen,
			),
			modeSelectorShowLabels: isLargeScreen,
			additionalContent: !showOffContent && !isActivating && !isFailed
				? Column(
						crossAxisAlignment: CrossAxisAlignment.start,
						spacing: AppSpacings.pLg,
						children: [
							_buildLandscapeControls(context),
						],
					)
				: null,
		);
	}

	// =============================================================================
	// ACTIVITY CONTENT (state-dependent)
	// =============================================================================

	Widget _buildActivityContent(
		BuildContext context,
		MediaActiveStateModel? activeState,
	) {
		// Off, deactivating, activating and failed are handled at layout level; this is only for active.
		final content = _buildActiveCard(context, activeState!);

		return AppCard(
			width: double.infinity,
			child: content,
		);
	}

	// =============================================================================
	// MODE SELECTOR
	// =============================================================================

	List<ModeOption<MediaActivityKey>> _getActivityModeOptions() {
		final availableKeys = _mediaService?.getAvailableActivities(_roomId) ?? MediaActivityKey.values;
		return availableKeys.map((key) => ModeOption<MediaActivityKey>(
			value: key,
			icon: _activityIcon(key),
			label: _activityLabel(context, key),
			color: _getModeColor(key),
		)).toList();
	}

	MediaActivityKey? _getSelectedActivityKey(MediaActiveStateModel? activeState) {
		if (activeState == null || activeState.isDeactivated || activeState.isDeactivating) {
			return MediaActivityKey.off;
		}
		return activeState.activityKey ?? MediaActivityKey.off;
	}


	Widget _buildLandscapeModeSelector(
		BuildContext context,
		MediaActiveStateModel? activeState, {
		bool showLabels = false,
	}) {
		return IgnorePointer(
			ignoring: !_wsConnected || _isSending,
			child: ModeSelector<MediaActivityKey>(
				modes: _getActivityModeOptions(),
				selectedValue: _getSelectedActivityKey(activeState),
				onChanged: _onActivitySelected,
				orientation: ModeSelectorOrientation.vertical,
				iconPlacement: ModeSelectorIconPlacement.top,
				showLabels: showLabels,
			),
		);
	}

	// =============================================================================
	// OFF STATE CONTENT
	// =============================================================================

	Widget _buildOffStateContent(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		return Container(
			width: double.infinity,
			height: double.infinity,
			alignment: Alignment.center,
			child: Column(
				mainAxisAlignment: MainAxisAlignment.center,
				mainAxisSize: MainAxisSize.min,
				spacing: AppSpacings.pMd,
				children: [
					Container(
						width: AppSpacings.scale(90),
						height: AppSpacings.scale(90),
						decoration: BoxDecoration(
							color: isDark ? AppFillColorDark.darker : AppFillColorLight.darker,
							shape: BoxShape.circle,
						),
						child: Icon(
							MdiIcons.televisionClassic,
							size: AppSpacings.scale(56),
							color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
						),
					),
					Text(
						AppLocalizations.of(context)!.media_off_title,
						style: TextStyle(
							fontSize: AppFontSize.extraLarge,
							fontWeight: FontWeight.w600,
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					),
					Text(
						AppLocalizations.of(context)!.media_off_subtitle,
						style: TextStyle(
							fontSize: AppFontSize.base,
							color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
						),
					),
				],
			),
		);
	}

	// =============================================================================
	// ACTIVATING STATE CONTENT
	// =============================================================================

	Widget _buildActivatingContent(BuildContext context, MediaActiveStateModel activeState) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final modeColorFamily = _getModeColorFamily(context);
		final localizations = AppLocalizations.of(context)!;
		final activityName = _activityLabel(context, activeState.activityKey);

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
									width: AppSpacings.scale(56),
									height: AppSpacings.scale(56),
									decoration: BoxDecoration(
										shape: BoxShape.circle,
										border: Border.all(
											color: modeColorFamily.base.withValues(alpha: 0.2),
											width: AppSpacings.scale(3),
										),
									),
									child: CustomPaint(
										painter: _SpinnerArcPainter(
											color: modeColorFamily.base,
											strokeWidth: AppSpacings.scale(3),
										),
									),
								),
							);
						},
					),
					SizedBox(height: AppSpacings.pLg),
					Text(
						localizations.media_starting_activity(activityName),
						style: TextStyle(
							fontSize: AppFontSize.large,
							fontWeight: FontWeight.w600,
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					),
					if (activeState.planSteps.isNotEmpty) ...[
						SizedBox(height: AppSpacings.pLg),
						Center(
							child: IntrinsicWidth(
								child: Column(
									crossAxisAlignment: CrossAxisAlignment.start,
									children: activeState.planSteps
											.map((step) => _buildActivationStep(context, step, modeColorFamily))
											.toList(),
								),
							),
						),
					],
				],
			),
		);
	}

	String _translateStepLabel(BuildContext context, String label) {
		final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';

		// Translate input source values: "Set display input to hdmi1" → "Set display input to HDMI 1"
		final inputMatch = RegExp(r'^(Set \w+ input to )(.+)$').firstMatch(label);
		if (inputMatch != null) {
			return '${inputMatch.group(1)}${mediaInputSourceLabel(context, inputMatch.group(2)!)}';
		}

		// Strip room name and endpoint type suffix from device names:
		// "Power on Living Room Samsung TV (Display)" → "Power on Samsung TV"
		final powerMatch = RegExp(r'^(Power on )(.+)$').firstMatch(label);
		if (powerMatch != null) {
			var deviceName = powerMatch.group(2)!;
			deviceName = _stripEndpointTypeSuffix(deviceName);
			return '${powerMatch.group(1)}${stripRoomNameFromDevice(deviceName, roomName)}';
		}

		return label;
	}

	String _stripEndpointTypeSuffix(String name) {
		return name.replaceFirst(RegExp(r'\s*\((Display|Audio Output|Source|Remote Target)\)$'), '');
	}

	Widget _buildActivationStep(BuildContext context, MediaActivationPlanStepModel step, ThemeColorFamily modeColorFamily) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final Color iconColor;
		final IconData iconData;
		final Color textColor;

		switch (step.status) {
			case MediaStepStatus.succeeded:
				iconColor = isDark ? AppColorsDark.success : AppColorsLight.success;
				iconData = Icons.check;
				textColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
			case MediaStepStatus.failed:
				iconColor = isDark ? AppColorsDark.error : AppColorsLight.error;
				iconData = Icons.close;
				textColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
			case MediaStepStatus.executing:
				iconColor = modeColorFamily.base;
				iconData = Icons.circle;
				textColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
			case MediaStepStatus.pending:
				iconColor = isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder;
				iconData = Icons.circle_outlined;
				textColor = isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder;
		}

		return Padding(
			padding: EdgeInsets.symmetric(
				vertical: AppSpacings.pXs,
				horizontal: AppSpacings.pLg,
			),
			child: Row(
				children: [
					AnimatedBuilder(
						animation: _pulseController,
						builder: (context, child) {
							return Opacity(
								opacity: step.status == MediaStepStatus.executing
										? 0.5 + 0.5 * math.sin(_pulseController.value * 2 * math.pi)
										: 1.0,
								child: Icon(iconData, size: AppSpacings.scale(16), color: iconColor),
							);
						},
					),
					SizedBox(width: AppSpacings.pMd),
					Expanded(
						child: Text(
							_translateStepLabel(context, step.label),
							style: TextStyle(
								fontSize: AppFontSize.small,
								color: textColor,
							),
						),
					),
				],
			),
		);
	}

	// =============================================================================
	// FAILED STATE CONTENT
	// =============================================================================

	Widget _buildFailedContent(BuildContext context, MediaActiveStateModel activeState) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final errorColor = isDark ? AppColorsDark.error : AppColorsLight.error;
		final errorBg = isDark ? AppColorsDark.errorLight9 : AppColorsLight.errorLight9;
		final localizations = AppLocalizations.of(context)!;
		final activityName = _activityLabel(context, activeState.activityKey);

		return Container(
			width: double.infinity,
			height: double.infinity,
			alignment: Alignment.center,
			child: Column(
				mainAxisAlignment: MainAxisAlignment.center,
				mainAxisSize: MainAxisSize.min,
				spacing: AppSpacings.pMd,
				children: [
					Container(
						width: AppSpacings.scale(90),
						height: AppSpacings.scale(90),
						decoration: BoxDecoration(
							color: errorBg,
							shape: BoxShape.circle,
						),
						child: Icon(
							MdiIcons.closeCircleOutline,
							size: AppSpacings.scale(56),
							color: errorColor,
						),
					),
					Text(
						localizations.media_activity_failed(activityName),
						style: TextStyle(
							fontSize: AppFontSize.extraLarge,
							fontWeight: FontWeight.w600,
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					),
					Text(
						localizations.media_activity_failed_description,
						style: TextStyle(
							fontSize: AppFontSize.base,
							color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
						),
					),
					Row(
						mainAxisAlignment: MainAxisAlignment.center,
						spacing: AppSpacings.pMd,
						children: [
							Theme(
								data: ThemeData(
									filledButtonTheme: isDark ? AppFilledButtonsDarkThemes.primary : AppFilledButtonsLightThemes.primary,
								),
								child: FilledButton(
									onPressed: () => _retryActivity(activeState),
									style: FilledButton.styleFrom(
										textStyle: TextStyle(fontSize: AppFontSize.small),
										padding: EdgeInsets.symmetric(
											horizontal: AppSpacings.scale(AppSpacings.pMd),
											vertical: AppSpacings.scale(AppSpacings.pSm),
										),
									),
									child: Text(localizations.media_activity_retry),
								),
							),
							Theme(
								data: ThemeData(
									outlinedButtonTheme: isDark ? AppOutlinedButtonsDarkThemes.base : AppOutlinedButtonsLightThemes.base,
								),
								child: OutlinedButton(
									onPressed: _deactivateActivity,
									style: OutlinedButton.styleFrom(
										textStyle: TextStyle(fontSize: AppFontSize.small),
										padding: EdgeInsets.symmetric(
											horizontal: AppSpacings.scale(AppSpacings.pMd),
											vertical: AppSpacings.scale(AppSpacings.pSm),
										),
									),
									child: Text(localizations.media_activity_turn_off),
								),
							),
						],
					),
				],
			),
		);
	}

	// =============================================================================
	// ACTIVE ACTIVITY CARD
	// =============================================================================

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
			var name = device != null
					? stripRoomNameFromDevice(device.name, roomName)
					: entry.endpointName;
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

		final cardSpacing = _screenService.isSmallScreen
				? AppSpacings.pMd
				: AppSpacings.pLg;
        
		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
			spacing: cardSpacing,
			children: [
					// Warning banner
					if (activeState.hasWarnings && !activeState.isFailed) ...[
						_buildWarningBannerForState(context, activeState),
					],

					// Offline device banner
					if (offlineRoles.isNotEmpty && !activeState.hasWarnings) ...[
						_buildOfflineDeviceBanner(context, offlineRoles),
					],

					// Composition preview
					if (displayItems.isNotEmpty) ...[
						_buildCompositionPreview(context, displayItems),
					],

					// Capability-driven controls
					if (_trackName != null || _artistName != null) ...[
						_buildNowPlaying(context),
					],
					if (targets.hasPlayback && (_screenService.isPortrait || _screenService.isLargeScreen)) ...[
						_buildPlaybackControl(context),
					],
					if (_duration != null && _duration! > 0) ...[
						_buildProgressBar(context),
					],
					if (targets.hasVolume && !_screenService.isLandscape) ...[
						_buildVolumeControl(context),
					],
					if (targets.hasRemote && !_screenService.isLandscape) ...[
						_buildRemoteButton(context),
					],

					// Failure details
				if (activeState.isFailed) ...[
					_buildFailureDetails(context, activeState),
				],
			],
		);
	}

	Widget _buildWarningBannerForState(BuildContext context, MediaActiveStateModel state) {
		final localizations = AppLocalizations.of(context)!;
		final warningCount = state.lastResult?.warningCount ?? state.warnings.length;
		final label = warningCount > 0
			? localizations.media_warning_steps_failed(warningCount)
			: state.warnings.isNotEmpty
				? state.warnings.first
				: localizations.media_warning_steps_had_issues;
		return AlertBanner(
			text: label,
			color: ThemeColors.warning,
			onTap: () => _showFailureDetailsSheet(context, state),
		);
	}

	Widget _buildOfflineDeviceBanner(BuildContext context, List<String> offlineRoles) {
		final localizations = AppLocalizations.of(context)!;
		final label = offlineRoles.length == 1 && offlineRoles.first == 'Audio'
			? localizations.media_warning_audio_offline
			: localizations.media_warning_some_devices_offline;
		return AlertBanner(
			text: label,
			color: ThemeColors.warning,
		);
	}

	Widget _buildCompositionPreview(BuildContext context, List<_CompositionDisplayItem> items) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;

		return Container(
			padding: AppSpacings.paddingMd,
			decoration: BoxDecoration(
				color: isDark ? AppFillColorDark.darker : AppFillColorLight.darker,
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
			),
			child: Column(
				spacing: AppSpacings.pMd,
				children: items.map((item) {
					final icon = _roleIcon(item.role);
					final nameText = item.isOnline ? item.displayName : '${item.displayName} (offline)';
					final nameColor = item.isOnline
							? (isDark ? AppTextColorDark.primary : AppTextColorLight.primary)
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
						spacing: AppSpacings.pMd,
						children: [
							Container(
								width: AppSpacings.scale(32),
								height: AppSpacings.scale(32),
								decoration: BoxDecoration(
									color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
									borderRadius: BorderRadius.circular(AppBorderRadius.base),
								),
								child: Icon(
									icon,
									size: AppSpacings.scale(16),
									color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
								),
							),
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
													color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.secondary,
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
								Theme(
									data: isDark
										? ThemeData(brightness: Brightness.dark, outlinedButtonTheme: AppOutlinedButtonsDarkThemes.neutral)
										: ThemeData(outlinedButtonTheme: AppOutlinedButtonsLightThemes.neutral),
									child: OutlinedButton(
										onPressed: _isSending
											? null
											: () => _showInputSelectorSheet(inputOptions!, inputValue, item.inputPropertyId!),
										style: OutlinedButton.styleFrom(
											padding: EdgeInsets.symmetric(
												horizontal: AppSpacings.pMd,
												vertical: AppSpacings.pMd,
											),
											minimumSize: Size.zero,
											tapTargetSize: MaterialTapTargetSize.shrinkWrap,
										),
										child: Row(
											mainAxisSize: MainAxisSize.min,
											spacing: AppSpacings.pXs,
											children: [
												Text(
													mediaInputSourceLabel(context, inputValue),
													style: TextStyle(
														fontSize: AppFontSize.extraSmall,
														fontWeight: FontWeight.w500,
													),
												),
												Icon(
													MdiIcons.chevronDown,
													size: AppFontSize.extraSmall,
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
													? AppBorderColorDark.light
													: AppBorderColorLight.darker,
											width: AppSpacings.scale(1),
										),
									),
									child: Text(
										mediaInputSourceLabel(context, inputValue),
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
		final volume = _volume;
		final isMuted = _isMuted;

		final columnWidth = AppSpacings.scale(40);

		return Row(
			spacing: AppSpacings.pMd,
			children: [
				SizedBox(
					width: columnWidth,
					child: Theme(
						data: isMuted
							? ThemeData(filledButtonTheme: isDark ? AppFilledButtonsDarkThemes.primary : AppFilledButtonsLightThemes.primary)
							: (isDark ? ThemeData(filledButtonTheme: AppFilledButtonsDarkThemes.neutral) : ThemeData(filledButtonTheme: AppFilledButtonsLightThemes.neutral)),
						child: FilledButton(
							onPressed: _isSending ? null : () {
								HapticFeedback.lightImpact();
								_toggleMute();
							},
							style: FilledButton.styleFrom(
								padding: AppSpacings.paddingMd,
								minimumSize: Size(columnWidth, columnWidth),
								maximumSize: Size(columnWidth, columnWidth),
							),
							child: Icon(
								isMuted ? MdiIcons.volumeOff : MdiIcons.volumeHigh,
								size: AppFontSize.large,
								color: isDark
									? (isMuted
										? AppFilledButtonsDarkThemes.primaryForegroundColor
										: AppFilledButtonsDarkThemes.neutralForegroundColor)
									: (isMuted
										? AppFilledButtonsLightThemes.primaryForegroundColor
										: AppFilledButtonsLightThemes.neutralForegroundColor),
							),
						),
					),
				),
				Expanded(
					child: SliderWithSteps(
							value: volume / 100,
							themeColor: _getModeColor(),
							showSteps: false,
							enabled: !_isSending,
							onChanged: (val) => _setVolume((val * 100).round()),
						),
				),
				SizedBox(
					width: columnWidth,
					child: Text(
						AppLocalizations.of(context)!.media_volume_percent(volume),
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

		// Read supported commands from the playback command property format
		final targets = _mediaService?.resolveControlTargets(_roomId);
		final cmdPropId = targets?.playbackTarget?.links.playbackCommandId;
		Set<String> supported = {'play', 'pause', 'stop', 'previous', 'next'};
		if (cmdPropId != null && _devicesService != null) {
			final prop = _devicesService!.getChannelProperty(cmdPropId);
			if (prop?.format is StringListFormatType) {
				supported = (prop!.format as StringListFormatType).value.toSet();
			}
		}

		// Define button specs: (command, icon, isMain, isActive)
		final specs = <(String, IconData, bool, bool)>[
			if (supported.contains('previous')) ('previous', MdiIcons.skipPrevious, false, false),
			if (supported.contains('play')) ('play', MdiIcons.play, true, isPlaying),
			if (supported.contains('pause')) ('pause', MdiIcons.pause, false, isPaused),
			if (supported.contains('stop')) ('stop', MdiIcons.stop, false, isStopped && _playbackState != null),
			if (supported.contains('next')) ('next', MdiIcons.skipNext, false, false),
		];

		if (specs.isEmpty) return const SizedBox.shrink();

		return LayoutBuilder(
			builder: (context, constraints) {
				final mainCount = specs.where((s) => s.$3).length;
				final regularCount = specs.length - mainCount;
				final gapCount = specs.length - 1;
				final defaultTotal = mainCount * AppSpacings.scale(56) + regularCount * AppSpacings.scale(44) + gapCount * AppSpacings.pLg;
				final compact = constraints.maxWidth < defaultTotal;

				return Row(
					mainAxisAlignment: MainAxisAlignment.center,
					spacing: compact ? AppSpacings.pSm : AppSpacings.pLg,
					children: specs.map((spec) {
						final (cmd, icon, isMain, isActive) = spec;
						return _buildTransportButton(
							context,
							icon: icon,
							isMain: isMain,
							isActive: isActive,
							compact: compact,
							onTap: _isSending ? null : () => _sendPlaybackCommand(
								cmd == 'play' && isPlaying ? 'pause' :
								cmd == 'pause' && isPaused ? 'play' : cmd,
							),
						);
					}).toList(),
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
		final modeColorFamily = _getModeColorFamily(context);
		final trackColor = isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
		final secondaryColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

		final pos = _position ?? 0;
		final dur = _duration ?? 1;
		final progress = (pos / dur).clamp(0.0, 1.0);

		final timeWidth = AppSpacings.scale(52);

		// Check if position property is writable for seek support
		final targets = _mediaService?.resolveControlTargets(_roomId);
		final posId = targets?.playbackTarget?.links.positionPropertyId;
		final isSeekable = posId != null && _devicesService != null &&
				(_devicesService!.getChannelProperty(posId)?.isWritable ?? false);

		return Row(
			spacing: AppSpacings.pMd,
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
				Expanded(
					child: LayoutBuilder(
						builder: (context, constraints) {
							final barWidth = constraints.maxWidth;
							final bar = ClipRRect(
								borderRadius: BorderRadius.circular(AppBorderRadius.base),
								child: LinearProgressIndicator(
									value: progress,
									minHeight: AppSpacings.scale(3),
									backgroundColor: trackColor,
									valueColor: AlwaysStoppedAnimation<Color>(modeColorFamily.base),
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
									padding: EdgeInsets.symmetric(vertical: AppSpacings.pLg),
									child: bar,
								),
							);
						},
					),
				),
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
		final size = AppSpacings.scale(isMain ? (compact ? 44 : 56) : (compact ? 34 : 44));
		final iconSize = AppSpacings.scale(isMain ? (compact ? 22 : 28) : (compact ? 16 : 20));
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final themeData = isActive
			? ThemeData(filledButtonTheme: isDark ? AppFilledButtonsDarkThemes.primary : AppFilledButtonsLightThemes.primary)
			: (isDark ? ThemeData(filledButtonTheme: AppFilledButtonsDarkThemes.neutral) : ThemeData(filledButtonTheme: AppFilledButtonsLightThemes.neutral));

		return SizedBox(
			width: size,
			height: size,
			child: Theme(
				data: themeData,
				child: FilledButton(
					onPressed: onTap == null
						? null
						: () {
							HapticFeedback.lightImpact();
							onTap();
						},
					style: FilledButton.styleFrom(
						padding: EdgeInsets.zero,
						minimumSize: Size(size, size),
						maximumSize: Size(size, size),
						shape: const CircleBorder(),
						tapTargetSize: MaterialTapTargetSize.shrinkWrap,
					),
					child: Icon(
						icon,
						size: iconSize,
						color: isDark
							? (isActive
								? AppFilledButtonsDarkThemes.primaryForegroundColor
								: AppFilledButtonsDarkThemes.neutralForegroundColor)
							: (isActive
								? AppFilledButtonsLightThemes.primaryForegroundColor
								: AppFilledButtonsLightThemes.neutralForegroundColor),
					),
				),
			),
		);
	}

	Widget _buildRemoteButton(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final themeData = isDark ? ThemeData(filledButtonTheme: AppFilledButtonsDarkThemes.neutral) : ThemeData(filledButtonTheme: AppFilledButtonsLightThemes.neutral);

		return SizedBox(
			width: double.infinity,
			child: Theme(
				data: themeData,
				child: FilledButton(
					onPressed: _isSending
						? null
						: () {
							HapticFeedback.lightImpact();
							_showRemote();
						},
					style: FilledButton.styleFrom(
						padding: AppSpacings.paddingMd,
					),
					child: Row(
					mainAxisSize: MainAxisSize.min,
					mainAxisAlignment: MainAxisAlignment.center,
					spacing: AppSpacings.pXs,
					children: [
						Icon(
							MdiIcons.remote,
							size: AppFontSize.base,
							color: isDark
								? AppFilledButtonsDarkThemes.neutralForegroundColor
								: AppFilledButtonsLightThemes.neutralForegroundColor,
						),
						Text(
							AppLocalizations.of(context)!.media_remote_control),
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
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				spacing: AppSpacings.pMd,
				children: [
					Row(
						spacing: AppSpacings.pSm,
						children: [
							Icon(
								MdiIcons.alertCircleOutline,
								color: errorColor,
								size: AppSpacings.scale(18),
							),
							Expanded(
								child: Text(
									AppLocalizations.of(context)!.media_failure_inline(errorCount, warningCount),
									style: TextStyle(fontWeight: FontWeight.w600, color: errorColor, fontSize: AppFontSize.small),
								),
							),
						],
					),
					Row(
						spacing: AppSpacings.pMd,
						children: [
							Theme(
								data: ThemeData(
									filledButtonTheme: Theme.of(context).brightness == Brightness.dark
										? AppFilledButtonsDarkThemes.primary
										: AppFilledButtonsLightThemes.primary,
								),
								child: FilledButton.icon(
									icon: Icon(
										MdiIcons.refresh,
										size: AppFontSize.small,
										color: Theme.of(context).brightness == Brightness.dark
											? AppFilledButtonsDarkThemes.primaryForegroundColor
											: AppFilledButtonsLightThemes.primaryForegroundColor,
									),
									label: Text(AppLocalizations.of(context)!.media_activity_retry),
									onPressed: () => _retryActivity(state),
									style: FilledButton.styleFrom(
										textStyle: TextStyle(fontSize: AppFontSize.small),
									),
								),
							),
							Theme(
								data: ThemeData(
									outlinedButtonTheme: Theme.of(context).brightness == Brightness.dark
										? AppOutlinedButtonsDarkThemes.base
										: AppOutlinedButtonsLightThemes.base,
								),
								child: OutlinedButton.icon(
									icon: Icon(
										MdiIcons.stop,
										size: AppFontSize.small,
										color: Theme.of(context).brightness == Brightness.dark
											? AppOutlinedButtonsDarkThemes.baseForegroundColor
											: AppOutlinedButtonsLightThemes.baseForegroundColor,
									),
									label: Text(AppLocalizations.of(context)!.media_failure_deactivate),
									onPressed: _deactivateActivity,
									style: OutlinedButton.styleFrom(
										textStyle: TextStyle(fontSize: AppFontSize.small),
									),
								),
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

		showAppBottomSheet(
			context,
			title: AppLocalizations.of(context)!.media_failure_details_title,
			content: Padding(
        padding: EdgeInsets.symmetric(horizontal: AppSpacings.pLg, vertical: AppSpacings.pMd),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: AppSpacings.pMd,
          children: [
            if (lastResult != null) ...[
              Wrap(
                spacing: AppSpacings.pMd,
                runSpacing: AppSpacings.pSm,
                children: [
                  _summaryChip(AppLocalizations.of(context)!.media_failure_summary_total, lastResult.stepsTotal, (isDark ? AppColorsDark.neutral : AppColorsLight.neutral), (isDark ? AppColorsDark.neutralLight9 : AppColorsLight.neutralLight9)),
                  _summaryChip(AppLocalizations.of(context)!.media_failure_summary_ok, lastResult.stepsSucceeded, (isDark ? AppColorsDark.success : AppColorsLight.success), (isDark ? AppColorsDark.successLight9 : AppColorsLight.successLight9)),
                  _summaryChip(AppLocalizations.of(context)!.media_failure_summary_errors, lastResult.errorCount, (isDark ? AppColorsDark.error : AppColorsLight.error), (isDark ? AppColorsDark.errorLight9 : AppColorsLight.errorLight9)),
                  _summaryChip(AppLocalizations.of(context)!.media_failure_summary_warnings, lastResult.warningCount, (isDark ? AppColorsDark.warning : AppColorsLight.warning), (isDark ? AppColorsDark.warningLight9 : AppColorsLight.warningLight9)),
                ],
              ),
            ],
            if (errors.isNotEmpty) ...[
              Text(
                AppLocalizations.of(context)!.media_failure_errors_critical,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: isDark ? AppColorsDark.error : AppColorsLight.error,
                  fontSize: AppFontSize.small,
                ),
              ),
              ...errors.map((f) => _failureRow(f, isDark ? AppColorsDark.error : AppColorsLight.error, _getModeColorFamily(context).light9)),
            ],
            if (warnings.isNotEmpty) ...[
              Text(
                AppLocalizations.of(context)!.media_failure_warnings_non_critical,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: isDark ? AppColorsDark.warning : AppColorsLight.warning,
                  fontSize: AppFontSize.small,
                ),
              ),
              ...warnings.map((f) => _failureRow(f, isDark ? AppColorsDark.warning : AppColorsLight.warning, _getModeColorFamily(context).light9)),
            ],
            if (state.warnings.isNotEmpty && warnings.isEmpty) ...[
              Text(
                AppLocalizations.of(context)!.media_failure_warnings_label,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: isDark ? AppColorsDark.warning : AppColorsLight.warning,
                  fontSize: AppFontSize.small,
                ),
              ),
              ...state.warnings.map((w) => Padding(
                padding: EdgeInsets.only(bottom: AppSpacings.pSm),
                child: Text('- $w', style: TextStyle(fontSize: AppFontSize.small)),
              )),
            ],
          ],
        ),
      ),
			bottomSection: Builder(
				builder: (sheetContext) {
					final isDark = Theme.of(sheetContext).brightness == Brightness.dark;
					return Row(
						spacing: AppSpacings.pMd,
						children: [
							if (state.isFailed && state.activityKey != null)
								Expanded(
									child: Theme(
										data: ThemeData(
											filledButtonTheme: isDark
												? AppFilledButtonsDarkThemes.primary
												: AppFilledButtonsLightThemes.primary,
										),
										child: FilledButton.icon(
											icon: Icon(
												MdiIcons.refresh,
												size: AppFontSize.small,
												color: isDark
													? AppFilledButtonsDarkThemes.primaryForegroundColor
													: AppFilledButtonsLightThemes.primaryForegroundColor,
											),
											label: Text(AppLocalizations.of(context)!.media_failure_retry_activity),
											onPressed: () {
												Navigator.pop(sheetContext);
												_retryActivity(state);
											},
											style: FilledButton.styleFrom(
												textStyle: TextStyle(fontSize: AppFontSize.small),
												padding: EdgeInsets.symmetric(horizontal: 0, vertical: AppSpacings.pMd),
												tapTargetSize: MaterialTapTargetSize.shrinkWrap,
											),
										),
									),
								),
							Expanded(
								child: Theme(
									data: ThemeData(
										outlinedButtonTheme: isDark
											? AppOutlinedButtonsDarkThemes.base
											: AppOutlinedButtonsLightThemes.base,
									),
									child: OutlinedButton.icon(
										icon: Icon(
											MdiIcons.stopCircleOutline,
											size: AppFontSize.small,
											color: isDark
												? AppOutlinedButtonsDarkThemes.baseForegroundColor
												: AppOutlinedButtonsLightThemes.baseForegroundColor,
										),
										label: Text(AppLocalizations.of(context)!.media_failure_deactivate),
										onPressed: () {
											Navigator.pop(sheetContext);
											_deactivateActivity();
										},
										style: OutlinedButton.styleFrom(
											textStyle: TextStyle(fontSize: AppFontSize.small),
											padding: EdgeInsets.symmetric(horizontal: 0, vertical: AppSpacings.pMd),
											tapTargetSize: MaterialTapTargetSize.shrinkWrap,
										),
									),
								),
							),
						],
					);
				},
			),
		);
	}

	Widget _summaryChip(String label, int count, Color textColor, Color backgroundColor) {
		return Container(
			padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd, vertical: AppSpacings.pSm),
			decoration: BoxDecoration(
				color: backgroundColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
			),
			child: Text(
				'$label: $count',
				style: TextStyle(fontSize: AppFontSize.extraSmall, fontWeight: FontWeight.w600, color: textColor),
			),
		);
	}

	Widget _failureRow(MediaStepFailureModel failure, Color textColor, Color backgroundColor) {
		return Padding(
			padding: EdgeInsets.only(bottom: AppSpacings.pSm),
			child: Container(
				width: double.infinity,
				padding: EdgeInsets.all(AppSpacings.pMd),
				decoration: BoxDecoration(
					color: backgroundColor,
					borderRadius: BorderRadius.circular(AppBorderRadius.base),
					border: Border.all(color: backgroundColor, width: AppSpacings.scale(1)),
				),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						if (failure.label != null)
							Text(
								failure.label!,
								style: TextStyle(fontSize: AppFontSize.small, fontWeight: FontWeight.w600, color: textColor),
							),
						Text(
							failure.reason,
							style: TextStyle(fontSize: AppFontSize.extraSmall, color: textColor),
						),
						if (failure.targetDeviceId != null)
							Text(
								AppLocalizations.of(context)!.media_failure_device_label(failure.targetDeviceId!),
								style: TextStyle(fontSize: AppFontSize.extraSmall, color: Theme.of(context).brightness == Brightness.dark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder),
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

	// =============================================================================
	// LANDSCAPE CONTROLS
	// =============================================================================

	Widget _buildLandscapeControls(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final modeColorFamily = _getModeColorFamily(context);
		final targets = _mediaService?.resolveControlTargets(_roomId);
		final tileHeight = AppSpacings.scale(AppTileHeight.horizontal);

		final controls = <Widget>[];

		// Playback tile (landscape small/medium only) — first in section
		if (targets?.hasPlayback == true && !_screenService.isLargeScreen) {
			controls.add(
				SizedBox(
					height: tileHeight,
					width: double.infinity,
					child: UniversalTile(
						layout: TileLayout.horizontal,
						icon: MdiIcons.playCircle,
						name: AppLocalizations.of(context)!.media_playback,
						isActive: false,
						activeColor: _getModeColor(),
						onTileTap: () {
							HapticFeedback.lightImpact();
							_showPlaybackSheet();
						},
						showGlow: false,
						showDoubleBorder: false,
						showInactiveBorder: true,
					),
				),
			);
		}

		// Volume control as ValueSelectorRow
		if (targets?.hasVolume == true) {
			final volumeOptions = [0, 25, 50, 75, 100].map((v) => ValueOption<int>(
				value: v,
				label: '$v%',
			)).toList();

			controls.add(
				SizedBox(
					height: tileHeight,
					width: double.infinity,
					child: ValueSelectorRow<int>(
						currentValue: _volume,
						label: localizations.media_volume,
						icon: MdiIcons.volumeHigh,
						sheetTitle: localizations.media_volume,
						activeColor: modeColorFamily.base,
						options: volumeOptions,
						displayFormatter: (v) => '${v ?? 0}%',
						columns: 5,
						layout: ValueSelectorRowLayout.compact,
						showChevron: true,
						onChanged: _isSending ? null : (v) {
							if (v != null) _setVolume(v);
						},
					),
				),
			);
		}

		// Mute toggle as UniversalTile
		if (targets?.hasVolume == true) {
			controls.add(
				SizedBox(
					height: tileHeight,
					width: double.infinity,
					child: UniversalTile(
						layout: TileLayout.horizontal,
						icon: _isMuted ? MdiIcons.volumeOff : MdiIcons.volumeHigh,
						name: localizations.media_action_mute,
						status: _isMuted ? localizations.on_state_on : localizations.on_state_off,
						isActive: _isMuted,
						activeColor: _getModeColor(),
						onTileTap: _isSending ? null : () {
							HapticFeedback.lightImpact();
							_toggleMute();
						},
						showGlow: false,
						showDoubleBorder: false,
						showInactiveBorder: true,
					),
				),
			);
		}

		// Remote control tile
		if (targets?.hasRemote == true) {
			controls.add(
				SizedBox(
					height: tileHeight,
					width: double.infinity,
					child: UniversalTile(
						layout: TileLayout.horizontal,
						icon: MdiIcons.remote,
						name: localizations.media_remote_control,
						isActive: false,
						activeColor: _getModeColor(),
						onTileTap: () {
							HapticFeedback.lightImpact();
							_showRemote();
						},
						showGlow: false,
						showDoubleBorder: false,
						showInactiveBorder: true,
					),
				),
			);
		}

		if (controls.isEmpty) return const SizedBox.shrink();

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
			children: [
				SectionTitle(
					title: localizations.device_controls,
					icon: MdiIcons.tuneVertical,
				),
				...controls,
			],
		);
	}

	bool _isDeviceActive(MediaDeviceGroup group, MediaActiveStateModel? activeState) {
		final device = _devicesService?.getDevice(group.deviceId);
		if (device == null) return false;

		return device.isOn ?? false;
	}

	String _deviceStatus(BuildContext context, MediaDeviceGroup group, MediaActiveStateModel? activeState) {
		final localizations = AppLocalizations.of(context)!;
		if (activeState == null || activeState.isDeactivated) return localizations.media_status_standby;

		final resolved = activeState.resolved;
		if (resolved == null) return localizations.media_status_standby;

		final deviceId = group.deviceId;
		final isResolved = resolved.displayDeviceId == deviceId ||
				resolved.audioDeviceId == deviceId ||
				resolved.sourceDeviceId == deviceId ||
				resolved.remoteDeviceId == deviceId;

		if (!isResolved) return localizations.media_status_standby;

		if (activeState.isActivating) return localizations.media_status_activating;
		if (activeState.isFailed) return localizations.media_status_failed;
		if (activeState.isDeactivating) return localizations.media_status_stopping;
		if (activeState.isActiveWithWarnings) return localizations.media_status_active_with_issues;
		if (activeState.isActive) return localizations.media_status_active;

		return localizations.media_status_ready;
	}

	// =============================================================================
	// HELPERS (labels, icons, navigation, device sheet)
	// =============================================================================

	String _activityLabel(BuildContext context, MediaActivityKey? key) {
		final localizations = AppLocalizations.of(context)!;
		switch (key) {
			case MediaActivityKey.watch:
				return localizations.media_activity_watch;
			case MediaActivityKey.listen:
				return localizations.media_activity_listen;
			case MediaActivityKey.gaming:
				return localizations.media_activity_gaming;
			case MediaActivityKey.background:
				return localizations.media_activity_background;
			case MediaActivityKey.off:
			case null:
				return localizations.media_activity_off;
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

	void _navigateToDeviceDetail(MediaDeviceGroup group) {
		Navigator.push(
			context,
			MaterialPageRoute(
				builder: (context) => DeviceDetailPage(group.deviceId),
			),
		);
	}

	void _showMediaDevicesSheet() {
		final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';
		String? deviceNameResolver(String deviceId) {
			final device = _devicesService?.getDevice(deviceId);
			if (device == null) return null;
			return stripRoomNameFromDevice(device.name, roomName);
		}

		int getItemCount() =>
			(_mediaService?.getDeviceGroups(_roomId, deviceNameResolver: deviceNameResolver) ?? []).length;
		if (getItemCount() == 0) return;

		final localizations = AppLocalizations.of(context)!;
		List<MediaDeviceGroup> getDeviceGroups() =>
			_mediaService?.getDeviceGroups(_roomId, deviceNameResolver: deviceNameResolver) ?? [];

		if (_devicesService != null) {
			DeckItemSheet.showItemSheetWithUpdates(
				context,
				title: localizations.media_targets_title,
				icon: MdiIcons.monitorSpeaker,
				rebuildWhen: _devicesService!,
				getItemCount: getItemCount,
				itemBuilder: (context, index) {
					final groups = getDeviceGroups();
					return _buildMediaDeviceTileForSheet(context, groups[index]);
				},
			);
		} else {
			final deviceGroups = getDeviceGroups();
			DeckItemSheet.showItemSheet(
				context,
				title: localizations.media_targets_title,
				icon: MdiIcons.monitorSpeaker,
				itemCount: deviceGroups.length,
				itemBuilder: (context, index) =>
					_buildMediaDeviceTileForSheet(context, deviceGroups[index]),
			);
		}
	}

	List<IconData> _deviceCapabilityIcons(MediaDeviceGroup group) {
		final icons = <IconData>[];
		if (group.hasDisplay) icons.add(MdiIcons.television);
		if (group.hasAudio) icons.add(MdiIcons.volumeHigh);
		if (group.hasSource) icons.add(MdiIcons.playCircle);
		if (group.hasRemote) icons.add(MdiIcons.remote);
		return icons;
	}

	Widget _buildMediaDeviceTileForSheet(BuildContext context, MediaDeviceGroup group) {
		final localizations = AppLocalizations.of(context)!;
		final activeState = _mediaService?.getActiveState(_roomId);
		final deviceView = _devicesService?.getDevice(group.deviceId);
		final isOffline = deviceView == null || !deviceView.isOnline;
		final isActive = _isDeviceActive(group, activeState);
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final modeColorFamily = _getModeColorFamily(context);

		final accessories = Row(
			mainAxisSize: MainAxisSize.min,
			children: [
				..._deviceCapabilityIcons(group).take(3).map((capIcon) {
					return Padding(
						padding: EdgeInsets.only(left: AppSpacings.pSm),
						child: Container(
							width: AppSpacings.scale(22),
							height: AppSpacings.scale(22),
							decoration: BoxDecoration(
								color: isActive
									? modeColorFamily.light5
									: (isDark ? AppFillColorDark.base : AppFillColorLight.base),
								borderRadius: BorderRadius.circular(AppBorderRadius.base),
							),
							child: Icon(
								capIcon,
								size: AppSpacings.scale(12),
								color: isActive
									? modeColorFamily.dark2
									: (isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder),
							),
						),
					);
				}),
			],
		);

		final supportsPowerOn = !isOffline &&
			(_devicesService?.deviceSupportsPowerOn(group.deviceId) ?? false);
		final tileIcon = deviceView != null
			? buildDeviceIcon(deviceView.category, deviceView.icon)
			: _deviceGroupIcon(group);
		return DeviceTilePortrait(
			icon: tileIcon,
			name: group.deviceName,
			status: isOffline
				? localizations.device_status_offline
				: _deviceStatus(context, group, activeState),
			isActive: isActive,
			isOffline: isOffline,
			activeColor: isActive ? _getModeColor() : null,
			accessories: accessories,
			onIconTap: supportsPowerOn
				? () async {
						await _devicesService?.toggleDeviceOnState(group.deviceId);
					}
				: null,
			onTileTap: () {
				Navigator.of(context).pop();
				_navigateToDeviceDetail(group);
			},
		);
	}

	// =============================================================================
	// ACTIONS (volume, mute, input, playback, remote)
	// =============================================================================

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
		_volumeDebounceTimer = Timer(const Duration(milliseconds: _MediaDomainConstants.volumeDebounceMs), () {
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
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final options = sources
				.map((s) => ValueOption<String>(value: s, label: mediaInputSourceLabel(context, s)))
				.toList();
		final initialIndex = currentValue != null
				? sources.indexOf(currentValue).clamp(0, sources.length - 1)
				: 0;
		final selectedIndexNotifier = ValueNotifier<int>(initialIndex);

		showAppBottomSheet(
			context,
			title: localizations.media_input_select_title,
			titleIcon: MdiIcons.audioInputStereoMinijack,
			scrollable: false,
			content: ValueSelectorSheet<String>(
				currentValue: currentValue,
				options: options,
				title: localizations.media_input_select_title,
				columns: 3,
				optionStyle: ValueSelectorOptionStyle.buttons,
				selectedIndexNotifier: selectedIndexNotifier,
			),
			bottomSection: ValueListenableBuilder<int>(
				valueListenable: selectedIndexNotifier,
				builder: (ctx, index, _) {
					return SizedBox(
						width: double.infinity,
						child: Theme(
							data: isDark
									? ThemeData(brightness: Brightness.dark, filledButtonTheme: AppFilledButtonsDarkThemes.primary)
									: ThemeData(filledButtonTheme: AppFilledButtonsLightThemes.primary),
							child: FilledButton(
								onPressed: options.isEmpty || index < 0
										? null
										: () {
												Navigator.pop(ctx);
												_devicesService!.setPropertyValue(propId, options[index].value);
											},
								style: FilledButton.styleFrom(
									padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
									shape: RoundedRectangleBorder(
										borderRadius: BorderRadius.circular(AppBorderRadius.base),
									),
								),
								child: Text(
									localizations.button_done,
									style: TextStyle(
										fontSize: AppFontSize.base,
										fontWeight: FontWeight.w600,
									),
								),
							),
						),
					);
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
		_playbackSheetNotifier.value++;

		// Block _syncDeviceState from overwriting during settle window.
		// After timeout, re-read the actual device value (backend truth).
		_playbackSettleTimer?.cancel();
		_playbackSettleTimer = Timer(const Duration(seconds: _MediaDomainConstants.playbackSettleSeconds), () {
			if (!mounted) return;
			_syncDeviceState();
			setState(() {});
			_playbackSheetNotifier.value++;
		});

		if (kDebugMode) {
			debugPrint('[MediaDomainViewPage] Sending playback=$command on property=$propId');
		}
		_devicesService!.setPropertyValue(propId, command);
	}

	Widget _buildRemoteDpadButton(
		BuildContext context, {
		IconData? icon,
		String? label,
		bool isPrimary = false,
		VoidCallback? onTap,
	}) {
		final size = AppSpacings.scale(40);
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final themeData = isPrimary
			? ThemeData(filledButtonTheme: isDark ? AppFilledButtonsDarkThemes.primary : AppFilledButtonsLightThemes.primary)
			: (isDark ? ThemeData(filledButtonTheme: AppFilledButtonsDarkThemes.neutral) : ThemeData(filledButtonTheme: AppFilledButtonsLightThemes.neutral));

		return SizedBox(
			width: size,
			height: size,
			child: Theme(
				data: themeData,
				child: FilledButton(
					onPressed: onTap == null
						? null
						: () {
							HapticFeedback.lightImpact();
							onTap();
						},
					style: FilledButton.styleFrom(
						padding: AppSpacings.paddingMd,
						minimumSize: Size(size, size),
						maximumSize: Size(size, size),
						shape: RoundedRectangleBorder(
							borderRadius: BorderRadius.circular(AppBorderRadius.base),
						),
					),
					child: icon != null
						? Icon(
							icon,
							size: AppSpacings.scale(20),
							color: isDark
								? (isPrimary
									? AppFilledButtonsDarkThemes.primaryForegroundColor
									: AppFilledButtonsDarkThemes.neutralForegroundColor)
								: (isPrimary
									? AppFilledButtonsLightThemes.primaryForegroundColor
									: AppFilledButtonsLightThemes.neutralForegroundColor),
						)
						: Text(
							label ?? '',
							style: TextStyle(
								fontSize: AppFontSize.small,
								fontWeight: FontWeight.w600,
							),
						),
				),
			),
		);
	}

	Widget _buildRemoteTransportButton(
		BuildContext context, {
		required IconData icon,
		bool isMain = false,
		VoidCallback? onTap,
	}) {
		final size = AppSpacings.scale(isMain ? 44 : 32);
		final iconSize = AppSpacings.scale(isMain ? 22 : 16);
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final themeData = isMain
			? ThemeData(filledButtonTheme: isDark ? AppFilledButtonsDarkThemes.primary : AppFilledButtonsLightThemes.primary)
			: (isDark ? ThemeData(filledButtonTheme: AppFilledButtonsDarkThemes.neutral) : ThemeData(filledButtonTheme: AppFilledButtonsLightThemes.neutral));

		return SizedBox(
			width: size,
			height: size,
			child: Theme(
				data: themeData,
				child: FilledButton(
					onPressed: onTap == null
						? null
						: () {
							HapticFeedback.lightImpact();
							onTap();
						},
					style: FilledButton.styleFrom(
						padding: AppSpacings.paddingMd,
						minimumSize: Size(size, size),
						maximumSize: Size(size, size),
						shape: RoundedRectangleBorder(
							borderRadius: BorderRadius.circular(AppBorderRadius.base),
						),
					),
					child: Icon(
						icon,
						size: iconSize,
						color: isDark
							? (isMain
								? AppFilledButtonsDarkThemes.primaryForegroundColor
								: AppFilledButtonsDarkThemes.neutralForegroundColor)
							: (isMain
								? AppFilledButtonsLightThemes.primaryForegroundColor
								: AppFilledButtonsLightThemes.neutralForegroundColor),
					),
				),
			),
		);
	}

	void _showPlaybackSheet() {
		final targets = _mediaService?.resolveControlTargets(_roomId);
		if (targets == null || !targets.hasPlayback) return;

		showModalBottomSheet<void>(
			context: context,
			isScrollControlled: true,
			backgroundColor: AppColors.blank,
			builder: (sheetContext) => AppBottomSheet(
				title: AppLocalizations.of(context)!.media_playback,
				titleIcon: MdiIcons.playCircle,
				showCloseButton: true,
				content: ListenableBuilder(
					listenable: _playbackSheetNotifier,
					builder: (ctx, _) => Padding(
						padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
						child: _buildPlaybackControl(context),
					),
				),
				scrollable: false,
			),
		).then((_) {
			if (mounted) {
				_syncDeviceState();
				setState(() {});
			}
		});
	}

	void _showRemote() {
		final targets = _mediaService?.resolveControlTargets(_roomId);
		if (targets == null || !targets.hasRemote) return;

		final remoteEndpoint = targets.remoteTarget!;
		final propId = remoteEndpoint.links.remotePropertyId;
		if (propId == null || _devicesService == null) return;

		// Read supported commands from property format
		Set<String> supported = {};
		final prop = _devicesService!.getChannelProperty(propId);
		if (prop?.format is StringListFormatType) {
			supported = (prop!.format as StringListFormatType).value.toSet();
		}

		if (supported.isEmpty) return;

		// Map enum values to icons and labels
		IconData iconFor(TelevisionRemoteKeyValue key) => switch (key) {
			TelevisionRemoteKeyValue.arrowUp => MdiIcons.chevronUp,
			TelevisionRemoteKeyValue.arrowDown => MdiIcons.chevronDown,
			TelevisionRemoteKeyValue.arrowLeft => MdiIcons.chevronLeft,
			TelevisionRemoteKeyValue.arrowRight => MdiIcons.chevronRight,
			TelevisionRemoteKeyValue.select => MdiIcons.radioboxMarked,
			TelevisionRemoteKeyValue.back => MdiIcons.arrowLeft,
			TelevisionRemoteKeyValue.exit => MdiIcons.exitToApp,
			TelevisionRemoteKeyValue.info => MdiIcons.informationOutline,
			TelevisionRemoteKeyValue.rewind => MdiIcons.rewind,
			TelevisionRemoteKeyValue.fastForward => MdiIcons.fastForward,
			TelevisionRemoteKeyValue.play => MdiIcons.play,
			TelevisionRemoteKeyValue.pause => MdiIcons.pause,
			TelevisionRemoteKeyValue.next => MdiIcons.skipNext,
			TelevisionRemoteKeyValue.previous => MdiIcons.skipPrevious,
		};

		final remoteLocalizations = AppLocalizations.of(context)!;

		bool has(TelevisionRemoteKeyValue key) => supported.contains(key.value);

		final hasUp = has(TelevisionRemoteKeyValue.arrowUp);
		final hasDown = has(TelevisionRemoteKeyValue.arrowDown);
		final hasLeft = has(TelevisionRemoteKeyValue.arrowLeft);
		final hasRight = has(TelevisionRemoteKeyValue.arrowRight);
		final hasSelect = has(TelevisionRemoteKeyValue.select);
		final hasDpad = hasUp || hasDown || hasLeft || hasRight || hasSelect;

		// Transport (media playback) keys in logical order
		const transportOrder = [
			TelevisionRemoteKeyValue.previous,
			TelevisionRemoteKeyValue.rewind,
			TelevisionRemoteKeyValue.play,
			TelevisionRemoteKeyValue.pause,
			TelevisionRemoteKeyValue.fastForward,
			TelevisionRemoteKeyValue.next,
		];

		// Navigation keys
		const navKeys = {
			TelevisionRemoteKeyValue.back,
			TelevisionRemoteKeyValue.exit,
			TelevisionRemoteKeyValue.info,
		};

		final transportActions = transportOrder
				.where((key) => has(key))
				.toList();

		final navActions = TelevisionRemoteKeyValue.values
				.where((key) => navKeys.contains(key) && has(key))
				.toList();

		showAppBottomSheet(
			context,
			title: remoteLocalizations.media_remote_control,
			titleIcon: MdiIcons.remote,
			content: Padding(
        padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          spacing: AppSpacings.pMd,
          children: [
            if (hasDpad) ...[
              if (hasUp)
                _buildRemoteDpadButton(
                  context,
                  icon: MdiIcons.chevronUp,
                  onTap: () => _sendRemoteSheetCommand(propId, TelevisionRemoteKeyValue.arrowUp),
                ),
              Row(
                mainAxisSize: MainAxisSize.min,
                spacing: AppSpacings.pSm,
                children: [
                  if (hasLeft)
                    _buildRemoteDpadButton(
                      context,
                      icon: MdiIcons.chevronLeft,
                      onTap: () => _sendRemoteSheetCommand(propId, TelevisionRemoteKeyValue.arrowLeft),
                    ),
                  if (hasSelect)
                    _buildRemoteDpadButton(
                      context,
                      label: remoteLocalizations.media_remote_ok,
                      isPrimary: true,
                      onTap: () => _sendRemoteSheetCommand(propId, TelevisionRemoteKeyValue.select),
                    ),
                  if (hasRight)
                    _buildRemoteDpadButton(
                      context,
                      icon: MdiIcons.chevronRight,
                      onTap: () => _sendRemoteSheetCommand(propId, TelevisionRemoteKeyValue.arrowRight),
                    ),
                ],
              ),
              if (hasDown)
                _buildRemoteDpadButton(
                  context,
                  icon: MdiIcons.chevronDown,
                  onTap: () => _sendRemoteSheetCommand(propId, TelevisionRemoteKeyValue.arrowDown),
                ),
            ],
            if (transportActions.isNotEmpty) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: transportActions.map((key) {
                  final isMain = key == TelevisionRemoteKeyValue.play;
                  return Padding(
                    padding: EdgeInsets.symmetric(horizontal: AppSpacings.pXs),
                    child: _buildRemoteTransportButton(
                      context,
                      icon: iconFor(key),
                      isMain: isMain,
                      onTap: () => _sendRemoteSheetCommand(propId, key),
                    ),
                  );
                }).toList(),
              ),
            ],
            if (navActions.isNotEmpty) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: navActions.map((key) {
                  return Padding(
                    padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
                    child: _buildRemoteDpadButton(
                      context,
                      icon: iconFor(key),
                      onTap: () => _sendRemoteSheetCommand(propId, key),
                    ),
                  );
                }).toList(),
              ),
            ],
          ],
        ),
      ),
		);
	}

	void _sendRemoteSheetCommand(String propId, TelevisionRemoteKeyValue command) {
		_devicesService?.setPropertyValue(propId, command.value);
	}
}

// =============================================================================
// DATA MODELS
// =============================================================================
// View model for one entry in the active composition (Display/Audio/Source role).

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

// =============================================================================
// SPINNER ARC PAINTER
// =============================================================================
// Used by activating-state content for the spinning arc indicator.

class _SpinnerArcPainter extends CustomPainter {
	final Color color;
	final double strokeWidth;

	_SpinnerArcPainter({required this.color, this.strokeWidth = 3});

	@override
	void paint(Canvas canvas, Size size) {
		final paint = Paint()
			..color = color
			..style = PaintingStyle.stroke
			..strokeWidth = strokeWidth
			..strokeCap = StrokeCap.round;

		final rect = Rect.fromLTWH(0, 0, size.width, size.height);
		canvas.drawArc(rect, -math.pi / 2, math.pi / 2, false, paint);
	}

	@override
	bool shouldRepaint(covariant _SpinnerArcPainter oldDelegate) {
		return oldDelegate.color != color || oldDelegate.strokeWidth != strokeWidth;
	}
}

