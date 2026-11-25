import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/unit_converter.dart';
import 'package:fastybird_smart_panel/core/widgets/app_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart'
    hide ClimateMode;
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/energy/services/energy_service.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/scenes/export.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/export.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_mode.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_overview_layout.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_overview_pills.dart';
import 'package:fastybird_smart_panel/modules/weather/presentation/weather_detail.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class _DomainOptimistic {
  final String? primaryValue;
  final String? unit;
  final bool? isActive;
  final ClimateMode? climateMode;

  /// The Climate target sent, in °C, and as the card shows it ("23°").
  final double? targetValue;
  final String? target;

  /// The shading position sent, for the Open / 50 % / Close selection.
  final int? shadingPosition;

  /// The request this override belongs to, so a late failure clears only
  /// its own.
  final int? request;
  final DateTime createdAt;

  const _DomainOptimistic({
    this.primaryValue,
    this.unit,
    this.isActive,
    this.climateMode,
    this.targetValue,
    this.target,
    this.shadingPosition,
    this.request,
    required this.createdAt,
  });

  bool get isExpired => DateTime.now().difference(createdAt).inSeconds > 5;
}

/// The room overview (docs/display-ui-design-spec.md §6): the flagship
/// screen of a display with role=room. It loads the room's model and live
/// data and lays them out with [RoomOverviewLayout]: the sky panel and
/// clock, one Room mode control, the domain cards with their quick actions,
/// the scene pills and the status strip.
class RoomOverviewPage extends StatefulWidget {
  final SystemViewItem viewItem;

  const RoomOverviewPage({super.key, required this.viewItem});

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

  // Optimistic overrides per domain
  final Map<DomainType, _DomainOptimistic> _optimistic = {};
  int _climateRequest = 0;
  Timer? _optimisticCleanupTimer;

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
      _scenesService?.addListener(_onScenesDataChanged);
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

  void _onScenesDataChanged() {
    // Scenes data updated (created, deleted, or modified via WS), rebuild model
    if (mounted) {
      _rebuildModel();
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
    _optimisticCleanupTimer?.cancel();
    _deckService.removeListener(_onDeckServiceChanged);
    _devicesService?.removeListener(_onDevicesDataChanged);
    _scenesService?.removeListener(_onScenesDataChanged);
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
      localizations: AppLocalizations.of(context)!,
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

    final freshModel = buildRoomOverviewModel(input);

    // Clear confirmed overrides (backend matches expected state)
    _clearConfirmedOverrides(freshModel);

    // Apply remaining overrides
    final adjustedCards = freshModel.domainCards.map((card) {
      final override = _optimistic[card.domain];
      if (override == null || override.isExpired) return card;

      final mode = override.climateMode;
      final modeInfo = mode == null ? null : _climateModeInfo(mode);
      final target = override.target;

      return optimisticCard(
        card,
        primaryValue: override.primaryValue,
        unit: override.unit,
        isActive: override.isActive,
        shadingPosition: override.shadingPosition,
        target: target,
        spokenTarget: target == null || climateState == null
            ? null
            : climateSpokenState(
                AppLocalizations.of(context)!,
                heating: climateState.isHeating,
                cooling: climateState.isCooling,
                target: target,
              ),
        climateMode: mode == null
            ? null
            : (
                label: modeInfo!.$1,
                icon: modeInfo.$2,
                semanticLabel: AppLocalizations.of(
                  context,
                )!.room_card_climate_mode(modeInfo.$1),
                on: mode != ClimateMode.off,
              ),
      );
    }).toList();

    setState(() {
      _model = RoomOverviewModel(
        icon: freshModel.icon,
        title: freshModel.title,
        domainCards: adjustedCards,
        quickScenes: freshModel.quickScenes,
        suggestedActions: freshModel.suggestedActions,
        sensorReadings: freshModel.sensorReadings,
        domainCounts: freshModel.domainCounts,
      );
    });
  }

  Future<void> _loadRoomData() async {
    if (_roomId.isEmpty) {
      setState(() {
        _isLoading = false;
        _errorMessage = AppLocalizations.of(context)!.room_overview_no_room;
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
          _errorMessage = AppLocalizations.of(
            context,
          )!.room_overview_display_not_configured;
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
        _errorMessage = AppLocalizations.of(context)!.room_overview_load_failed;
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
    _energyShowProduction =
        energyWidget.settings['show_production'] as bool? ?? true;

    final rangeStr = energyWidget.settings['range'] as String?;
    _energyRange = rangeStr != null
        ? EnergyRange.values.where((r) => r.value == rangeStr).firstOrNull ??
              EnergyRange.today
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
                if (classifyDeviceToDomain(device.category) ==
                    DomainType.shading) {
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

  void _setOptimistic(
    DomainType domain, {
    String? primaryValue,
    String? unit,
    bool? isActive,
    ClimateMode? climateMode,
    double? targetValue,
    String? target,
    int? shadingPosition,
    int? request,
  }) {
    _optimistic[domain] = _DomainOptimistic(
      primaryValue: primaryValue,
      unit: unit,
      isActive: isActive,
      climateMode: climateMode,
      targetValue: targetValue,
      target: target,
      shadingPosition: shadingPosition,
      request: request,
      createdAt: DateTime.now(),
    );
    _rebuildModel();
    _scheduleOptimisticCleanup();
  }

  void _clearConfirmedOverrides(RoomOverviewModel freshModel) {
    final toRemove = <DomainType>[];
    for (final entry in _optimistic.entries) {
      if (entry.value.isExpired) {
        toRemove.add(entry.key);
        continue;
      }
      final card = freshModel.domainCards
          .where((c) => c.domain == entry.key)
          .firstOrNull;
      if (card == null) continue;

      final override = entry.value;
      // Lights turned on show On until the room reports them on, with
      // whatever brightness it reports.
      final onlyOn =
          entry.key == DomainType.lights &&
          override.isActive == true &&
          override.unit == null;
      final primaryMatches =
          override.primaryValue == null ||
          (onlyOn && card.isActive) ||
          (card.primaryValue == override.primaryValue &&
              card.unit == override.unit);
      final activeMatches =
          override.isActive == null || card.isActive == override.isActive;

      // For climate mode overrides, also check the mode button label
      var modeMatches = true;
      if (override.climateMode != null &&
          card.domain == DomainType.climate &&
          card.actions.isNotEmpty) {
        final (expectedLabel, _) = _climateModeInfo(override.climateMode!);
        modeMatches = card.actions[0].label == expectedLabel;
      }

      final targetMatches =
          override.target == null || card.target == override.target;

      if (primaryMatches && activeMatches && modeMatches && targetMatches) {
        toRemove.add(entry.key);
      }
    }
    for (final domain in toRemove) {
      _optimistic.remove(domain);
    }
  }

  void _scheduleOptimisticCleanup() {
    _optimisticCleanupTimer?.cancel();
    _optimisticCleanupTimer = Timer(const Duration(seconds: 6), () {
      if (!mounted) return;
      _optimistic.removeWhere((_, v) => v.isExpired);
      if (mounted) _rebuildModel();
    });
  }

  (String, IconData) _climateModeInfo(ClimateMode mode) {
    final l = AppLocalizations.of(context)!;
    switch (mode) {
      case ClimateMode.heat:
        return (l.thermostat_mode_heat, MdiIcons.fire);
      case ClimateMode.cool:
        return (l.thermostat_mode_cool, MdiIcons.snowflake);
      case ClimateMode.auto:
        return (l.thermostat_mode_auto, MdiIcons.autorenew);
      case ClimateMode.off:
        return (l.thermostat_mode_off, MdiIcons.power);
    }
  }

  DomainType? _domainForAction(QuickActionType type) {
    switch (type) {
      case QuickActionType.lightsOff:
      case QuickActionType.lightsOn:
      case QuickActionType.lightsHalf:
      case QuickActionType.lightsFull:
        return DomainType.lights;
      case QuickActionType.climateMode:
      case QuickActionType.climateMinus:
      case QuickActionType.climatePlus:
        return DomainType.climate;
      case QuickActionType.coversClose:
      case QuickActionType.coversHalf:
      case QuickActionType.coversOpen:
        return DomainType.shading;
      default:
        return null;
    }
  }

  Future<void> _triggerScene(String sceneId) async {
    if (_isSceneTriggering) return;

    setState(() {
      _isSceneTriggering = true;
      _triggeringSceneId = sceneId;
    });

    try {
      final result = await _intentsService.activateScene(
        sceneId,
        localizations: AppLocalizations.of(context)!,
      );

      if (!mounted) return;

      setState(() {
        _isSceneTriggering = false;
        _triggeringSceneId = null;
      });

      final localizations = AppLocalizations.of(context)!;

      if (result.isSuccess) {
        Toast.showSuccess(
          context,
          message: localizations.space_scene_triggered,
        );
      } else if (result.isPartialSuccess) {
        Toast.showInfo(
          context,
          message: result.message ?? localizations.space_scene_partial_success,
        );
      } else {
        Toast.showError(
          context,
          message: result.message ?? localizations.action_failed,
        );
      }
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isSceneTriggering = false;
        _triggeringSceneId = null;
      });

      final localizations = AppLocalizations.of(context)!;
      Toast.showError(context, message: localizations.action_failed);
    }
  }

  Future<void> _showClimateModeSelect() async {
    final spacesService = _spacesService;
    if (spacesService == null) return;

    final l = AppLocalizations.of(context)!;
    final current =
        spacesService.getClimateState(_roomId)?.mode ?? ClimateMode.off;

    final mode = await showAppSelectionDialog<ClimateMode>(
      context: context,
      title: l.thermostat_mode_label,
      currentValue: current,
      options: [
        for (final mode in [
          ClimateMode.heat,
          ClimateMode.cool,
          ClimateMode.auto,
          ClimateMode.off,
        ])
          SelectionOption(value: mode, label: _climateModeInfo(mode).$1),
      ],
    );

    if (mode == null || mode == current || !mounted) return;

    _setOptimistic(
      DomainType.climate,
      isActive: mode != ClimateMode.off,
      climateMode: mode,
    );
    final result = await spacesService.setClimateMode(_roomId, mode);
    if (mounted) {
      IntentResultHandler.showOfflineAlertIfNeededForClimate(context, result);
    }
  }

  Future<void> _handleQuickAction(QuickActionType type) async {
    final spacesService = _spacesService;
    if (spacesService == null) return;

    final l = AppLocalizations.of(context)!;

    try {
      switch (type) {
        case QuickActionType.lightsOff:
          _setOptimistic(
            DomainType.lights,
            primaryValue: l.light_state_off,
            isActive: false,
          );
          final result = await spacesService.setLightingMode(
            _roomId,
            LightingMode.off,
          );
          if (mounted) {
            IntentResultHandler.showOfflineAlertIfNeeded(context, result);
          }
          break;
        case QuickActionType.lightsOn:
          // Every light in the room, as Off turns every light off; a room
          // may have no light in the main role.
          _setOptimistic(
            DomainType.lights,
            primaryValue: l.light_state_on,
            isActive: true,
          );
          final result = await spacesService.turnLightsOn(_roomId);
          if (mounted) {
            IntentResultHandler.showOfflineAlertIfNeeded(context, result);
          }
          break;
        case QuickActionType.lightsHalf:
        case QuickActionType.lightsFull:
          final brightness = type == QuickActionType.lightsFull ? 100 : 50;
          _setOptimistic(
            DomainType.lights,
            primaryValue: '$brightness',
            unit: ' %',
            isActive: true,
          );
          await spacesService.turnRoleOn(_roomId, LightingStateRole.main);
          final result = await spacesService.setRoleBrightness(
            _roomId,
            LightingStateRole.main,
            brightness,
          );
          if (mounted) {
            IntentResultHandler.showOfflineAlertIfNeeded(context, result);
          }
          break;
        case QuickActionType.climateMode:
          _showClimateModeSelect();
          break;
        case QuickActionType.climateMinus:
        case QuickActionType.climatePlus:
          final cs = spacesService.getClimateState(_roomId);
          if (cs == null) return;
          // A mode still on its way counts: its setpoint is the one to
          // step, and repeated taps step from the target already sent.
          final pending = _optimistic[DomainType.climate];
          final live = pending != null && !pending.isExpired ? pending : null;
          final mode = live?.climateMode ?? cs.mode ?? ClimateMode.heat;
          final target = live?.targetValue ?? cs.targetFor(mode);
          if (target == null) return;
          final newTarget = type == QuickActionType.climatePlus
              ? target + 1.0
              : target - 1.0;
          final clamped = newTarget.clamp(cs.minSetpoint, cs.maxSetpoint);
          final request = ++_climateRequest;
          // The card shows the new target at once, keeping a pending mode
          // and on/off state; the room temperature stays as measured.
          _setOptimistic(
            DomainType.climate,
            isActive: live?.isActive,
            climateMode: live?.climateMode,
            targetValue: clamped,
            target: climateTargetDegrees(
              clamped,
              DisplayUnits.fromLocator().temperature,
            ),
            request: request,
          );
          final result = await spacesService.setSetpoint(
            _roomId,
            clamped,
            mode: mode,
          );
          if (!mounted) return;

          final failed = result == null || !result.success;
          // A failed request puts back what was pending before it, unless
          // a newer tap has replaced it since.
          if (failed && _optimistic[DomainType.climate]?.request == request) {
            if (live != null && !live.isExpired) {
              _optimistic[DomainType.climate] = live;
            } else {
              _optimistic.remove(DomainType.climate);
            }
            _rebuildModel();
          }
          final alerted =
              IntentResultHandler.showOfflineAlertIfNeededForClimate(
                context,
                result,
              );
          if (failed && !alerted) {
            Toast.showError(context, message: l.room_overview_action_failed);
          }
          break;
        case QuickActionType.coversClose:
          _setOptimistic(
            DomainType.shading,
            primaryValue: '0',
            unit: ' %',
            isActive: false,
            shadingPosition: 0,
          );
          final result = await spacesService.setCoversMode(
            _roomId,
            CoversMode.closed,
          );
          if (mounted) {
            IntentResultHandler.showOfflineAlertIfNeededForCovers(
              context,
              result,
            );
          }
          break;
        case QuickActionType.coversHalf:
          _setOptimistic(
            DomainType.shading,
            primaryValue: '50',
            unit: ' %',
            isActive: true,
            shadingPosition: 50,
          );
          final result = await spacesService.setCoversPosition(_roomId, 50);
          if (mounted) {
            IntentResultHandler.showOfflineAlertIfNeededForCovers(
              context,
              result,
            );
          }
          break;
        case QuickActionType.coversOpen:
          _setOptimistic(
            DomainType.shading,
            primaryValue: '100',
            unit: ' %',
            isActive: true,
            shadingPosition: 100,
          );
          final result = await spacesService.setCoversMode(
            _roomId,
            CoversMode.open,
          );
          if (mounted) {
            IntentResultHandler.showOfflineAlertIfNeededForCovers(
              context,
              result,
            );
          }
          break;
        case QuickActionType.mediaPlay:
        case QuickActionType.mediaPause:
        case QuickActionType.mediaStop:
          _sendMediaPlaybackCommand(type);
          break;
      }
    } catch (e) {
      if (mounted) {
        final domain = _domainForAction(type);
        if (domain != null) {
          _optimistic.remove(domain);
          _rebuildModel();
        }
        Toast.showError(context, message: l.room_overview_action_failed);
      }
    }
  }

  void _sendMediaPlaybackCommand(QuickActionType type) {
    final devicesService = _devicesService;
    if (devicesService == null) return;

    final command = switch (type) {
      QuickActionType.mediaPlay => 'play',
      QuickActionType.mediaPause => 'pause',
      QuickActionType.mediaStop => 'stop',
      _ => null,
    };
    if (command == null) return;

    final devices = devicesService.getDevicesForRoom(_roomId);
    for (final device in devices) {
      if (device is! DeviceMediaPlaybackMixin) continue;
      final playback = device as DeviceMediaPlaybackMixin;
      final channel = playback.mediaPlaybackChannel;
      if (channel == null || !channel.hasCommand) continue;

      devicesService.setPropertyValueWithContext(
        deviceId: device.id,
        channelId: channel.id,
        propertyId: channel.commandProp!.id,
        value: command,
      );
    }
  }

  // ===========================================================================
  // BUILD
  // ===========================================================================

  void _openWeather() {
    final weatherLocationId = locator<DisplayRepository>().weatherLocationId;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => WeatherDetailPage(locationId: weatherLocationId),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final model = _model;
    final error = _errorMessage;

    return ListenableBuilder(
      listenable: locator<ScreenService>(),
      builder: (context, _) => RoomModeScope(
        spaceId: _roomId,
        builder: (context, modes) => RoomOverviewLayout(
          skyBuilder:
              (
                context, {
                required landscape,
                required sizeClass,
                readings,
                footer,
              }) => SkyPanel(
                landscape: landscape,
                sizeClass: sizeClass,
                readings: readings,
                onWeatherTap: _openWeather,
                footer: footer,
              ),
          body: _isLoading
              ? RoomOverviewBody.loading
              : error != null
              ? RoomOverviewBody.error
              : RoomOverviewBody.ready,
          errorTitle: error == l.room_overview_load_failed ? null : error,
          spaceId: _roomId,
          roomIcon: model?.icon,
          cards: model?.domainCards ?? const [],
          scenes: model?.quickScenes ?? const [],
          readings: model?.sensorReadings ?? const [],
          energyPill: _showEnergyPill
              ? RoomEnergyPill(
                  spaceId: _roomId,
                  range: _energyRange,
                  showProduction: _energyShowProduction,
                  onTap: _navigateToEnergyView,
                )
              : null,
          modes: modes,
          notSetUp: model == null || !model.hasAnyDomain,
          onRetry: _loadRoomData,
          onOpenDomain: _navigateToDomainView,
          onAction: _handleQuickAction,
          onScene: _triggerScene,
          runningSceneId: _triggeringSceneId,
        ),
      ),
    );
  }
}
