/// Media domain view: room-level media control for a single space/room.
///
/// ## Purpose
/// One screen per room for AV control: activity selection (Watch, Listen, Gaming,
/// Background, Off), composition preview (Display/Audio/Source roles), volume/mute,
/// playback transport, progress bar, and remote control. Media-capable devices
/// are listed in a bottom sheet opened from the header.
///
/// ## Data flow
/// - [MediaActivityService]: active state, endpoints, control targets (volume,
///   playback, display, remote), device groups.
/// - [DevicesService]: live device views and property values (volume, mute,
///   playback state, track metadata, position/duration).
/// - [SpacesService]: room name. [EventBus] for page activation.
/// - Local state (`_volume`, `_isMuted`, `_playbackState`, etc.) is synced from
///   device properties in [_syncDeviceState].
///
/// ## Key concepts
/// - Activity on/off and mode are server-driven; volume/mute/playback use optimistic
///   UI with debounce (volume) and settle timers (playback).
/// - Portrait: activity card + mode selector. Landscape: main content + vertical
///   mode selector + optional controls column.
/// - Failure/warning: inline banners and [_showFailureDetailsSheet]; retry/deactivate.
///
/// ## File structure (for AI and humans)
/// Search for section headers to jump to a part of the file:
///
/// | Section | Content |
/// |---------|---------|
/// | CONSTANTS | Debounce/settle durations |
/// | LIFECYCLE | initState, dispose, fetch, retry |
/// | LISTENERS & CALLBACKS | Page activation, data/devices/connection |
/// | STATE SYNC | [_syncDeviceState], property readers |
/// | ACTIVITY ACTIONS | [_onActivitySelected] |
/// | BUILD | Main build, loading/error states |
/// | HEADER | [_buildHeader] |
/// | THEME & LABELS | Mode colors, activity labels/icons |
/// | PORTRAIT/LANDSCAPE LAYOUT | Layout builders |
/// | STATE CONTENT | Off, activating, failed builders |
/// | ACTIVE CARD | Hero card, warnings, now-playing, controls |
/// | FAILURE DETAILS | Inline failure, sheet, retry/deactivate |
/// | HELPERS | Labels, icons, device sheet |
/// | ACTIONS | Volume, mute, playback, remote |
/// | SPINNER ARC PAINTER | [_SpinnerArcPainter] |
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
import 'package:fastybird_smart_panel/core/widgets/app_bottom_sheet.dart';
import 'package:fastybird_smart_panel/core/widgets/app_right_drawer.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/domain_data_loader.dart';
import 'package:fastybird_smart_panel/modules/deck/utils/lighting.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_page_activated_event.dart';
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
	String? _albumName;
	/// Playback position and duration in seconds.
	double? _position;
	double? _duration;

	Timer? _volumeDebounceTimer;
	Timer? _playbackSettleTimer;

	late AnimationController _pulseController;

	String get _roomId => widget.viewItem.roomId;

	/// Resolves optional service from locator. Logs in debug on failure.
	/// Use [onSuccess] to register listeners when the service is available.
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
		_pulseController.dispose();
		_mediaService?.removeListener(_onDataChanged);
		_devicesService?.removeListener(_onDevicesChanged);
		_socketService?.removeConnectionListener(_onConnectionChanged);
		super.dispose();
	}

	// -------------------------------------------------------------------------
	// LISTENERS & CALLBACKS
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

		// Media domain does not use the bottom nav mode button;
		// activity selection is handled by the inline ModeSelector.
		_bottomNavModeNotifier?.clear();
	}

	void _onDataChanged() {
		if (!mounted) return;
		_syncDeviceState();
		WidgetsBinding.instance.addPostFrameCallback((_) {
			if (mounted) {
				setState(() {});
				_registerModeConfig();
			}
		});
		// Ensure a frame is scheduled so the post-frame callback runs promptly
		// (addPostFrameCallback alone does not schedule a frame).
		WidgetsBinding.instance.ensureVisualUpdate();
	}

	void _onDevicesChanged() {
		if (!mounted) return;
		// Sync volume/mute from device properties when backend pushes updates
		// Skip if a debounce timer is active (user is dragging the slider)
		if (_volumeDebounceTimer == null || !_volumeDebounceTimer!.isActive) {
			_syncDeviceState();
			WidgetsBinding.instance.addPostFrameCallback((_) {
				if (mounted) {
					setState(() {});
					_registerModeConfig();
				}
			});
			// Ensure a frame is scheduled so the post-frame callback runs promptly
			// (addPostFrameCallback alone does not schedule a frame).
			WidgetsBinding.instance.ensureVisualUpdate();
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

		// Volume & mute
		if (targets.hasVolume) {
			final volVal = _readNumberProperty(targets.volumeTarget!.links.volumePropertyId);
			if (volVal != null) _volume = volVal.toInt();

			final muteVal = _readBooleanProperty(targets.volumeTarget!.links.mutePropertyId);
			if (muteVal != null) _isMuted = muteVal;
		}

		// Playback state and track metadata
		if (targets.hasPlayback) {
			final playbackLinks = targets.playbackTarget!.links;
			final isSettling = _playbackSettleTimer != null && _playbackSettleTimer!.isActive;

			if (!isSettling) {
				_playbackState = _readStringProperty(playbackLinks.playbackStatePropertyId);
			}

			_trackName = _readStringProperty(playbackLinks.trackMetadataPropertyId);
			_artistName = _readStringProperty(playbackLinks.artistPropertyId);
			_albumName = _readStringProperty(playbackLinks.albumPropertyId);

			final pos = _readNumberProperty(playbackLinks.positionPropertyId);
			_position = pos?.toDouble();

			final dur = _readNumberProperty(playbackLinks.durationPropertyId);
			_duration = dur?.toDouble();
		} else {
			_playbackState = null;
			_trackName = null;
			_artistName = null;
			_albumName = null;
			_position = null;
			_duration = null;
		}
	}

	/// Reads a string value from a channel property. Returns null if missing or wrong type.
	String? _readStringProperty(String? propId) {
		if (propId == null) return null;
		final val = _devicesService?.getChannelProperty(propId)?.value;
		return val is StringValueType ? val.value : null;
	}

	/// Reads a numeric value from a channel property. Returns null if missing or wrong type.
	num? _readNumberProperty(String? propId) {
		if (propId == null) return null;
		final val = _devicesService?.getChannelProperty(propId)?.value;
		return val is NumberValueType ? val.value : null;
	}

	/// Reads a boolean value from a channel property. Returns null if missing or wrong type.
	bool? _readBooleanProperty(String? propId) {
		if (propId == null) return null;
		final val = _devicesService?.getChannelProperty(propId)?.value;
		return val is BooleanValueType ? val.value : null;
	}

	void _onConnectionChanged(bool isConnected) {
		if (!mounted) return;
		setState(() => _wsConnected = isConnected);
	}

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
			_albumName = null;
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

				// No activity bindings configured — show "not configured" state with header
				final bindings = mediaService.getBindings(_roomId);
				if (bindings.isEmpty) {
					return Scaffold(
						backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
						body: SafeArea(
							child: Column(
								children: [
									PageHeader(
										title: localizations.domain_media,
										subtitle: localizations.domain_not_configured_subtitle,
										leading: HeaderMainIcon(
											icon: MdiIcons.playBoxOutline,
										),
									),
									Expanded(
										child: DomainStateView(
											state: DomainLoadState.notConfigured,
											onRetry: _retryLoad,
											domainName: localizations.domain_media,
											notConfiguredIcon: MdiIcons.televisionOff,
											notConfiguredTitle: localizations.media_not_configured_title,
											notConfiguredDescription: localizations.media_not_configured_description,
											child: const SizedBox.shrink(),
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

		// Power button: always visible, primary when active, neutral when off
		final isMediaOn = activeState != null &&
			(activeState.isActive || activeState.isActivating || activeState.isFailed);
		final targets = _mediaService?.resolveControlTargets(_roomId);
		final showRemoteButton = isMediaOn && (targets?.hasRemote == true);

		final List<Widget> trailingWidgets = [
			if (showDevicesButton)
				HeaderIconButton(
					icon: MdiIcons.monitorSpeaker,
					onTap: _showMediaDevicesSheet,
				),
			if (showRemoteButton)
				HeaderIconButton(
					icon: MdiIcons.remote,
					onTap: _showRemote,
				),
			HeaderIconButton(
				icon: MdiIcons.power,
				color: isMediaOn ? ThemeColors.primary : ThemeColors.neutral,
				onTap: isMediaOn ? _deactivateActivity : null,
			),
		];

		return PageHeader(
			title: localizations.domain_media,
			subtitle: subtitle,
			subtitleColor: hasActive ? modeColorFamily.dark2 : null,
			leading: HeaderMainIcon(
				icon: MdiIcons.playBoxOutline,
				color: _getModeColor(),
			),
			trailing: Row(
				mainAxisSize: MainAxisSize.min,
				spacing: AppSpacings.pMd,
				children: trailingWidgets,
			),
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
		if (showOffContent) {
			return PortraitViewLayout(
				scrollable: false,
				content: Column(
					children: [
						HeroCard(
							child: _buildOffStateContent(context),
						),
						AppSpacings.spacingMdVertical,
						_buildModeSelector(context),
					],
				),
			);
		}

		if (isActivating) {
			return PortraitViewLayout(
				scrollable: false,
				content: _buildActivatingContent(context, activeState!),
			);
		}

		if (isFailed) {
			return PortraitViewLayout(
				scrollable: false,
				content: _buildFailedContent(context, activeState!),
			);
		}

		return PortraitViewLayout(
			scrollable: false,
			content: _buildActivityContent(context, activeState),
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
		if (showOffContent) {
			final modeTiles = _buildLandscapeModeTiles(context);
			return LandscapeViewLayout(
				mainContentPadding: EdgeInsets.only(
					right: AppSpacings.pMd,
					left: AppSpacings.pMd,
					bottom: AppSpacings.pMd,
				),
				mainContent: Column(
					crossAxisAlignment: CrossAxisAlignment.stretch,
					children: [
						Expanded(
							child: HeroCard(
								child: _buildOffStateContent(context),
							),
						),
					],
				),
				additionalContentScrollable: false,
				additionalContentPadding: EdgeInsets.only(
					left: AppSpacings.pMd,
					bottom: AppSpacings.pMd,
				),
				additionalContent: modeTiles.isNotEmpty
					? Column(
							crossAxisAlignment: CrossAxisAlignment.stretch,
							spacing: AppSpacings.pSm,
							children: modeTiles,
						)
					: null,
			);
		}

		if (isActivating) {
			return LandscapeViewLayout(
				mainContentPadding: EdgeInsets.only(
					right: AppSpacings.pMd,
					left: AppSpacings.pMd,
					bottom: AppSpacings.pMd,
				),
				mainContent: _buildActivatingContent(context, activeState!),
			);
		}

		if (isFailed) {
			return LandscapeViewLayout(
				mainContentPadding: EdgeInsets.only(
					right: AppSpacings.pMd,
					left: AppSpacings.pMd,
					bottom: AppSpacings.pMd,
				),
				mainContent: _buildFailedContent(context, activeState!),
			);
		}

		return LandscapeViewLayout(
			mainContentPadding: EdgeInsets.only(
				right: AppSpacings.pMd,
				left: AppSpacings.pMd,
				bottom: AppSpacings.pMd,
			),
			mainContent: _buildLandscapeMainContent(context, activeState),
			additionalContentScrollable: false,
			additionalContentPadding: EdgeInsets.only(
				left: AppSpacings.pMd,
				bottom: AppSpacings.pMd,
			),
			additionalContent: _buildLandscapeAdditionalColumn(context),
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
		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			children: [
				HeroCard(
					child: _buildHeroCardContent(context, activeState!),
				),
				AppSpacings.spacingMdVertical,
				_buildModeSelector(context),
				AppSpacings.spacingMdVertical,
				_buildCompositionCard(context),
			],
		);
	}

	// =============================================================================
	// MODE SELECTOR
	// =============================================================================

	List<ModeOption<MediaActivityKey>> _getActivityModeOptions() {
		final localizations = AppLocalizations.of(context)!;
		final availableKeys = _mediaService?.getAvailableActivities(_roomId) ?? MediaActivityKey.values;
		final activeState = _mediaService?.getActiveState(_roomId);
		final currentKey = _getSelectedActivityKey(activeState);

		return availableKeys
			.where((key) => key != MediaActivityKey.off)
			.map((key) {
				final isActive = key == currentKey &&
					currentKey != MediaActivityKey.off;
				final statusText = isActive
					? localizations.on_state_on
					: localizations.on_state_off;
				final name = _activityLabel(context, key);

				return ModeOption<MediaActivityKey>(
					value: key,
					icon: _activityIcon(key),
					label: name,
					color: _getModeColor(key),
					iconSize: AppSpacings.scale(18),
					labelBuilder: (isSelected, contentColor) {
						return Column(
							mainAxisSize: MainAxisSize.min,
							children: [
								Text(
									name,
									style: TextStyle(
										color: contentColor,
										fontSize: AppFontSize.extraSmall,
										fontWeight: FontWeight.w500,
										height: 1,
									),
									maxLines: 1,
									overflow: TextOverflow.ellipsis,
								),
								Text(
									statusText,
									style: TextStyle(
										color: contentColor,
										fontSize: AppFontSize.base,
										fontWeight: FontWeight.w600,
										height: 1,
									),
									maxLines: 1,
								),
							],
						);
					},
				);
			}).toList();
	}

	MediaActivityKey? _getSelectedActivityKey(MediaActiveStateModel? activeState) {
		if (activeState == null || activeState.isDeactivated || activeState.isDeactivating) {
			return MediaActivityKey.off;
		}
		return activeState.activityKey ?? MediaActivityKey.off;
	}

	Widget _buildModeSelector(BuildContext context) {
		final modeOptions = _getActivityModeOptions();
		if (modeOptions.isEmpty) return const SizedBox.shrink();

		final activeState = _mediaService?.getActiveState(_roomId);
		final selectedKey = _getSelectedActivityKey(activeState);

		return ModeSelector<MediaActivityKey>(
			modes: modeOptions,
			selectedValue: selectedKey == MediaActivityKey.off ? null : selectedKey,
			onChanged: (!_wsConnected || _isSending) ? (_) {} : _onActivitySelected,
			orientation: ModeSelectorOrientation.horizontal,
			iconPlacement: ModeSelectorIconPlacement.top,
			color: _getModeColor(),
		);
	}

	Widget _buildCompositionCard(BuildContext context) {
		final compositionEntries = _mediaService?.getActiveCompositionEntries(_roomId) ?? [];
		if (compositionEntries.isEmpty) return const SizedBox.shrink();

		final localizations = AppLocalizations.of(context)!;
		final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';

		final seen = <String>{};
		final names = <String>[];
		for (final entry in compositionEntries) {
			if (!seen.add(entry.deviceId)) continue;
			final device = _devicesService?.getDevice(entry.deviceId);
			names.add(device != null
					? stripRoomNameFromDevice(device.name, roomName)
					: entry.endpointName);
		}

		final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);

		return SizedBox(
			height: tileHeight,
			child: UniversalTile(
				layout: TileLayout.horizontal,
				icon: MdiIcons.monitorSpeaker,
				name: localizations.media_devices_summary(names.length),
				status: names.join(' \u2022 '),
				isActive: false,
				showGlow: false,
				showDoubleBorder: false,
				showInactiveBorder: false,
				onTileTap: () => _showCompositionDevicesSheet(compositionEntries),
			),
		);
	}

	List<Widget> _buildLandscapeModeTiles(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final modeOptions = _getActivityModeOptions();
		if (modeOptions.isEmpty) return [];

		final activeState = _mediaService?.getActiveState(_roomId);
		final selectedKey = _getSelectedActivityKey(activeState);
		final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);

		return modeOptions.map((mode) {
			final isActive = mode.value == selectedKey &&
				selectedKey != MediaActivityKey.off;
			final statusText = isActive
				? localizations.on_state_on
				: localizations.on_state_off;
			final modeColor = _getModeColor(mode.value);

			return SizedBox(
				height: tileHeight,
				width: double.infinity,
				child: UniversalTile(
					layout: TileLayout.horizontal,
					icon: mode.icon,
					name: statusText,
					status: mode.label,
					iconAccentColor: isActive ? modeColor : null,
					isActive: isActive,
					activeColor: modeColor,
					showGlow: false,
					showDoubleBorder: false,
					showInactiveBorder: false,
					onTileTap: (!_wsConnected || _isSending)
						? null
						: () => _onActivitySelected(mode.value),
				),
			);
		}).toList();
	}

	Widget _buildLandscapeMainContent(
		BuildContext context,
		MediaActiveStateModel? activeState,
	) {
		return Column(
			crossAxisAlignment: CrossAxisAlignment.stretch,
			children: [
				Expanded(
					child: HeroCard(
						child: _buildHeroCardContent(context, activeState!),
					),
				),
			],
		);
	}

	/// Landscape sidebar: mode tiles (Watch/Listen/etc.) + composition summary at bottom.
	Widget _buildLandscapeAdditionalColumn(BuildContext context) {
		final modeTiles = _buildLandscapeModeTiles(context);

		return Column(
			crossAxisAlignment: CrossAxisAlignment.stretch,
			mainAxisAlignment: MainAxisAlignment.spaceBetween,
			children: [
				if (modeTiles.isNotEmpty) ...[
					Column(
						spacing: AppSpacings.pSm,
						children: modeTiles,
					),
					AppSpacings.spacingSmVertical,
				],
				_buildCompositionCard(context),
			],
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

	/// Translates activation step labels: input sources (hdmi1→HDMI 1), device names (strip room suffix).
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

	Widget _buildHeroCardContent(
		BuildContext context,
		MediaActiveStateModel activeState,
	) {
		final targets = _mediaService?.resolveControlTargets(_roomId) ?? const ActiveControlTargets();

		// Check for offline devices in composition
		final compositionEntries = _mediaService?.getActiveCompositionEntries(_roomId) ?? [];
		final offlineRoles = <String>[];
		for (final entry in compositionEntries) {
			final device = _devicesService?.getDevice(entry.deviceId);
			if (device != null && !device.isOnline) {
				offlineRoles.add(entry.role);
			}
		}

		final cardSpacing = _screenService.isSmallScreen
				? AppSpacings.pMd
				: AppSpacings.pLg;

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			mainAxisAlignment: MainAxisAlignment.center,
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

					// Capability-driven controls
					if (_trackName != null || _artistName != null || _albumName != null) ...[
						_buildNowPlaying(context),
					],
					if (_duration != null && _duration! > 0) ...[
						_buildProgressBar(context),
					],
					if (targets.hasPlayback) ...[
						_buildPlaybackControl(context),
					],
					if (targets.hasVolume) ...[
						_buildVolumeControl(context),
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

	Widget _buildVolumeControl(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final volume = _volume;
		final isMuted = _isMuted;

		final isCompact = _screenService.isPortrait
			? _screenService.isSmallScreen
			: _screenService.isSmallScreen || _screenService.isMediumScreen;

		final columnWidth = AppSpacings.scale(isCompact ? 32 : 40);
		final iconSize = isCompact ? AppFontSize.base : AppFontSize.large;
		final buttonPadding = isCompact ? AppSpacings.paddingSm : AppSpacings.paddingMd;

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
								padding: buttonPadding,
								minimumSize: Size(columnWidth, columnWidth),
								maximumSize: Size(columnWidth, columnWidth),
							),
							child: Icon(
								isMuted ? MdiIcons.volumeOff : MdiIcons.volumeHigh,
								size: iconSize,
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
							fontSize: isCompact ? AppFontSize.extraSmall : AppFontSize.small,
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

		final subtitleParts = <String>[
			if (_artistName != null) _artistName!,
			if (_albumName != null) _albumName!,
		];

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
				if (subtitleParts.isNotEmpty)
					Text(
						subtitleParts.join(' \u2022 '),
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

		// Check if position property is writable for seek support
		final targets = _mediaService?.resolveControlTargets(_roomId);
		final posId = targets?.playbackTarget?.links.positionPropertyId;
		final isSeekable = posId != null && _devicesService != null &&
				(_devicesService!.getChannelProperty(posId)?.isWritable ?? false);

		return Padding(
			padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
			child: Column(
				children: [
					LayoutBuilder(
						builder: (context, constraints) {
							final barWidth = constraints.maxWidth;
							final bar = ClipRRect(
								borderRadius: BorderRadius.circular(AppBorderRadius.base),
								child: LinearProgressIndicator(
									value: progress,
									minHeight: AppSpacings.scale(5),
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
									padding: EdgeInsets.symmetric(vertical: AppSpacings.pSm),
									child: bar,
								),
							);
						},
					),
					Row(
						mainAxisAlignment: MainAxisAlignment.spaceBetween,
						children: [
							Text(
								_formatTime(pos.toInt()),
								style: TextStyle(
									fontSize: AppFontSize.extraSmall,
									color: secondaryColor,
								),
							),
							Text(
								_formatTime(dur.toInt()),
								style: TextStyle(
									fontSize: AppFontSize.extraSmall,
									color: secondaryColor,
								),
							),
						],
					),
				],
			),
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

	/// Opens media devices list: right drawer in landscape, bottom sheet in portrait.
	/// Uses [DeckItemSheet] or [showAppRightDrawer] depending on orientation.
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
		final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;

		if (isLandscape) {
			final isDark = Theme.of(context).brightness == Brightness.dark;
			final drawerBgColor = isDark ? AppFillColorDark.base : AppFillColorLight.blank;

			showAppRightDrawer(
				context,
				title: localizations.media_targets_title,
				titleIcon: MdiIcons.monitorSpeaker,
				scrollable: false,
				content: _devicesService != null
					? ListenableBuilder(
							listenable: _devicesService!,
							builder: (ctx, _) {
								final groups = getDeviceGroups();
								return VerticalScrollWithGradient(
									gradientHeight: AppSpacings.pMd,
									itemCount: groups.length,
									separatorHeight: AppSpacings.pSm,
									backgroundColor: drawerBgColor,
									padding: EdgeInsets.symmetric(
										horizontal: AppSpacings.pLg,
										vertical: AppSpacings.pMd,
									),
									itemBuilder: (context, index) =>
										_buildMediaDeviceTileForSheet(context, groups[index]),
								);
							},
						)
					: VerticalScrollWithGradient(
							gradientHeight: AppSpacings.pMd,
							itemCount: getDeviceGroups().length,
							separatorHeight: AppSpacings.pSm,
							backgroundColor: drawerBgColor,
							padding: EdgeInsets.symmetric(
								horizontal: AppSpacings.pLg,
								vertical: AppSpacings.pMd,
							),
							itemBuilder: (context, index) =>
								_buildMediaDeviceTileForSheet(context, getDeviceGroups()[index]),
						),
			);
		} else if (_devicesService != null) {
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

	/// Opens composition devices sheet (Display/Audio/Source roles for active activity).
	void _showCompositionDevicesSheet(List<MediaCompositionEntry> entries) {
		if (entries.isEmpty) return;

		final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';
		final activeState = _mediaService?.getActiveState(_roomId);
		final activityKey = _getSelectedActivityKey(activeState);
		final activityName = _activityLabel(context, activityKey);
		final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);
		final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;
		final parentNavigator = Navigator.of(context);

		Widget buildCompositionTile(BuildContext context, int index) {
			if (index >= entries.length) return const SizedBox.shrink();
			final entry = entries[index];
			final device = _devicesService?.getDevice(entry.deviceId);
			final deviceName = device != null
					? stripRoomNameFromDevice(device.name, roomName)
					: entry.endpointName;
			final isOffline = device == null || !device.isOnline;
			final icon = _roleIcon(entry.role);

			return SizedBox(
				height: tileHeight,
				child: UniversalTile(
					layout: TileLayout.horizontal,
					icon: icon,
					activeIcon: icon,
					name: entry.role,
					status: deviceName,
					isActive: false,
					isOffline: isOffline,
					showWarningBadge: true,
					showGlow: false,
					showDoubleBorder: false,
					showInactiveBorder: false,
					onTileTap: () {
						Navigator.of(context).pop();
						parentNavigator.push(
							MaterialPageRoute(
								builder: (_) => DeviceDetailPage(entry.deviceId),
							),
						);
					},
				),
			);
		}

		if (isLandscape) {
			final isDark = Theme.of(context).brightness == Brightness.dark;
			final drawerBgColor = isDark ? AppFillColorDark.base : AppFillColorLight.blank;

			showAppRightDrawer(
				context,
				title: activityName,
				titleIcon: _activityIcon(activityKey),
				scrollable: false,
				content: _devicesService != null
					? ListenableBuilder(
							listenable: _devicesService!,
							builder: (ctx, _) => VerticalScrollWithGradient(
								gradientHeight: AppSpacings.pMd,
								itemCount: entries.length,
								separatorHeight: AppSpacings.pSm,
								backgroundColor: drawerBgColor,
								padding: EdgeInsets.symmetric(
									horizontal: AppSpacings.pLg,
									vertical: AppSpacings.pMd,
								),
								itemBuilder: buildCompositionTile,
							),
						)
					: VerticalScrollWithGradient(
							gradientHeight: AppSpacings.pMd,
							itemCount: entries.length,
							separatorHeight: AppSpacings.pSm,
							backgroundColor: drawerBgColor,
							padding: EdgeInsets.symmetric(
								horizontal: AppSpacings.pLg,
								vertical: AppSpacings.pMd,
							),
							itemBuilder: buildCompositionTile,
						),
			);
		} else if (_devicesService != null) {
			DeckItemSheet.showItemSheetWithUpdates(
				context,
				title: activityName,
				icon: _activityIcon(activityKey),
				rebuildWhen: _devicesService!,
				getItemCount: () => entries.length,
				itemBuilder: buildCompositionTile,
			);
		} else {
			DeckItemSheet.showItemSheet(
				context,
				title: activityName,
				icon: _activityIcon(activityKey),
				itemCount: entries.length,
				itemBuilder: buildCompositionTile,
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
		final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);

		return SizedBox(
			height: tileHeight,
			child: UniversalTile(
				layout: TileLayout.horizontal,
				icon: tileIcon,
				activeIcon: tileIcon,
				name: group.deviceName,
				status: isOffline
					? localizations.device_status_offline
					: _deviceStatus(context, group, activeState),
				isActive: isActive,
				isOffline: isOffline,
				activeColor: isActive ? _getModeColor() : null,
				accessories: accessories,
				showWarningBadge: true,
				showGlow: false,
				showDoubleBorder: false,
				showInactiveBorder: false,
				onIconTap: supportsPowerOn
					? () async {
							await _devicesService?.toggleDeviceOnState(group.deviceId);
						}
					: null,
				onTileTap: () {
					Navigator.of(context).pop();
					_navigateToDeviceDetail(group);
				},
			),
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
		_playbackSettleTimer = Timer(const Duration(seconds: _MediaDomainConstants.playbackSettleSeconds), () {
			if (!mounted) return;
			_syncDeviceState();
			setState(() {});
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
		bool isCompact = false,
		VoidCallback? onTap,
	}) {
		final size = AppSpacings.scale(isCompact ? 32 : 40);
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
							size: AppSpacings.scale(isCompact ? 16 : 20),
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
		bool isCompact = false,
		VoidCallback? onTap,
	}) {
		final size = AppSpacings.scale(isCompact ? (isMain ? 36 : 26) : (isMain ? 44 : 32));
		final iconSize = AppSpacings.scale(isCompact ? (isMain ? 18 : 12) : (isMain ? 22 : 16));
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

	/// Opens TV remote control: right drawer in landscape, bottom sheet in portrait.
	/// Renders D-pad, transport (play/pause/etc.), and nav keys from property format.
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

		final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;
		final isCompact = _screenService.isSmallScreen || _screenService.isMediumScreen;

		final remoteContent = Padding(
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
								isCompact: isCompact,
								onTap: () => _sendRemoteSheetCommand(propId, TelevisionRemoteKeyValue.arrowUp),
							),
						Row(
							mainAxisSize: MainAxisSize.min,
							spacing: isCompact ? AppSpacings.pXs : AppSpacings.pSm,
							children: [
								if (hasLeft)
									_buildRemoteDpadButton(
										context,
										icon: MdiIcons.chevronLeft,
										isCompact: isCompact,
										onTap: () => _sendRemoteSheetCommand(propId, TelevisionRemoteKeyValue.arrowLeft),
									),
								if (hasSelect)
									_buildRemoteDpadButton(
										context,
										label: remoteLocalizations.media_remote_ok,
										isPrimary: true,
										isCompact: isCompact,
										onTap: () => _sendRemoteSheetCommand(propId, TelevisionRemoteKeyValue.select),
									),
								if (hasRight)
									_buildRemoteDpadButton(
										context,
										icon: MdiIcons.chevronRight,
										isCompact: isCompact,
										onTap: () => _sendRemoteSheetCommand(propId, TelevisionRemoteKeyValue.arrowRight),
									),
							],
						),
						if (hasDown)
							_buildRemoteDpadButton(
								context,
								icon: MdiIcons.chevronDown,
								isCompact: isCompact,
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
										isCompact: isCompact,
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
									padding: EdgeInsets.symmetric(horizontal: isCompact ? AppSpacings.pSm : AppSpacings.pMd),
									child: _buildRemoteDpadButton(
										context,
										icon: iconFor(key),
										isCompact: isCompact,
										onTap: () => _sendRemoteSheetCommand(propId, key),
									),
								);
							}).toList(),
						),
					],
				],
			),
		);

		if (isLandscape) {
			showAppRightDrawer(
				context,
				title: remoteLocalizations.media_remote_control,
				titleIcon: MdiIcons.remote,
				scrollable: false,
				content: Center(child: remoteContent),
			);
		} else {
			showAppBottomSheet(
				context,
				title: remoteLocalizations.media_remote_control,
				titleIcon: MdiIcons.remote,
				content: remoteContent,
			);
		}
	}

	void _sendRemoteSheetCommand(String propId, TelevisionRemoteKeyValue command) {
		_devicesService?.setPropertyValue(propId, command.value);
	}
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

