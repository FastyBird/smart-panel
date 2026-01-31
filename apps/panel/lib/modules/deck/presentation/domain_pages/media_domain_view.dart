import 'dart:convert';
import 'dart:math' as math;

import 'package:event_bus/event_bus.dart';
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
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/utils/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/navigate_event.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/media_activity/media_activity.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/intent_types.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/space_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/services/media_activity_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

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

	MediaActivityService? _mediaService;
	SpacesService? _spacesService;
	SpaceStateRepository? _spaceStateRepo;
	DeckService? _deckService;
	EventBus? _eventBus;
	SocketService? _socketService;
	DevicesService? _devicesService;

	bool _isLoading = true;
	bool _isSending = false;
	bool _wsConnected = false;

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
			_spaceStateRepo = locator<SpaceStateRepository>();
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDomainViewPage] Failed to get SpaceStateRepository: $e');
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
				setState(() => _isLoading = false);
			}
		}
	}

	Future<void> _refresh() async {
		await _prefetch();
	}

	@override
	void dispose() {
		_pulseController.dispose();
		_mediaService?.removeListener(_onDataChanged);
		_socketService?.removeConnectionListener(_onConnectionChanged);
		super.dispose();
	}

	void _onDataChanged() {
		if (!mounted) return;
		WidgetsBinding.instance.addPostFrameCallback((_) {
			if (mounted) setState(() {});
		});
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
		setState(() => _isSending = true);
		try {
			if (key == MediaActivityKey.off) {
				await _mediaService!.deactivateActivity(_roomId);
			} else {
				await _mediaService!.activateActivity(_roomId, key);
			}
		} finally {
			if (mounted) setState(() => _isSending = false);
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
												padding: const EdgeInsets.all(32),
												children: [
													const SizedBox(height: 48),
													Icon(
														MdiIcons.monitorOff,
														size: 64,
														color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
													),
													const SizedBox(height: 16),
													Text(
														AppLocalizations.of(context)!.media_no_endpoints_title,
														textAlign: TextAlign.center,
														style: Theme.of(context).textTheme.titleMedium,
													),
													const SizedBox(height: 8),
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
								if (!_wsConnected) _buildOfflineOverlay(context),
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

		final isCompact = activeState.isActive || activeState.isActiveWithWarnings;
		final verticalPadding = isCompact ? AppSpacings.pLg : AppSpacings.pXl * 3;

		return Container(
			width: double.infinity,
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pLg,
				vertical: verticalPadding,
			),
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
			padding: EdgeInsets.symmetric(vertical: AppSpacings.pXl * 3),
			child: Column(
				mainAxisAlignment: MainAxisAlignment.center,
				crossAxisAlignment: CrossAxisAlignment.center,
				children: [
					Container(
						width: 148,
						height: 148,
						decoration: BoxDecoration(
							color: isDark ? AppFillColorDark.base : AppFillColorLight.base,
							shape: BoxShape.circle,
						),
						child: Icon(
							MdiIcons.television,
							size: 76,
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

		return Column(
			mainAxisAlignment: MainAxisAlignment.center,
			children: [
					AnimatedBuilder(
						animation: _pulseController,
						builder: (context, child) {
							return Transform.rotate(
								angle: _pulseController.value * 2 * math.pi,
								child: Container(
									width: 56,
									height: 56,
									decoration: BoxDecoration(
										shape: BoxShape.circle,
										border: Border.all(
											color: accentColor.withValues(alpha: 0.2),
											width: 3,
										),
									),
									child: CustomPaint(
										painter: _SpinnerArcPainter(
											color: accentColor,
											progress: _pulseController.value,
										),
									),
								),
							);
						},
					),
					const SizedBox(height: 20),
					Text(
						'Starting $activityName...',
						style: TextStyle(
							fontSize: 16,
							fontWeight: FontWeight.w600,
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					),
			],
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

		return Column(
			mainAxisAlignment: MainAxisAlignment.center,
			children: [
					Container(
						width: 72,
						height: 72,
						decoration: BoxDecoration(
							color: errorBg,
							shape: BoxShape.circle,
						),
						child: Icon(
							Icons.close,
							size: 36,
							color: errorColor,
						),
					),
					const SizedBox(height: 16),
					Text(
						'$activityName Failed',
						style: TextStyle(
							fontSize: 18,
							fontWeight: FontWeight.w600,
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					),
					const SizedBox(height: 8),
					Text(
						'Activity failed to apply. Check device connectivity.',
						style: TextStyle(
							fontSize: 13,
							color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
						),
						textAlign: TextAlign.center,
					),
					const SizedBox(height: 20),
					Row(
						mainAxisAlignment: MainAxisAlignment.center,
						children: [
							ElevatedButton(
								onPressed: () => _retryActivity(activeState),
								style: ElevatedButton.styleFrom(
									backgroundColor: accentColor,
									foregroundColor: Colors.white,
									padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
									shape: RoundedRectangleBorder(
										borderRadius: BorderRadius.circular(12),
									),
									elevation: 0,
								),
								child: const Text('Retry'),
							),
							const SizedBox(width: 12),
							OutlinedButton(
								onPressed: _deactivateActivity,
								style: OutlinedButton.styleFrom(
									foregroundColor: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
									padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
									side: BorderSide(color: isDark ? AppBorderColorDark.base : AppBorderColorLight.base),
									shape: RoundedRectangleBorder(
										borderRadius: BorderRadius.circular(12),
									),
								),
								child: const Text('Turn Off'),
							),
						],
					),
					const SizedBox(height: 12),
					TextButton(
						onPressed: () => _showFailureDetailsSheet(context, activeState),
						child: const Text('View Details'),
					),
			],
		);
	}

	// ============================================
	// ACTIVE ACTIVITY CARD
	// ============================================

	Widget _buildActiveCard(
		BuildContext context,
		MediaActiveStateModel activeState,
	) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final targets = _mediaService?.resolveControlTargets(_roomId) ?? const ActiveControlTargets();
		final compositionEntries = _mediaService?.getActiveCompositionEntries(_roomId) ?? [];
		final accentColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		final accentBg = isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight9;

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
			displayItems.add(_CompositionDisplayItem(
				role: entry.role,
				displayName: name,
				isOnline: isOnline,
			));
			if (!isOnline) offlineRoles.add(entry.role);
		}

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			children: [
				// Activity header with icon + name + status
				Row(
					children: [
						Container(
							width: _screenService.scale(48, density: _visualDensityService.density),
							height: _screenService.scale(48, density: _visualDensityService.density),
							decoration: BoxDecoration(
								color: accentBg,
								borderRadius: BorderRadius.circular(AppBorderRadius.base),
							),
							child: Icon(
								_activityIcon(activeState.activityKey),
								size: _screenService.scale(24, density: _visualDensityService.density),
								color: accentColor,
							),
						),
						AppSpacings.spacingMdHorizontal,
						Expanded(
							child: Column(
								crossAxisAlignment: CrossAxisAlignment.start,
								children: [
									Text(
										_activityLabel(activeState.activityKey),
										style: TextStyle(
											fontSize: AppFontSize.large,
											fontWeight: FontWeight.w600,
											color: isDark ? AppTextColorDark.regular : AppTextColorLight.regular,
										),
									),
									Text(
										activeState.hasWarnings ? 'Active with issues' : 'Active',
										style: TextStyle(
											fontSize: AppFontSize.small,
											color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
										),
									),
								],
							),
						),
					],
				),

					// Warning banner
					if (activeState.hasWarnings && !activeState.isFailed) ...[
						const SizedBox(height: 16),
						_buildWarningBanner(context, activeState),
					],

					// Offline device banner
					if (offlineRoles.isNotEmpty && !activeState.hasWarnings) ...[
						const SizedBox(height: 16),
						_buildOfflineDeviceBanner(context, offlineRoles),
					],

					// Composition preview
					if (displayItems.isNotEmpty) ...[
						const SizedBox(height: 16),
						_buildCompositionPreview(context, displayItems),
					],

					// Capability-driven controls
					if (targets.hasPlayback) ...[
						const SizedBox(height: 16),
						_buildPlaybackControl(context),
					],
					if (targets.hasVolume) ...[
						const SizedBox(height: 16),
						_buildVolumeControl(context),
					],
					if (targets.hasInput) ...[
						const SizedBox(height: 16),
						_buildInputControl(context),
					],
					if (targets.hasRemote) ...[
						const SizedBox(height: 16),
						_buildRemoteButton(context),
					],

					// Failure details
				if (activeState.isFailed) ...[
					const SizedBox(height: 12),
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
				padding: const EdgeInsets.all(12),
				decoration: BoxDecoration(
					color: warningBg,
					borderRadius: BorderRadius.circular(12),
				),
				child: Row(
					children: [
						Icon(Icons.warning_amber_rounded, color: warningColor, size: 18),
						const SizedBox(width: 10),
						Expanded(
							child: Text(
								label,
								style: TextStyle(
									fontSize: 12,
									color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
								),
							),
						),
						Icon(Icons.chevron_right, color: warningColor, size: 18),
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
			padding: const EdgeInsets.all(12),
			decoration: BoxDecoration(
				color: warningBg,
				borderRadius: BorderRadius.circular(12),
			),
			child: Row(
				children: [
					Icon(Icons.warning_amber_rounded, color: warningColor, size: 18),
					const SizedBox(width: 10),
					Expanded(
						child: Text(
							label,
							style: TextStyle(
								fontSize: 12,
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
		final density = _visualDensityService.density;
		final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;

		return Container(
			padding: AppSpacings.paddingLg,
			decoration: BoxDecoration(
				color: isDark ? AppFillColorDark.base : AppFillColorLight.base,
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

					return Row(
						children: [
							Container(
								width: _screenService.scale(32, density: density),
								height: _screenService.scale(32, density: density),
								decoration: BoxDecoration(
									color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
									borderRadius: BorderRadius.circular(AppBorderRadius.base),
								),
								child: Icon(
									icon,
									size: _screenService.scale(16, density: density),
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
													color: isLight ? AppTextColorLight.placeholder : AppTextColorDark.placeholder,
													letterSpacing: 0.5,
												),
											),
										Text(
											nameText,
											style: TextStyle(
												fontSize: AppFontSize.small,
												fontWeight: FontWeight.w500,
												color: nameColor,
											),
										),
									],
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
		final mediaState = _spaceStateRepo?.getMediaState(_roomId);
		final volume = mediaState?.averageVolume ?? 0;
		final isMuted = mediaState?.anyMuted ?? false;

		final columnWidth = _screenService.scale(40, density: _visualDensityService.density);

		return Row(
			children: [
				SizedBox(
					width: columnWidth,
					child: GestureDetector(
						onTap: _isSending ? null : () => _toggleMute(),
						child: Container(
							padding: EdgeInsets.all(AppSpacings.pMd),
							decoration: BoxDecoration(
								color: isMuted
										? (isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight9)
										: (isDark ? AppFillColorDark.base : AppFillColorLight.base),
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
				AppSpacings.spacingMdHorizontal,
				Expanded(
					child: SliderWithSteps(
						value: volume / 100,
						activeColor: accentColor,
						showSteps: false,
						enabled: !_isSending,
						onChanged: (val) => _setVolume((val * 100).round()),
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

	Widget _buildInputControl(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final accentColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		// TODO: Replace with real input sources when API is available
		return GestureDetector(
			onTap: _isSending ? null : () => _showInputSelector(),
			child: Container(
				padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
				decoration: BoxDecoration(
					color: isDark ? AppFillColorDark.base : AppFillColorLight.base,
					border: Border.all(color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light),
					borderRadius: BorderRadius.circular(12),
				),
				child: Row(
					children: [
						Icon(MdiIcons.audioInputStereoMinijack, size: 18,
							color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
						const SizedBox(width: 8),
						Text(
							'Input',
							style: TextStyle(
								fontSize: 13,
								fontWeight: FontWeight.w500,
								color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
							),
						),
						const Spacer(),
						Text(
							'Select',
							style: TextStyle(
								fontSize: 12,
								color: accentColor,
							),
						),
						const SizedBox(width: 4),
						Icon(Icons.chevron_right, size: 16, color: accentColor),
					],
				),
			),
		);
	}

	Widget _buildPlaybackControl(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final accentColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		final density = _visualDensityService.density;
		// TODO: Replace with real playback state when API is available
		const title = 'No track';
		const artist = '';
		const position = Duration.zero;
		const duration = Duration.zero;
		const progress = 0.0;

		return Column(
			spacing: AppSpacings.pLg,
			children: [
				// Now playing info
				Column(
					children: [
						Text(
							title,
							style: TextStyle(
								fontSize: AppFontSize.large,
								fontWeight: FontWeight.w600,
								color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
							),
							textAlign: TextAlign.center,
						),
						if (artist.isNotEmpty)
							Text(
								artist,
								style: TextStyle(
									fontSize: AppFontSize.small,
									color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
								),
								textAlign: TextAlign.center,
							),
					],
				),
				// Transport buttons (circular)
				Row(
					mainAxisAlignment: MainAxisAlignment.center,
					spacing: AppSpacings.pLg,
					children: [
						_buildTransportButton(
							context,
							icon: MdiIcons.skipPrevious,
							onTap: _isSending ? null : () => _sendPlaybackCommand('previous'),
						),
						_buildTransportButton(
							context,
							icon: MdiIcons.play,
							isMain: true,
							onTap: _isSending ? null : () => _sendPlaybackCommand('play'),
						),
						_buildTransportButton(
							context,
							icon: MdiIcons.skipNext,
							onTap: _isSending ? null : () => _sendPlaybackCommand('next'),
						),
					],
				),
				// Progress bar with timestamps
				Row(
					children: [
						Text(
							_formatDuration(position),
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
							),
						),
						AppSpacings.spacingMdHorizontal,
						Expanded(
							child: Container(
								height: _screenService.scale(4, density: density),
								decoration: BoxDecoration(
									color: isDark ? AppFillColorDark.base : AppFillColorLight.base,
									borderRadius: BorderRadius.circular(_screenService.scale(2, density: density)),
								),
								child: FractionallySizedBox(
									alignment: Alignment.centerLeft,
									widthFactor: progress.clamp(0.0, 1.0),
									child: Container(
										decoration: BoxDecoration(
											color: accentColor,
											borderRadius: BorderRadius.circular(_screenService.scale(2, density: density)),
										),
									),
								),
							),
						),
						AppSpacings.spacingMdHorizontal,
						Text(
							_formatDuration(duration),
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
							),
						),
					],
				),
			],
		);
	}

	Widget _buildTransportButton(
		BuildContext context, {
		required IconData icon,
		bool isMain = false,
		VoidCallback? onTap,
	}) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final accentColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		final density = _visualDensityService.density;
		final size = _screenService.scale(isMain ? 56 : 44, density: density);
		final iconSize = _screenService.scale(isMain ? 28 : 20, density: density);

		return GestureDetector(
			onTap: onTap,
			child: Container(
				width: size,
				height: size,
				decoration: BoxDecoration(
					color: isMain ? accentColor : (isDark ? AppFillColorDark.base : AppFillColorLight.base),
					border: isMain ? null : Border.all(color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light),
					shape: BoxShape.circle,
				),
				child: Icon(
					icon,
					size: iconSize,
					color: isMain ? Colors.white : (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
				),
			),
		);
	}

	Widget _buildRemoteButton(BuildContext context) {
		final isLight = Theme.of(context).brightness == Brightness.light;

		return GestureDetector(
			onTap: _isSending ? null : () => _showRemote(),
			child: Container(
				padding: AppSpacings.paddingMd,
				decoration: BoxDecoration(
					color: isLight ? AppFillColorLight.base : AppFillColorDark.base,
					borderRadius: BorderRadius.circular(AppBorderRadius.base),
					border: isLight ? Border.all(color: AppBorderColorLight.base) : null,
				),
				child: Row(
					mainAxisAlignment: MainAxisAlignment.center,
					children: [
						Icon(
							MdiIcons.remote,
							size: _screenService.scale(18, density: _visualDensityService.density),
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
			padding: const EdgeInsets.all(12),
			decoration: BoxDecoration(
				color: errorBg,
				borderRadius: BorderRadius.circular(12),
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					Row(
						children: [
							Icon(Icons.error_outline, color: errorColor, size: 18),
							const SizedBox(width: 6),
							Expanded(
								child: Text(
									'Activity failed to apply ($errorCount error${errorCount != 1 ? 's' : ''}, $warningCount warning${warningCount != 1 ? 's' : ''})',
									style: TextStyle(fontWeight: FontWeight.w600, color: errorColor, fontSize: 13),
								),
							),
						],
					),
					const SizedBox(height: 8),
					Row(
						children: [
							OutlinedButton.icon(
								icon: const Icon(Icons.refresh, size: 16),
								label: const Text('Retry'),
								onPressed: () => _retryActivity(state),
							),
							const SizedBox(width: 8),
							OutlinedButton.icon(
								icon: const Icon(Icons.stop, size: 16),
								label: const Text('Deactivate'),
								onPressed: _deactivateActivity,
							),
							const Spacer(),
							TextButton(
								onPressed: () => _showFailureDetailsSheet(context, state),
								child: const Text('Details'),
							),
						],
					),
				],
			),
		);
	}

	void _showFailureDetailsSheet(BuildContext context, MediaActiveStateModel state) {
		final lastResult = state.lastResult;

		showModalBottomSheet(
			context: context,
			isScrollControlled: true,
			shape: const RoundedRectangleBorder(
				borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
			),
			builder: (ctx) {
				final errors = lastResult?.errors ?? [];
				final warnings = lastResult?.warnings ?? [];

				return DraggableScrollableSheet(
					initialChildSize: 0.5,
					minChildSize: 0.3,
					maxChildSize: 0.85,
					expand: false,
					builder: (ctx, scrollController) {
						return Padding(
							padding: const EdgeInsets.all(16),
							child: ListView(
								controller: scrollController,
								children: [
									// Header
									Row(
										children: [
											const Icon(Icons.info_outline, size: 24),
											const SizedBox(width: 8),
											Text(
												'Activation Details',
												style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
													fontWeight: FontWeight.bold,
												),
											),
										],
									),
									const SizedBox(height: 12),

									// Summary counts
									if (lastResult != null) ...[
										Row(
											children: [
												_summaryChip('Total', lastResult.stepsTotal, Colors.grey),
												const SizedBox(width: 8),
												_summaryChip('OK', lastResult.stepsSucceeded, Colors.green),
												const SizedBox(width: 8),
												_summaryChip('Errors', lastResult.errorCount, Colors.red),
												const SizedBox(width: 8),
												_summaryChip('Warnings', lastResult.warningCount, Colors.orange),
											],
										),
										const SizedBox(height: 16),
									],

									// Errors
									if (errors.isNotEmpty) ...[
										Text(
											'Errors (critical)',
											style: TextStyle(
												fontWeight: FontWeight.w600,
												color: Colors.red.shade700,
												fontSize: 13,
											),
										),
										const SizedBox(height: 4),
										...errors.map((f) => _failureRow(f, Colors.red)),
										const SizedBox(height: 12),
									],

									// Warnings
									if (warnings.isNotEmpty) ...[
										Text(
											'Warnings (non-critical)',
											style: TextStyle(
												fontWeight: FontWeight.w600,
												color: Colors.orange.shade700,
												fontSize: 13,
											),
										),
										const SizedBox(height: 4),
										...warnings.map((f) => _failureRow(f, Colors.orange)),
										const SizedBox(height: 12),
									],

									// Legacy string warnings
									if (state.warnings.isNotEmpty && warnings.isEmpty) ...[
										Text(
											'Warnings',
											style: TextStyle(
												fontWeight: FontWeight.w600,
												color: Colors.orange.shade700,
												fontSize: 13,
											),
										),
										const SizedBox(height: 4),
										...state.warnings.map((w) => Padding(
											padding: const EdgeInsets.only(bottom: 4),
											child: Text('- $w', style: const TextStyle(fontSize: 12)),
										)),
										const SizedBox(height: 12),
									],

									// Actions
									const Divider(),
									const SizedBox(height: 8),
									Row(
										children: [
											if (state.isFailed && state.activityKey != null)
												Expanded(
													child: FilledButton.icon(
														icon: const Icon(Icons.refresh, size: 16),
														label: const Text('Retry activity'),
														onPressed: () {
															Navigator.pop(ctx);
															_retryActivity(state);
														},
													),
												),
											if (state.isFailed) const SizedBox(width: 8),
											Expanded(
												child: OutlinedButton.icon(
													icon: const Icon(Icons.stop, size: 16),
													label: const Text('Deactivate'),
													onPressed: () {
														Navigator.pop(ctx);
														_deactivateActivity();
													},
												),
											),
										],
									),
									const SizedBox(height: 8),
									TextButton.icon(
										icon: const Icon(Icons.copy, size: 16),
										label: const Text('Copy debug JSON'),
										onPressed: () => _copyDebugJson(state),
									),
								],
							),
						);
					},
				);
			},
		);
	}

	Widget _summaryChip(String label, int count, Color color) {
		return Container(
			padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
			decoration: BoxDecoration(
				color: color.withValues(alpha: 0.1),
				borderRadius: BorderRadius.circular(8),
			),
			child: Text(
				'$label: $count',
				style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
			),
		);
	}

	Widget _failureRow(MediaStepFailureModel failure, Color color) {
		return Padding(
			padding: const EdgeInsets.only(bottom: 6),
			child: Container(
				width: double.infinity,
				padding: const EdgeInsets.all(8),
				decoration: BoxDecoration(
					color: color.withValues(alpha: 0.05),
					borderRadius: BorderRadius.circular(6),
					border: Border.all(color: color.withValues(alpha: 0.2)),
				),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						if (failure.label != null)
							Text(
								failure.label!,
								style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color),
							),
						Text(
							failure.reason,
							style: TextStyle(fontSize: 11, color: color.withValues(alpha: 0.8)),
						),
						if (failure.targetDeviceId != null)
							Text(
								'Device: ${failure.targetDeviceId}',
								style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
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

	Future<void> _copyDebugJson(MediaActiveStateModel state) async {
		final data = {
			'activityKey': state.activityKey?.name,
			'state': state.state.name,
			'warnings': state.warnings,
			if (state.lastResult != null) 'lastResult': {
				'stepsTotal': state.lastResult!.stepsTotal,
				'stepsSucceeded': state.lastResult!.stepsSucceeded,
				'stepsFailed': state.lastResult!.stepsFailed,
				'warningCount': state.lastResult!.warningCount,
				'errorCount': state.lastResult!.errorCount,
				'errors': state.lastResult!.errors.map((e) => e.toJson()).toList(),
				'warnings': state.lastResult!.warnings.map((e) => e.toJson()).toList(),
			},
		};
		try {
			await Clipboard.setData(ClipboardData(text: const JsonEncoder.withIndent('  ').convert(data)));
			if (mounted) {
				ScaffoldMessenger.of(context).showSnackBar(
					const SnackBar(content: Text('Debug JSON copied to clipboard')),
				);
			}
		} catch (_) {
			if (mounted) {
				ScaffoldMessenger.of(context).showSnackBar(
					const SnackBar(content: Text('Failed to copy to clipboard')),
				);
			}
		}
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
							padding: const EdgeInsets.only(bottom: 8),
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
						padding: const EdgeInsets.only(left: 4),
						child: Container(
							width: 48,
							height: 48,
							decoration: BoxDecoration(
								color: isDark ? AppFillColorDark.base : AppFillColorLight.base,
								borderRadius: BorderRadius.circular(12),
							),
							child: Icon(
								capIcon,
								size: 28,
								color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
							),
						),
					);
				}),
				AppSpacings.spacingMdHorizontal,
				Icon(
					Icons.chevron_right,
					size: 28,
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
	// OFFLINE OVERLAY (restyled)
	// ============================================

	Widget _buildOfflineOverlay(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final accentColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;

		return GestureDetector(
			behavior: HitTestBehavior.opaque,
			onTap: () {},
			child: Container(
				color: Colors.black.withValues(alpha: 0.85),
				child: Center(
					child: Padding(
						padding: const EdgeInsets.all(40),
						child: Column(
							mainAxisAlignment: MainAxisAlignment.center,
							children: [
								Container(
									width: 72,
									height: 72,
									decoration: BoxDecoration(
										color: Colors.white.withValues(alpha: 0.1),
										shape: BoxShape.circle,
									),
									child: Icon(
										Icons.wifi_off,
										size: 36,
										color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
									),
								),
								const SizedBox(height: 20),
								Text(
									AppLocalizations.of(context)!.media_ws_offline_title,
									style: const TextStyle(
										fontSize: 18,
										fontWeight: FontWeight.w600,
										color: Colors.white,
									),
									textAlign: TextAlign.center,
								),
								const SizedBox(height: 8),
								Text(
									AppLocalizations.of(context)!.media_ws_offline_description,
									style: TextStyle(
										fontSize: 13,
										color: Colors.white.withValues(alpha: 0.6),
									),
									textAlign: TextAlign.center,
								),
								const SizedBox(height: 24),
								ElevatedButton(
									onPressed: () {
										_socketService?.reconnect();
									},
									style: ElevatedButton.styleFrom(
										backgroundColor: accentColor,
										foregroundColor: Colors.white,
										padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
										shape: RoundedRectangleBorder(
											borderRadius: BorderRadius.circular(12),
										),
										elevation: 0,
									),
									child: const Text('Retry Connection'),
								),
								const SizedBox(height: 12),
								OutlinedButton(
									onPressed: _navigateToHome,
									style: OutlinedButton.styleFrom(
										foregroundColor: Colors.white.withValues(alpha: 0.8),
										side: BorderSide(color: Colors.white.withValues(alpha: 0.3)),
										shape: RoundedRectangleBorder(
											borderRadius: BorderRadius.circular(12),
										),
									),
									child: const Text('Back to Home'),
								),
							],
						),
					),
				),
			),
		);
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

	String _formatDuration(Duration duration) {
		final minutes = duration.inMinutes;
		final seconds = duration.inSeconds % 60;
		return '$minutes:${seconds.toString().padLeft(2, '0')}';
	}

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

	// Actions dispatching media intents via SpaceStateRepository
	Future<void> _setVolume(int volume) async {
		if (_spaceStateRepo == null) return;
		setState(() => _isSending = true);
		try {
			await _spaceStateRepo!.setMediaVolume(_roomId, volume);
		} finally {
			if (mounted) setState(() => _isSending = false);
		}
	}

	Future<void> _toggleMute() async {
		if (_spaceStateRepo == null) return;
		setState(() => _isSending = true);
		try {
			final mediaState = _spaceStateRepo!.getMediaState(_roomId);
			final isMuted = mediaState?.isMuted ?? false;
			if (isMuted) {
				await _spaceStateRepo!.unmuteMedia(_roomId);
			} else {
				await _spaceStateRepo!.muteMedia(_roomId);
			}
		} finally {
			if (mounted) setState(() => _isSending = false);
		}
	}

	void _showInputSelector() {
		ScaffoldMessenger.of(context).showSnackBar(
			const SnackBar(content: Text('Input selector coming soon')),
		);
	}

	Future<void> _sendPlaybackCommand(String command) async {
		if (_spaceStateRepo == null) return;
		setState(() => _isSending = true);
		try {
			final MediaIntentType type;
			switch (command) {
				case 'play':
					type = MediaIntentType.play;
					break;
				case 'pause':
					type = MediaIntentType.pause;
					break;
				case 'next':
					type = MediaIntentType.next;
					break;
				case 'previous':
					type = MediaIntentType.previous;
					break;
				default:
					return;
			}
			await _spaceStateRepo!.executeMediaIntent(
				spaceId: _roomId,
				type: type,
			);
		} finally {
			if (mounted) setState(() => _isSending = false);
		}
	}

	void _showRemote() {
		ScaffoldMessenger.of(context).showSnackBar(
			const SnackBar(content: Text('Remote control coming soon')),
		);
	}
}

// ============================================================================
// COMPOSITION DISPLAY ITEM
// ============================================================================

class _CompositionDisplayItem {
	final String role;
	final String displayName;
	final bool isOnline;

	const _CompositionDisplayItem({
		required this.role,
		required this.displayName,
		required this.isOnline,
	});
}

// ============================================================================
// SPINNER ARC PAINTER
// ============================================================================

class _SpinnerArcPainter extends CustomPainter {
	final Color color;
	final double progress;

	_SpinnerArcPainter({required this.color, required this.progress});

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
		return oldDelegate.progress != progress;
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
	SpaceStateRepository? _spaceStateRepo;
	SocketService? _socketService;
	bool _isSending = false;
	bool _wsConnected = false;

	MediaDeviceGroup get _group => widget.deviceGroup;

	@override
	void initState() {
		super.initState();
		try {
			_spaceStateRepo = locator<SpaceStateRepository>();
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDeviceDetailPage] Failed to get SpaceStateRepository: $e');
			}
		}
		try {
			_socketService = locator<SocketService>();
			_socketService?.addConnectionListener(_onConnectionChanged);
			_wsConnected = _socketService?.isConnected ?? false;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[MediaDeviceDetailPage] Failed to get SocketService: $e');
			}
		}
	}

	@override
	void dispose() {
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
						padding: const EdgeInsets.all(16),
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
						margin: const EdgeInsets.all(32),
						child: Padding(
							padding: const EdgeInsets.all(24),
							child: Column(
								mainAxisSize: MainAxisSize.min,
								children: [
									const Icon(Icons.wifi_off, size: 48, color: Colors.grey),
									const SizedBox(height: 16),
									Text(
										'Connection lost',
										style: Theme.of(context).textTheme.titleMedium,
										textAlign: TextAlign.center,
									),
									const SizedBox(height: 8),
									Text(
										'Media controls require a live WebSocket connection.',
										style: Theme.of(context).textTheme.bodySmall,
										textAlign: TextAlign.center,
									),
									const SizedBox(height: 16),
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
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
			child: Padding(
				padding: const EdgeInsets.all(16),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: 'Display', icon: MdiIcons.television),
						const SizedBox(height: 12),
						if (endpoint.capabilities.power)
							_buildPowerToggle(context),
						if (endpoint.capabilities.input) ...[
							const SizedBox(height: 8),
							_buildInputRow(context),
						],
						if (endpoint.capabilities.volume) ...[
							const SizedBox(height: 8),
							_buildVolumeRow(context),
						],
					],
				),
			),
		);
	}

	Widget _buildAudioSection(BuildContext context, MediaEndpointModel endpoint) {
		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
			margin: const EdgeInsets.only(top: 12),
			child: Padding(
				padding: const EdgeInsets.all(16),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: 'Audio', icon: MdiIcons.speaker),
						const SizedBox(height: 12),
						if (endpoint.capabilities.volume)
							_buildVolumeRow(context),
						if (endpoint.capabilities.mute) ...[
							const SizedBox(height: 8),
							_buildMuteToggle(context),
						],
						if (endpoint.capabilities.playback) ...[
							const SizedBox(height: 8),
							_buildPlaybackRow(context),
						],
						if (endpoint.capabilities.trackMetadata) ...[
							const SizedBox(height: 8),
							_buildTrackInfo(context),
						],
					],
				),
			),
		);
	}

	Widget _buildSourceSection(BuildContext context, MediaEndpointModel endpoint) {
		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
			margin: const EdgeInsets.only(top: 12),
			child: Padding(
				padding: const EdgeInsets.all(16),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: 'Source', icon: MdiIcons.playCircle),
						const SizedBox(height: 12),
						if (endpoint.capabilities.playback)
							_buildPlaybackRow(context),
						if (endpoint.capabilities.trackMetadata) ...[
							const SizedBox(height: 8),
							_buildTrackInfo(context),
						],
					],
				),
			),
		);
	}

	Widget _buildRemoteSection(BuildContext context) {
		return Card(
			shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
			margin: const EdgeInsets.only(top: 12),
			child: Padding(
				padding: const EdgeInsets.all(16),
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						SectionTitle(title: 'Remote', icon: MdiIcons.remote),
						const SizedBox(height: 12),
						// D-pad style remote control
						Center(
							child: Column(
								children: [
									IconButton(
										icon: Icon(MdiIcons.chevronUp, size: 32),
										onPressed: _isSending ? null : () {},
									),
									Row(
										mainAxisSize: MainAxisSize.min,
										children: [
											IconButton(
												icon: Icon(MdiIcons.chevronLeft, size: 32),
												onPressed: _isSending ? null : () {},
											),
											const SizedBox(width: 8),
											FilledButton(
												onPressed: _isSending ? null : () {},
												child: const Text('OK'),
											),
											const SizedBox(width: 8),
											IconButton(
												icon: Icon(MdiIcons.chevronRight, size: 32),
												onPressed: _isSending ? null : () {},
											),
										],
									),
									IconButton(
										icon: Icon(MdiIcons.chevronDown, size: 32),
										onPressed: _isSending ? null : () {},
									),
									const SizedBox(height: 8),
									Row(
										mainAxisAlignment: MainAxisAlignment.center,
										children: [
											TextButton(
												onPressed: _isSending ? null : () {},
												child: const Text('Back'),
											),
											const SizedBox(width: 16),
											TextButton(
												onPressed: _isSending ? null : () {},
												child: const Text('Home'),
											),
											const SizedBox(width: 16),
											TextButton(
												onPressed: _isSending ? null : () {},
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

	Widget _buildPowerToggle(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		return Row(
			children: [
				Icon(MdiIcons.power, size: 20),
				const SizedBox(width: 8),
				Text(localizations.media_capability_power),
				const Spacer(),
				FilledButton(
					onPressed: _isSending
							? null
							: () async {
									setState(() => _isSending = true);
									try {
										await _spaceStateRepo?.powerOnMedia(widget.spaceId);
									} finally {
										if (mounted) setState(() => _isSending = false);
									}
								},
					child: Text(localizations.media_action_power_on),
				),
				const SizedBox(width: 8),
				OutlinedButton(
					onPressed: _isSending
							? null
							: () async {
									setState(() => _isSending = true);
									try {
										await _spaceStateRepo?.powerOffMedia(widget.spaceId);
									} finally {
										if (mounted) setState(() => _isSending = false);
									}
								},
					child: Text(localizations.media_action_power_off),
				),
			],
		);
	}

	Widget _buildInputRow(BuildContext context) {
		return Row(
			children: [
				Icon(MdiIcons.audioInputStereoMinijack, size: 20),
				const SizedBox(width: 8),
				const Text('Input'),
				const Spacer(),
				TextButton(
					onPressed: _isSending ? null : () {
						ScaffoldMessenger.of(context).showSnackBar(
							const SnackBar(content: Text('Input selector coming soon')),
						);
					},
					child: const Text('Select'),
				),
			],
		);
	}

	Widget _buildVolumeRow(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		return Row(
			children: [
				Icon(MdiIcons.volumeHigh, size: 20),
				const SizedBox(width: 8),
				Text(localizations.media_volume),
				const Spacer(),
				IconButton(
					icon: Icon(MdiIcons.volumeMinus),
					iconSize: 20,
					onPressed: _isSending
							? null
							: () async {
									setState(() => _isSending = true);
									try {
										await _spaceStateRepo?.adjustMediaVolume(
											widget.spaceId,
											delta: VolumeDelta.small,
											increase: false,
										);
									} finally {
										if (mounted) setState(() => _isSending = false);
									}
								},
				),
				IconButton(
					icon: Icon(MdiIcons.volumePlus),
					iconSize: 20,
					onPressed: _isSending
							? null
							: () async {
									setState(() => _isSending = true);
									try {
										await _spaceStateRepo?.adjustMediaVolume(
											widget.spaceId,
											delta: VolumeDelta.small,
											increase: true,
										);
									} finally {
										if (mounted) setState(() => _isSending = false);
									}
								},
				),
			],
		);
	}

	Widget _buildMuteToggle(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		return Row(
			children: [
				Icon(MdiIcons.volumeMute, size: 20),
				const SizedBox(width: 8),
				Text(localizations.media_capability_mute),
				const Spacer(),
				TextButton(
					onPressed: _isSending
							? null
							: () async {
									setState(() => _isSending = true);
									try {
										await _spaceStateRepo?.muteMedia(widget.spaceId);
									} finally {
										if (mounted) setState(() => _isSending = false);
									}
								},
					child: Text(localizations.media_action_mute),
				),
				TextButton(
					onPressed: _isSending
							? null
							: () async {
									setState(() => _isSending = true);
									try {
										await _spaceStateRepo?.unmuteMedia(widget.spaceId);
									} finally {
										if (mounted) setState(() => _isSending = false);
									}
								},
					child: Text(localizations.media_action_unmute),
				),
			],
		);
	}

	Widget _buildPlaybackRow(BuildContext context) {
		return Row(
			mainAxisAlignment: MainAxisAlignment.center,
			children: [
				IconButton(
					icon: Icon(MdiIcons.skipPrevious),
					onPressed: _isSending ? null : () => _playbackCmd(MediaIntentType.previous),
				),
				IconButton(
					icon: Icon(MdiIcons.play),
					iconSize: 32,
					onPressed: _isSending ? null : () => _playbackCmd(MediaIntentType.play),
				),
				IconButton(
					icon: Icon(MdiIcons.pause),
					iconSize: 32,
					onPressed: _isSending ? null : () => _playbackCmd(MediaIntentType.pause),
				),
				IconButton(
					icon: Icon(MdiIcons.stop),
					onPressed: _isSending ? null : () => _playbackCmd(MediaIntentType.stop),
				),
				IconButton(
					icon: Icon(MdiIcons.skipNext),
					onPressed: _isSending ? null : () => _playbackCmd(MediaIntentType.next),
				),
			],
		);
	}

	Widget _buildTrackInfo(BuildContext context) {
		return Container(
			width: double.infinity,
			padding: const EdgeInsets.all(12),
			decoration: BoxDecoration(
				color: Theme.of(context).brightness == Brightness.dark
						? AppFillColorDark.light
						: AppFillColorLight.light,
				borderRadius: BorderRadius.circular(8),
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					Text(
						'Now Playing',
						style: Theme.of(context).textTheme.labelSmall,
					),
					const SizedBox(height: 4),
					Text(
						'Track information will appear here',
						style: Theme.of(context).textTheme.bodySmall,
					),
				],
			),
		);
	}

	Future<void> _playbackCmd(MediaIntentType type) async {
		if (_spaceStateRepo == null) return;
		setState(() => _isSending = true);
		try {
			await _spaceStateRepo!.executeMediaIntent(
				spaceId: widget.spaceId,
				type: type,
			);
		} finally {
			if (mounted) setState(() => _isSending = false);
		}
	}
}
