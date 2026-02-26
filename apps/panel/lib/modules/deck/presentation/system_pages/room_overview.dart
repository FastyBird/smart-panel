import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/utils/unit_converter.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_container.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart' hide ClimateMode;
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/energy/presentation/widgets/energy_summary_pill.dart';
import 'package:fastybird_smart_panel/modules/energy/services/energy_service.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/scenes/export.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Room system view - shows room-specific devices, scenes, and controls.
///
/// This is the primary view for displays with role=room. It provides:
/// - Room name and icon in header with status badges
/// - Domain cards with rich summary data (inspired by deck mock designs)
/// - Quick scene pills for this room
/// - Sensor readings strip at the bottom
/// - Suggested actions based on context
class RoomOverviewPage extends StatefulWidget {
	final SystemViewItem viewItem;

	const RoomOverviewPage({
		super.key,
		required this.viewItem,
	});

	@override
	State<RoomOverviewPage> createState() => _RoomOverviewPageState();
}

class _RoomOverviewPageState extends State<RoomOverviewPage> {
	final EventBus _eventBus = locator<EventBus>();

	late final IntentsService _intentsService;
	late final DeckService _deckService;
	DevicesService? _devicesService;
	ScenesService? _scenesService;
	SpacesService? _spacesService;
	MediaActivityService? _mediaActivityService;

	// Loading states
	bool _isLoading = true;
	bool _isSceneTriggering = false;
	String? _triggeringSceneId;

	// Room overview model (built from pure function)
	RoomOverviewModel? _model;

	// Energy widget settings from status_widgets
	bool _showEnergyPill = false;
	bool _energyShowProduction = true;
	EnergyRange _energyRange = EnergyRange.today;

	// Additional live data (not in model)
	int _lightsOnCount = 0;
	double? _temperature;
	double? _humidity;
	int? _shadingPosition;
	int _mediaOnCount = 0;

	// Error state
	String? _errorMessage;

	String get _roomId => widget.viewItem.roomId ?? '';

	@override
	void initState() {
		super.initState();
		_intentsService = locator<IntentsService>();
		_deckService = locator<DeckService>();

		try {
			_devicesService = locator<DevicesService>();
			_devicesService?.addListener(_onDevicesDataChanged);
		} catch (_) {}

		try {
			_scenesService = locator<ScenesService>();
		} catch (_) {}

		try {
			_spacesService = locator<SpacesService>();
			_spacesService?.addListener(_onSpacesDataChanged);
		} catch (_) {}

		try {
			if (locator.isRegistered<MediaActivityService>()) {
				_mediaActivityService = locator<MediaActivityService>();
				_mediaActivityService?.addListener(_onSpacesDataChanged);
			}
		} catch (_) {}

		// Listen for DeckService changes (e.g., when device categories are loaded)
		_deckService.addListener(_onDeckServiceChanged);

		_loadRoomData();
	}

	void _onDeckServiceChanged() {
		// Reload room data when DeckService updates (e.g., device categories loaded)
		if (mounted && !_deckService.isLoadingDevices) {
			debugPrint(
				'[ROOM OVERVIEW] DeckService changed, reloading. '
				'deviceCategories: ${_deckService.deviceCategories.length}',
			);
			_loadRoomData();
		}
	}

	void _onDevicesDataChanged() {
		// Devices updated (e.g., light on/off state changed, device assigned/unassigned)
		// Refresh live device data and rebuild UI
		if (mounted) {
			_refreshLiveData();
		}
	}

	void _onSpacesDataChanged() {
		// Spaces data updated, refresh live data
		if (mounted) {
			_refreshLiveData();
		}
	}

	Future<void> _refreshLiveData() async {
		await _fetchLiveDeviceData();
		if (mounted) {
			_applyEnergyWidgetSettings();
			_rebuildModel();
		}
	}

	@override
	void dispose() {
		_deckService.removeListener(_onDeckServiceChanged);
		_devicesService?.removeListener(_onDevicesDataChanged);
		_spacesService?.removeListener(_onSpacesDataChanged);
		_mediaActivityService?.removeListener(_onSpacesDataChanged);
		super.dispose();
	}

	/// Rebuilds the model with current live data and triggers UI update.
	void _rebuildModel() {
		final room = _spacesService?.getSpace(_roomId);
		final deviceCategories = _deckService.deviceCategories;
		final scenes = _scenesService?.getScenesForSpace(_roomId) ?? [];
		final display = locator<DisplayRepository>().display;

		if (display == null) return;

		// Fetch cached state models (same pattern as domain screens)
		final lightingState = _spacesService?.getLightingState(_roomId);
		final climateState = _spacesService?.getClimateState(_roomId);
		final coversState = _spacesService?.getCoversState(_roomId);
		final sensorState = _spacesService?.getSensorState(_roomId);
		final mediaState = _mediaActivityService?.getActiveState(_roomId);

		final input = RoomOverviewBuildInput(
			display: display,
			room: room,
			deviceCategories: deviceCategories,
			scenes: scenes,
			now: DateTime.now(),
			displayUnits: DisplayUnits.fromLocator(),
			lightsOnCount: _lightsOnCount,
			energyDeviceCount: _deckService.energyDeviceCount,
			sensorReadingsCount: _deckService.sensorReadingsCount,
			temperature: _temperature,
			humidity: _humidity,
			shadingPosition: _shadingPosition,
			mediaOnCount: _mediaOnCount,
			lightingState: lightingState,
			climateState: climateState,
			coversState: coversState,
			sensorState: sensorState,
			mediaState: mediaState,
		);

		setState(() {
			_model = buildRoomOverviewModel(input);
		});
	}

	Future<void> _loadRoomData() async {
		if (_roomId.isEmpty) {
			setState(() {
				_isLoading = false;
				_errorMessage = 'No room assigned to this display';
			});
			return;
		}

		setState(() {
			_isLoading = true;
			_errorMessage = null;
		});

		try {
			debugPrint(
				'[ROOM OVERVIEW] Loading room data. '
				'roomId: $_roomId, '
				'deviceCategories: ${_deckService.deviceCategories.length}, '
				'isLoadingDevices: ${_deckService.isLoadingDevices}',
			);

			// Fetch live device property values (temperature, lights on, humidity, etc.)
			await _fetchLiveDeviceData();

			// Trigger initial API fetches for state models (fire-and-forget, same as domain screens)
			_spacesService?.fetchLightingState(_roomId).catchError((_) => null);
			_spacesService?.fetchClimateState(_roomId).catchError((_) => null);
			_spacesService?.fetchCoversState(_roomId).catchError((_) => null);
			_spacesService?.fetchSensorState(_roomId).catchError((_) => null);

			// Read energy widget settings from room status_widgets
			_applyEnergyWidgetSettings();

			if (!mounted) return;

			// Check display availability before building model
			final display = locator<DisplayRepository>().display;

			if (display == null) {
				setState(() {
					_isLoading = false;
					_errorMessage = 'Display not configured';
				});
				return;
			}

			_rebuildModel();

			setState(() {
				_isLoading = false;
			});
		} catch (e) {
			if (!mounted) return;

			setState(() {
				_isLoading = false;
				_errorMessage = 'Failed to load room data';
			});
		}
	}

	/// Reads energy widget settings from the room's status_widgets config.
	///
	/// The energy pill is hidden by default and only shown when the space
	/// has an energy entry in its [statusWidgets] list.
	void _applyEnergyWidgetSettings() {
		final room = _spacesService?.getSpace(_roomId);
		if (room == null) return;

		final energyWidget = room.statusWidgets
				?.where((w) => w.type == 'energy')
				.firstOrNull;

		if (energyWidget == null) {
			_showEnergyPill = false;
			return;
		}

		_showEnergyPill = true;
		_energyShowProduction = energyWidget.settings['show_production'] as bool? ?? true;

		final rangeStr = energyWidget.settings['range'] as String?;
		_energyRange = rangeStr != null
				? EnergyRange.values.where((r) => r.value == rangeStr).firstOrNull ?? EnergyRange.today
				: EnergyRange.today;
	}

	/// Fetches live device property values for all domains.
	Future<void> _fetchLiveDeviceData() async {
		try {
			final devices = _devicesService?.getDevicesForRoom(_roomId) ?? [];

			debugPrint(
				'[ROOM OVERVIEW] Live device fetch returned ${devices.length} devices. '
				'Categories: ${devices.map((d) => d.category.name).toList()}',
			);

			int lightsOnCount = 0;
			double? temperature;
			double? humidity;
			int? shadingPosition;
			int mediaOnCount = 0;

			for (final device in devices) {
				// Count lights on
				if (_isLightingDevice(device) && _isDeviceOn(device)) {
					lightsOnCount++;
				}

				// Count media devices that are on
				if (_isMediaDevice(device) && _isDeviceOn(device)) {
					mediaOnCount++;
				}

				// Extract property values from channels
				for (final channel in device.channels) {
					for (final property in channel.properties) {
						switch (property.category) {
							case DevicesModulePropertyCategory.temperature:
								temperature ??= _getNumericValue(property);
								break;
							case DevicesModulePropertyCategory.humidity:
								humidity ??= _getNumericValue(property);
								break;
							case DevicesModulePropertyCategory.position:
								if (classifyDeviceToDomain(device.category) == DomainType.shading) {
									final pos = _getNumericValue(property);
									if (pos != null) {
										shadingPosition ??= pos.round();
									}
								}
								break;
							default:
								break;
						}
					}
				}
			}

			_lightsOnCount = lightsOnCount;
			_temperature = temperature;
			_humidity = humidity;
			_shadingPosition = shadingPosition;
			_mediaOnCount = mediaOnCount;
		} catch (_) {
			// Keep existing values on error
		}
	}

	bool _isLightingDevice(DeviceView device) {
		return classifyDeviceToDomain(device.category) == DomainType.lights;
	}

	bool _isMediaDevice(DeviceView device) {
		return classifyDeviceToDomain(device.category) == DomainType.media;
	}

	/// Check if a device is currently on by looking for the 'on' property
	bool _isDeviceOn(DeviceView device) {
		for (final channel in device.channels) {
			for (final property in channel.properties) {
				if (property.category == DevicesModulePropertyCategory.valueOn) {
					final valueType = property.value;
					if (valueType != null) {
						final rawValue = valueType.value;
						if (rawValue is bool) {
							return rawValue;
						}
						if (rawValue is String) {
							return rawValue.toLowerCase() == 'true';
						}
					}
				}
			}
		}
		return false;
	}

	/// Get numeric value from a property
	double? _getNumericValue(ChannelPropertyView property) {
		final valueType = property.value;
		if (valueType != null) {
			final rawValue = valueType.value;
			if (rawValue is num) {
				return rawValue.toDouble();
			}
		}
		return null;
	}

	void _navigateToDomainView(DomainType domain) {
		final roomId = widget.viewItem.roomId;
		if (roomId == null) return;

		final domainViewId = DomainViewItem.generateId(domain, roomId);
		_eventBus.fire(NavigateToDeckItemEvent(domainViewId));
	}

	void _navigateToEnergyView() {
		// Try room-specific energy domain view first, then standalone energy screen
		final domainViewId = DomainViewItem.generateId(DomainType.energy, _roomId);

		if (_deckService.indexOfItem(domainViewId) >= 0) {
			_eventBus.fire(NavigateToDeckItemEvent(domainViewId));
		} else {
			_eventBus.fire(NavigateToDeckItemEvent(EnergyViewItem.generateId()));
		}
	}

	Future<void> _triggerScene(String sceneId) async {
		if (_isSceneTriggering) return;

		setState(() {
			_isSceneTriggering = true;
			_triggeringSceneId = sceneId;
		});

		try {
			final result = await _intentsService.activateScene(sceneId);

			if (!mounted) return;

			setState(() {
				_isSceneTriggering = false;
				_triggeringSceneId = null;
			});

			final localizations = AppLocalizations.of(context);

			if (result.isSuccess) {
				Toast.showSuccess(
					context,
					message: localizations?.space_scene_triggered ?? 'Scene activated',
				);
			} else if (result.isPartialSuccess) {
				Toast.showInfo(
					context,
					message: localizations?.space_scene_partial_success ??
						'Scene partially activated',
				);
			} else {
				Toast.showError(
					context,
					message: result.message ?? localizations?.action_failed ?? 'Failed',
				);
			}
		} catch (e) {
			if (!mounted) return;

			setState(() {
				_isSceneTriggering = false;
				_triggeringSceneId = null;
			});

			final localizations = AppLocalizations.of(context);
			Toast.showError(
				context,
				message: localizations?.action_failed ?? 'Failed to activate scene',
			);
		}
	}

	ClimateMode _nextClimateMode(ClimateMode current) {
		switch (current) {
			case ClimateMode.off:
				return ClimateMode.heat;
			case ClimateMode.heat:
				return ClimateMode.cool;
			case ClimateMode.cool:
				return ClimateMode.auto;
			case ClimateMode.auto:
				return ClimateMode.off;
		}
	}

	Future<void> _handleQuickAction(QuickActionType type) async {
		final spacesService = _spacesService;
		if (spacesService == null) return;

		try {
			switch (type) {
				case QuickActionType.lightsOff:
					final result = await spacesService.turnLightsOff(_roomId);
					if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
					break;
				case QuickActionType.lightsHalf:
					final result = await spacesService.setLightingMode(_roomId, LightingMode.relax);
					if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
					break;
				case QuickActionType.lightsFull:
					final result = await spacesService.turnLightsOn(_roomId);
					if (mounted) IntentResultHandler.showOfflineAlertIfNeeded(context, result);
					break;
				case QuickActionType.climateMode:
					final csMode = spacesService.getClimateState(_roomId);
					if (csMode == null) return;
					final currentMode = csMode.mode ?? ClimateMode.off;
					final nextMode = _nextClimateMode(currentMode);
					final modeResult = await spacesService.setClimateMode(_roomId, nextMode);
					if (mounted) IntentResultHandler.showOfflineAlertIfNeededForClimate(context, modeResult);
					break;
				case QuickActionType.climateMinus:
				case QuickActionType.climatePlus:
					final cs = spacesService.getClimateState(_roomId);
					if (cs == null) return;
					final target = cs.effectiveTargetTemperature;
					if (target == null) return;
					final mode = cs.mode ?? ClimateMode.heat;
					final newTarget = type == QuickActionType.climatePlus
							? target + 1.0
							: target - 1.0;
					final clamped = newTarget.clamp(cs.minSetpoint, cs.maxSetpoint);
					final result = await spacesService.setSetpoint(_roomId, clamped, mode: mode);
					if (mounted) IntentResultHandler.showOfflineAlertIfNeededForClimate(context, result);
					break;
				case QuickActionType.coversClose:
					final result = await spacesService.closeCovers(_roomId);
					if (mounted) IntentResultHandler.showOfflineAlertIfNeededForCovers(context, result);
					break;
				case QuickActionType.coversHalf:
					final result = await spacesService.setCoversPosition(_roomId, 50);
					if (mounted) IntentResultHandler.showOfflineAlertIfNeededForCovers(context, result);
					break;
				case QuickActionType.coversOpen:
					final result = await spacesService.openCovers(_roomId);
					if (mounted) IntentResultHandler.showOfflineAlertIfNeededForCovers(context, result);
					break;
			}
		} catch (e) {
			if (mounted) {
				Toast.showError(context, message: 'Action failed');
			}
		}
	}

	// ===========================================================================
	// BUILD
	// ===========================================================================

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context);
		final model = _model;

		return LayoutBuilder(
			builder: (context, constraints) {
				final isPortrait = constraints.maxHeight > constraints.maxWidth;
				final screenService = locator<ScreenService>();
				final isCompact = !isPortrait &&
						(screenService.isSmallScreen || screenService.isMediumScreen);

				final skyPanel = SkyPanel(
					roomName: model?.title ?? widget.viewItem.title,
					isPortrait: isPortrait,
					isCompact: isCompact,
					scenes: model?.quickScenes ?? [],
					isSceneTriggering: _isSceneTriggering,
					triggeringSceneId: _triggeringSceneId,
					onSceneTap: _triggerScene,
				);

				final contentBody = _isLoading
						? _buildLoadingState()
						: _errorMessage != null
								? _buildErrorState()
								: model != null
										? _buildContent(context, localizations, model, isPortrait)
										: _buildEmptyState(context, localizations);

				final isDark = Theme.of(context).brightness == Brightness.dark;
				final pageBg = isDark ? AppBgColorDark.page : AppBgColorLight.page;

				if (isPortrait) {
					final skyHeight = (screenService.logicalHeight * 0.4)
							.clamp(0.0, AppSpacings.scale(500));

					return Column(
						children: [
							SizedBox(
								height: skyHeight,
								child: skyPanel,
							),
							Expanded(
								child: ColoredBox(
									color: pageBg,
									child: contentBody,
								),
							),
						],
					);
				}

				return Row(
					children: [
						SizedBox(
							width: constraints.maxWidth * 0.42,
							child: skyPanel,
						),
						Expanded(
							child: ColoredBox(
								color: pageBg,
								child: contentBody,
							),
						),
					],
				);
			},
		);
	}


	// ===========================================================================
	// LOADING / ERROR / EMPTY STATES
	// ===========================================================================

	Widget _buildLoadingState() {
		return Center(
			child: CircularProgressIndicator(
				color: Theme.of(context).colorScheme.primary,
			),
		);
	}

	Widget _buildErrorState() {
		return Center(
			child: Padding(
        padding: AppSpacings.paddingXl,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          spacing: AppSpacings.pMd,
          children: [
            Icon(
              MdiIcons.alertCircleOutline,
              size: AppSpacings.scale(64),
              color: Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.danger
                : AppColorsDark.danger,
            ),
            Text(
              _errorMessage!,
              style: TextStyle(
                fontSize: AppFontSize.base,
                color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
              ),
              textAlign: TextAlign.center,
            ),
            Theme(
              data: ThemeData(
                filledButtonTheme: Theme.of(context).brightness == Brightness.dark
                  ? AppFilledButtonsDarkThemes.primary
                  : AppFilledButtonsLightThemes.primary,
              ),
              child: FilledButton.icon(
                onPressed: _loadRoomData,
                icon: Icon(
                  MdiIcons.refresh,
                  size: AppFontSize.base,
                  color: Theme.of(context).brightness == Brightness.dark
                    ? AppFilledButtonsDarkThemes.primaryForegroundColor
                    : AppFilledButtonsLightThemes.primaryForegroundColor,
                ),
                label: const Text('Retry'),
              ),
            ),
          ],
        ),
      ),
		);
	}

	Widget _buildEmptyState(
		BuildContext context,
		AppLocalizations? localizations,
	) {
		return Center(
			child: Padding(
        padding: AppSpacings.paddingXl,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          spacing: AppSpacings.pMd,
          children: [
            IconContainer(
              screenService: locator<ScreenService>(),
              icon: MdiIcons.homeOffOutline,
              color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.placeholder
                : AppTextColorDark.placeholder,
              isLandscape: locator<ScreenService>().isLandscape,
              useContainer: false,
            ),
            Text(
              localizations?.space_empty_state_title ?? 'No Devices',
              style: TextStyle(
                fontSize: AppFontSize.large,
                fontWeight: FontWeight.w600,
                color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
              ),
              textAlign: TextAlign.center,
            ),
            Text(
              localizations?.space_empty_state_description ??
                'Assign devices to this room in Admin',
              style: TextStyle(
                fontSize: AppFontSize.small,
                color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.placeholder
                  : AppTextColorDark.placeholder,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
		);
	}

	// ===========================================================================
	// MAIN CONTENT — MOCK-INSPIRED LAYOUT
	// ===========================================================================

	Widget _buildContent(
		BuildContext context,
		AppLocalizations? localizations,
		RoomOverviewModel model,
		bool isPortrait,
	) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		return Column(
			crossAxisAlignment: CrossAxisAlignment.stretch,
			children: [
				// Status pills strip — top in landscape, bottom in portrait
				if (!isPortrait)
					Padding(
						padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd, vertical: AppSpacings.pSm),
						child: _buildStatusStrip(context, isDark, model),
					),

				// Scene pills row (portrait only — landscape shows them on the sky panel)
				if (isPortrait && model.hasScenes) ...[
					Padding(
						padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd, vertical: AppSpacings.pMd),
						child: _buildScenePills(context, isDark, model),
					),
				],

				// Domain cards grid
				if (model.domainCards.isNotEmpty)
					Expanded(
						child: isPortrait ?
              _buildDomainCardsGrid(context, isDark, model, isPortrait)
              : Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacings.pSm),
                child: _buildDomainCardsGrid(context, isDark, model, isPortrait),
              )
					),

				// Empty state when no domain cards and no scenes
				if (model.domainCards.isEmpty && !model.hasScenes)
					Expanded(child: _buildEmptyState(context, localizations))
				// Spacer when we have scenes but no domain cards
				else if (model.domainCards.isEmpty)
					const Spacer(),

				// Status pills strip — bottom in portrait
				if (isPortrait)
					Padding(
						padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd, vertical: AppSpacings.pSm),
						child: _buildStatusStrip(context, isDark, model),
					),
			],
		);
	}

	// ===========================================================================
	// SCENE PILLS (horizontal scrollable row)
	// ===========================================================================

	Widget _buildScenePills(
		BuildContext context,
		bool isDark,
		RoomOverviewModel model,
	) {
		return HorizontalScrollWithGradient(
			height: AppSpacings.scale(30),
			itemCount: model.quickScenes.length,
			separatorWidth: AppSpacings.pSm,
			itemBuilder: (_, i) => _buildScenePill(context, isDark, model.quickScenes[i]),
		);
	}

	Widget _buildScenePill(BuildContext context, bool isDark, QuickScene scene) {
		final isTriggering = _triggeringSceneId == scene.sceneId;
		final primaryColor = Theme.of(context).colorScheme.primary;

		return GestureDetector(
			onTap: _isSceneTriggering ? null : () => _triggerScene(scene.sceneId),
			child: Container(
				padding: EdgeInsets.symmetric(
					horizontal: AppSpacings.scale(12),
					vertical: AppSpacings.pSm,
				),
				decoration: BoxDecoration(
					color: isTriggering
						? primaryColor
						: (isDark
							? AppFillColorDark.light
							: AppFillColorLight.blank),
					borderRadius: BorderRadius.circular(AppBorderRadius.base),
					border: isTriggering
						? null
						: Border.all(
							color: isDark
								? AppFillColorDark.light
								: AppBorderColorLight.light,
						),
				),
				child: Row(
					mainAxisSize: MainAxisSize.min,
					spacing: AppSpacings.pSm,
					children: [
						if (isTriggering)
							SizedBox(
								width: AppSpacings.scale(12),
								height: AppSpacings.scale(12),
								child: CircularProgressIndicator(
									strokeWidth: 1.5,
									color: AppColors.white,
								),
							)
						else
							Icon(
								scene.icon,
								size: AppSpacings.scale(14),
								color: isDark
									? AppTextColorDark.secondary
									: AppTextColorLight.regular,
							),
						Text(
							scene.name,
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								fontWeight: FontWeight.w600,
								color: isTriggering
									? AppColors.white
									: (isDark
										? AppTextColorDark.secondary
										: AppTextColorLight.regular),
							),
						),
					],
				),
			),
		);
	}

	// ===========================================================================
	// DOMAIN CARDS GRID
	// ===========================================================================

	Widget _buildDomainCardsGrid(
		BuildContext context,
		bool isDark,
		RoomOverviewModel model,
		bool isPortrait,
	) {
		final cards = model.domainCards;
		final spacing = AppSpacings.pMd;
		final screenService = locator<ScreenService>();
		final isCompact = screenService.isSmallScreen ||
				(!isPortrait && screenService.isMediumScreen);
		final hideTargetValue = !isPortrait ||
				screenService.isSmallScreen;
		final maxTileHeight = AppSpacings.scale(isCompact ? 90 : 95);
		final rowCount = (cards.length / 2).ceil();

		return LayoutBuilder(
			builder: (context, constraints) {
				final tileWidth = (constraints.maxWidth - spacing - AppSpacings.pMd * 2) / 2;
				final aspectRatio = isCompact ? 1.5 : 1.4;
				final tileHeight = (tileWidth / aspectRatio).clamp(0, maxTileHeight).toDouble();

				return VerticalScrollWithGradient(
					itemCount: rowCount,
					separatorHeight: spacing,
					padding: EdgeInsets.only(
            left: AppSpacings.pMd,
            right: AppSpacings.pMd,
            bottom: AppSpacings.pMd,
          ),
					itemBuilder: (context, rowIndex) {
						final firstIndex = rowIndex * 2;
						final secondIndex = firstIndex + 1;

						return SizedBox(
							height: tileHeight,
							child: Row(
								spacing: spacing,
								children: [
									Expanded(
										child: _RoomDomainCard(
											cardInfo: cards[firstIndex],
											isDark: isDark,
											hideTargetValue: hideTargetValue,
											isCompact: isCompact,
											onTap: () => _navigateToDomainView(cards[firstIndex].domain),
											onQuickAction: _handleQuickAction,
										),
									),
									if (secondIndex < cards.length)
										Expanded(
											child: _RoomDomainCard(
												cardInfo: cards[secondIndex],
												isDark: isDark,
												hideTargetValue: hideTargetValue,
												isCompact: isCompact,
												onTap: () => _navigateToDomainView(cards[secondIndex].domain),
												onQuickAction: _handleQuickAction,
											),
										)
									else
										const Expanded(child: SizedBox.shrink()),
								],
							),
						);
					},
				);
			},
		);
	}

	// ===========================================================================
	// SENSOR STRIP
	// ===========================================================================

	Widget _buildStatusStrip(
		BuildContext context,
		bool isDark,
		RoomOverviewModel model,
	) {
		final energySlot = _showEnergyPill ? 1 : 0;
		final totalCount = model.sensorReadings.length + energySlot;

		return HorizontalScrollWithGradient(
			height: AppSpacings.scale(22),
			itemCount: totalCount,
			separatorWidth: AppSpacings.pSm,
			itemBuilder: (_, i) {
				if (i < model.sensorReadings.length) {
					return Center(
						child: _buildSensorPill(context, isDark, model.sensorReadings[i]),
					);
				}
				return Center(
					child: EnergySummaryPill(
						spaceId: _roomId,
						range: _energyRange,
						showProduction: _energyShowProduction,
						onTap: () => _navigateToEnergyView(),
					),
				);
			},
		);
	}

	Widget _buildSensorPill(BuildContext context, bool isDark, SensorReading reading) {
		final colorFamily = ThemeColorFamily.get(
			Theme.of(context).brightness,
			reading.color,
		);

		return Container(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pMd,
				vertical: AppSpacings.pSm,
			),
			decoration: BoxDecoration(
				color: colorFamily.light8,
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
			),
			child: Row(
				mainAxisSize: MainAxisSize.min,
				spacing: AppSpacings.pSm,
				children: [
					Icon(
						reading.icon,
						size: AppSpacings.scale(14),
						color: colorFamily.base,
					),
					Text(
						'${reading.label} ${reading.value}',
						style: TextStyle(
							fontSize: AppFontSize.extraSmall,
							fontWeight: FontWeight.w700,
							color: colorFamily.base,
							letterSpacing: 0.3,
						),
					),
				],
			),
		);
	}

}

// =============================================================================
// DOMAIN CARD WIDGET
// =============================================================================

/// A domain card inspired by the deck mock designs.
///
/// Shows domain icon, title, primary value, subtitle, and active accent.
/// Uses app theme colors mapped from the domain type.
class _RoomDomainCard extends StatelessWidget {
	final DomainCardInfo cardInfo;
	final bool isDark;
	final bool hideTargetValue;
	final bool isCompact;
	final VoidCallback onTap;
	final void Function(QuickActionType)? onQuickAction;

	const _RoomDomainCard({
		required this.cardInfo,
		required this.isDark,
		this.hideTargetValue = false,
		this.isCompact = false,
		required this.onTap,
		this.onQuickAction,
	});

	/// Action types that switch from label to icon on compact screens.
	static const _compactIconActions = {
		QuickActionType.lightsOff,
		QuickActionType.coversClose,
		QuickActionType.coversOpen,
	};

	static OutlinedButtonThemeData _domainOutlinedButtonTheme(
		DomainType domain,
		bool isDark,
	) {
		switch (domain) {
			case DomainType.lights:
				return isDark
						? AppOutlinedButtonsDarkThemes.warning
						: AppOutlinedButtonsLightThemes.warning;
			case DomainType.climate:
				return isDark
						? AppOutlinedButtonsDarkThemes.info
						: AppOutlinedButtonsLightThemes.info;
			case DomainType.shading:
				return isDark
						? AppOutlinedButtonsDarkThemes.teal
						: AppOutlinedButtonsLightThemes.teal;
			default:
				return isDark
						? AppOutlinedButtonsDarkThemes.base
						: AppOutlinedButtonsLightThemes.base;
		}
	}

	static Color _domainOutlinedButtonForegroundColor(
		DomainType domain,
		bool isDark,
	) {
		switch (domain) {
			case DomainType.lights:
				return isDark
						? AppOutlinedButtonsDarkThemes.warningForegroundColor
						: AppOutlinedButtonsLightThemes.warningForegroundColor;
			case DomainType.climate:
				return isDark
						? AppOutlinedButtonsDarkThemes.infoForegroundColor
						: AppOutlinedButtonsLightThemes.infoForegroundColor;
			case DomainType.shading:
				return isDark
						? AppOutlinedButtonsDarkThemes.tealForegroundColor
						: AppOutlinedButtonsLightThemes.tealForegroundColor;
			default:
				return isDark
						? AppOutlinedButtonsDarkThemes.baseForegroundColor
						: AppOutlinedButtonsLightThemes.baseForegroundColor;
		}
	}

	@override
	Widget build(BuildContext context) {
		final colorFamily = ThemeColorFamily.get(
			Theme.of(context).brightness,
			cardInfo.domain.themeColor,
		);

		final showActions = cardInfo.actions.isNotEmpty;
		final borderRadius = BorderRadius.circular(AppBorderRadius.base);
		final borderColor = isDark ? AppFillColorDark.light : AppBorderColorLight.darker;

		return GestureDetector(
			onTap: onTap,
			child: ClipRRect(
				borderRadius: borderRadius,
				child: Container(
					padding: EdgeInsets.all(AppSpacings.scale(12)),
					decoration: BoxDecoration(
						color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
						borderRadius: borderRadius,
						border: Border.all(color: borderColor),
					),
					foregroundDecoration: cardInfo.isActive
						? BoxDecoration(
							borderRadius: borderRadius,
							border: Border(
								left: BorderSide(
									color: colorFamily.base,
									width: 3.0,
								),
							),
						)
						: null,
				child: Column(
					crossAxisAlignment: CrossAxisAlignment.start,
					mainAxisAlignment: MainAxisAlignment.center,
					children: [
						Row(
							children: [
								Container(
									width: AppSpacings.scale(28),
									height: AppSpacings.scale(28),
									decoration: BoxDecoration(
										color: colorFamily.base,
										borderRadius: BorderRadius.circular(AppBorderRadius.base),
									),
									child: Icon(
										cardInfo.icon,
										size: AppSpacings.scale(16),
										color: AppColors.white,
									),
								),
								SizedBox(width: AppSpacings.pMd),
								Expanded(
									child: Column(
										crossAxisAlignment: CrossAxisAlignment.start,
										mainAxisSize: MainAxisSize.min,
										spacing: 0,
										children: [
											Text(
												cardInfo.title,
												style: TextStyle(
													fontSize: AppFontSize.small,
													fontWeight: FontWeight.w700,
													height: 1.0,
													color: isDark
														? AppTextColorDark.primary
														: AppTextColorLight.primary,
												),
											),
											Row(
												children: [
													Text(
														cardInfo.primaryValue,
														style: TextStyle(
															fontSize: AppFontSize.large,
															fontWeight: FontWeight.w700,
															height: 1.0,
															color: isDark
																? AppTextColorDark.primary
																: AppTextColorLight.primary,
														),
													),
													if (cardInfo.targetValue != null && !hideTargetValue) ...[
														Padding(
															padding: EdgeInsets.symmetric(horizontal: AppSpacings.scale(3)),
															child: Icon(
																cardInfo.targetIcon ?? MdiIcons.arrowRight,
																size: AppFontSize.small,
																color: isDark
																	? AppTextColorDark.placeholder
																	: AppTextColorLight.placeholder,
															),
														),
														Text(
															cardInfo.targetValue!,
															style: TextStyle(
																fontSize: AppFontSize.small,
																fontWeight: FontWeight.w700,
																height: 1.0,
																color: isDark
																	? AppTextColorDark.placeholder
																	: AppTextColorLight.placeholder,
															),
														),
													],
												],
											),
										],
									),
								),
							],
						),
						SizedBox(height: AppSpacings.pSm),
						// Subtitle items (always shown when present)
						if (cardInfo.subtitleItems.isNotEmpty)
							Builder(builder: (_) {
								final visibleItems = hideTargetValue
									? cardInfo.subtitleItems.where((item) => !item.compactHidden).toList()
									: cardInfo.subtitleItems;
								if (visibleItems.isEmpty) {
									return Text(
										cardInfo.subtitle,
										style: TextStyle(
											fontSize: AppFontSize.extraSmall,
											fontWeight: FontWeight.w500,
											color: isDark
												? AppTextColorDark.secondary
												: AppTextColorLight.secondary,
										),
										maxLines: 1,
										overflow: TextOverflow.ellipsis,
									);
								}
								return Row(
									children: [
										for (int i = 0; i < visibleItems.length; i++) ...[
											if (i > 0)
												Padding(
													padding: EdgeInsets.symmetric(horizontal: AppSpacings.scale(4)),
													child: Text(
														'\u00B7',
														style: TextStyle(
															fontSize: AppFontSize.extraSmall,
															fontWeight: FontWeight.w500,
															color: isDark
																? AppTextColorDark.secondary
																: AppTextColorLight.secondary,
														),
													),
												),
											if (visibleItems[i].icon != null)
												Padding(
													padding: EdgeInsets.only(right: AppSpacings.scale(2)),
													child: Icon(
														visibleItems[i].icon,
														size: AppFontSize.extraSmall,
														color: isDark
															? AppTextColorDark.secondary
															: AppTextColorLight.secondary,
													),
												),
											Text(
												visibleItems[i].text,
												style: TextStyle(
													fontSize: AppFontSize.extraSmall,
													fontWeight: FontWeight.w500,
													color: isDark
														? AppTextColorDark.secondary
														: AppTextColorLight.secondary,
												),
											),
										],
									],
								);
							})
						// Plain subtitle fallback (only when no subtitle items and no actions)
						else if (!showActions && cardInfo.subtitle.isNotEmpty)
							Text(
								cardInfo.subtitle,
								style: TextStyle(
									fontSize: AppFontSize.extraSmall,
									fontWeight: FontWeight.w500,
									color: isDark
										? AppTextColorDark.secondary
										: AppTextColorLight.secondary,
								),
								maxLines: 1,
								overflow: TextOverflow.ellipsis,
							),
						// Quick action buttons
						if (showActions) ...[
							if (cardInfo.subtitleItems.isNotEmpty)
								SizedBox(height: AppSpacings.scale(2)),
							Builder(builder: (_) {
								final fgColor = _domainOutlinedButtonForegroundColor(
									cardInfo.domain,
									isDark,
								);
								final btnTheme = _domainOutlinedButtonTheme(
									cardInfo.domain,
									isDark,
								);
								return Theme(
									data: ThemeData(
										outlinedButtonTheme: btnTheme,
									),
									child: Row(
										children: [
											for (int i = 0; i < cardInfo.actions.length; i++) ...[
												if (i > 0) SizedBox(width: AppSpacings.pSm),
												Builder(builder: (_) {
													final action = cardInfo.actions[i];
													final useIcon = action.label == null || (isCompact && _compactIconActions.contains(action.type));
													if (useIcon) {
														return OutlinedButton(
															onPressed: () => onQuickAction?.call(action.type),
															style: OutlinedButton.styleFrom(
																padding: EdgeInsets.symmetric(
																	horizontal: AppSpacings.pMd,
																	vertical: AppSpacings.pMd,
																),
																minimumSize: Size.zero,
																tapTargetSize: MaterialTapTargetSize.shrinkWrap,
															),
															child: Icon(
																action.icon,
																size: AppFontSize.small,
																color: fgColor,
															),
														);
													}
													return OutlinedButton(
														onPressed: () => onQuickAction?.call(action.type),
														style: OutlinedButton.styleFrom(
															padding: EdgeInsets.symmetric(
																horizontal: isCompact ? AppSpacings.pSm : AppSpacings.pMd,
																vertical: AppSpacings.pMd,
															),
														),
														child: Text(
															action.label!,
															style: TextStyle(
																fontSize: AppFontSize.small,
																fontWeight: FontWeight.w600,
																height: 1.0,
																color: fgColor,
															),
														),
													);
												}),
											],
										],
									),
								);
							}),
						],
					],
				),
			),
			),
		);
	}
}
