// Energy domain view: space-level energy consumption, production, and breakdown.
//
// **Purpose:** Shows aggregated energy data for the current space/room:
// summary cards (consumption/production/net), a timeseries bar chart,
// and a top-consumers list. Supports range switching (today/week/month).
//
// **Data flow:**
// - [EnergyService] fetches data from `/api/energy/spaces/:spaceId/*` endpoints.
// - Local state: summary, timeseries, breakdown, selected range, loading/error.
// - Uses [DomainStateView] for loading/error states.
//
// **For AI:** When modifying this file:
// - Keep layout logic in _buildPortraitLayout / _buildLandscapeLayout.
// - Chart X-axis labels use localized day names via _getShortDayName.
// - Top consumers: [DeckItemSheet] (portrait) vs [DeckItemDrawer] (landscape).
// - Range switching is driven by [BottomNavModeNotifier] + [DeckPageActivatedEvent].
//
// **File structure:**
// - ENERGY DOMAIN VIEW PAGE (state, lifecycle, data loading, build)
// - HEADER
// - PORTRAIT LAYOUT
// - LANDSCAPE LAYOUT
// - TOP CONSUMERS (sheet / drawer)
// - EMPTY STATE

import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/base_card.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/services/room_domain_classifier.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_drawer.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_chip.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_page_activated_event.dart';
import 'package:fastybird_smart_panel/modules/energy/export.dart';
import 'package:fastybird_smart_panel/modules/energy/presentation/widgets/energy_consumption_card.dart';
import 'package:fastybird_smart_panel/modules/energy/presentation/widgets/energy_consumer_tile.dart';
import 'package:fastybird_smart_panel/modules/energy/presentation/widgets/energy_range_options.dart';
import 'package:fastybird_smart_panel/modules/energy/presentation/widgets/energy_timeseries_chart.dart';
import 'package:fastybird_smart_panel/modules/energy/utils/energy_format.dart';

// =============================================================================
// CONSTANTS
// =============================================================================

/// Max number of devices shown in the top consumers list.
const int _breakdownLimit = 10;

// =============================================================================
// ENERGY DOMAIN VIEW PAGE
// =============================================================================

/// Energy domain page for a room: consumption, production, chart, top consumers.
///
/// Shown when the deck navigates to the energy domain for a space.
/// Uses [DomainStateView] for loading/error/retry; [EnergyService] for API.
class EnergyDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const EnergyDomainViewPage({super.key, required this.viewItem});

  @override
  State<EnergyDomainViewPage> createState() => _EnergyDomainViewPageState();
}

class _EnergyDomainViewPageState extends State<EnergyDomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();

  // Loading state (replaces DomainDataLoader mixin)
  DomainLoadState _loadState = DomainLoadState.loading;
  String? _errorMessage;

  DomainLoadState get loadState => _loadState;
  String? get errorMessage => _errorMessage;

  // Services & event bus
  EnergyService? _energyService;
  DevicesService? _devicesServiceRef;
  EventBus? _eventBus;
  BottomNavModeNotifier? _bottomNavModeNotifier;
  StreamSubscription<DeckPageActivatedEvent>? _pageActivatedSubscription;
  bool _isActivePage = false;

  // Range selection (today/week/month)
  EnergyRange _selectedRange = EnergyRange.today;
  bool _isRangeChangeInFlight = false;
  int _lastEnergyDeviceCount = -1;

  // Loaded data
  EnergySummary? _summary;
  EnergyTimeseries? _timeseries;
  EnergyBreakdown? _breakdown;

  String get _roomId => widget.viewItem.roomId;

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();

    try {
      _energyService = locator<EnergyService>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[EnergyDomainViewPage] EnergyService not available: $e');
      }
    }

    if (locator.isRegistered<EventBus>()) {
      _eventBus = locator<EventBus>();
    }
    if (locator.isRegistered<BottomNavModeNotifier>()) {
      _bottomNavModeNotifier = locator<BottomNavModeNotifier>();
    }
    if (locator.isRegistered<DevicesService>()) {
      _devicesServiceRef = locator<DevicesService>();
      // Seed count so first _onDevicesChanged only fires on actual change
      final devices = _devicesServiceRef?.getDevicesForRoom(_roomId) ?? [];
      _lastEnergyDeviceCount = countEnergyDevices(devices);
      _devicesServiceRef?.addListener(_onDevicesChanged);
    }

    _pageActivatedSubscription =
        _eventBus?.on<DeckPageActivatedEvent>().listen(_onPageActivated);

    _loadEnergyData().then((_) {
      if (mounted) _registerRangeModeConfig();
    });
  }

  @override
  void dispose() {
    _pageActivatedSubscription?.cancel();
    _devicesServiceRef?.removeListener(_onDevicesChanged);
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────────────────

  /// Loads energy data: skips fetch when cached, otherwise fetches and updates
  /// load state accordingly.
  Future<void> _loadEnergyData() async {
    if (_summary != null) {
      if (mounted) {
        setState(() {
          _loadState = DomainLoadState.loaded;
        });
      }
      return;
    }

    try {
      await _fetchAllData();
      if (mounted) {
        setState(() {
          _loadState = _summary == null
              ? DomainLoadState.empty
              : DomainLoadState.loaded;
        });
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[EnergyDomainViewPage] Failed to fetch data: $e');
      }
      if (mounted) {
        setState(() {
          _loadState = DomainLoadState.error;
          _errorMessage = e.toString();
        });
      }
    }
  }

  /// Retry loading after an error.
  Future<void> _retryLoad() async {
    if (mounted) {
      setState(() {
        _loadState = DomainLoadState.loading;
        _errorMessage = null;
      });
    }
    await _loadEnergyData();
  }

  /// Fetches summary, timeseries, and breakdown in parallel for current range.
  Future<void> _fetchAllData() async {
    if (_energyService == null) {
      throw Exception('EnergyService not available');
    }

    final results = await Future.wait([
      _energyService!.fetchSummary(_roomId, _selectedRange),
      _energyService!.fetchTimeseries(_roomId, _selectedRange),
      _energyService!.fetchBreakdown(
        _roomId,
        _selectedRange,
        limit: _breakdownLimit,
      ),
    ]);

    _summary = results[0] as EnergySummary?;
    _timeseries = results[1] as EnergyTimeseries?;
    _breakdown = results[2] as EnergyBreakdown?;
  }

  /// Handles range change from bottom nav popup; refetches all data.
  Future<void> _onRangeChanged(EnergyRange range) async {
    if (range == _selectedRange || _isRangeChangeInFlight) return;

    _isRangeChangeInFlight = true;

    setState(() {
      _selectedRange = range;
      _summary = null;
      _timeseries = null;
      _breakdown = null;
      _loadState = DomainLoadState.loading;
    });

    try {
      await _loadEnergyData();
    } finally {
      _isRangeChangeInFlight = false;
      if (mounted) _registerRangeModeConfig();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BOTTOM NAV MODE REGISTRATION (range selector in bottom bar)
  // ─────────────────────────────────────────────────────────────────────────

  /// Updates bottom nav chip when this page becomes active.
  void _onPageActivated(DeckPageActivatedEvent event) {
    if (!mounted) return;
    _isActivePage = event.itemId == widget.viewItem.id;

    if (_isActivePage) {
      _registerRangeModeConfig();
    }
  }

  /// Called when DevicesService notifies (device changes via WebSocket).
  ///
  /// Only re-fetches when the energy device count for this room changes,
  /// avoiding unnecessary HTTP calls on unrelated device property updates.
  void _onDevicesChanged() {
    if (!mounted) return;

    // Check if energy device count changed (cheap, sync read from cache)
    final devices = _devicesServiceRef?.getDevicesForRoom(_roomId) ?? [];
    final newCount = countEnergyDevices(devices);
    if (newCount == _lastEnergyDeviceCount) return;
    _lastEnergyDeviceCount = newCount;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Clear cached data and show loading state so _loadEnergyData will fetch fresh
      setState(() {
        _summary = null;
        _timeseries = null;
        _breakdown = null;
        _loadState = DomainLoadState.loading;
      });
      _loadEnergyData().then((_) {
        if (mounted) _registerRangeModeConfig();
      });
    });
  }

  /// Registers today/week/month range selector in bottom nav chip.
  void _registerRangeModeConfig() {
    if (!_isActivePage) return;

    if (_summary == null) {
      _bottomNavModeNotifier?.clear();
      return;
    }

    final localizations = AppLocalizations.of(context)!;
    final rangeOptions = getEnergyRangeOptions(localizations);
    final currentOption = rangeOptions.firstWhere(
      (o) => o.value == _selectedRange,
      orElse: () => rangeOptions.first,
    );

    _bottomNavModeNotifier?.setConfig(BottomNavModeConfig(
      icon: currentOption.icon,
      label: currentOption.label,
      color: ThemeColors.info,
      popupBuilder: (context, dismiss) {
        return EnergyRangeOptionsList(
          selectedRange: _selectedRange,
          onSelected: (range) {
            _onRangeChanged(range);
            dismiss();
          },
          rangeOptions: getEnergyRangeOptions(
            AppLocalizations.of(context)!,
          ),
        );
      },
    ));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    if (loadState != DomainLoadState.loaded &&
        loadState != DomainLoadState.empty) {
      return DomainStateView(
        state: loadState,
        onRetry: _retryLoad,
        domainName: localizations.domain_energy,
        child: const SizedBox.shrink(),
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            Expanded(
              child: _summary == null
                  ? DomainStateView(
                      state: DomainLoadState.notConfigured,
                      onRetry: _retryLoad,
                      domainName: localizations.domain_energy,
                      notConfiguredIcon: MdiIcons.flashOff,
                      notConfiguredTitle: localizations.energy_empty_title,
                      notConfiguredDescription: localizations.energy_empty_description,
                      child: const SizedBox.shrink(),
                    )
                  : OrientationBuilder(
                      builder: (context, orientation) {
                        return orientation == Orientation.landscape
                            ? _buildLandscapeLayout(context)
                            : _buildPortraitLayout(context);
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  // =============================================================================
  // HEADER
  // =============================================================================

  /// Page header with title, consumption subtitle, and optional top-consumers icon.
  Widget _buildHeader(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final infoFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.info,
    );

    String subtitle;
    if (_summary != null) {
      final consumption = NumberFormatUtils.defaultFormat.formatDecimal(
        _summary!.consumption,
        decimalPlaces:
            energyDecimals(_summary!.consumption),
      );
      subtitle = '$consumption ${localizations.energy_unit_kwh}';
      if (_summary!.hasProduction) {
        final production = NumberFormatUtils.defaultFormat.formatDecimal(
          _summary!.production!,
          decimalPlaces:
              energyDecimals(_summary!.production!),
        );
        subtitle +=
            ' / $production ${localizations.energy_unit_kwh} ${localizations.energy_production.toLowerCase()}';
      }
    } else {
      subtitle = localizations.energy_empty_title;
    }

    return PageHeader(
      title: localizations.domain_energy,
      subtitle: subtitle,
      subtitleColor: _summary != null ? infoFamily.base : null,
      leading: HeaderMainIcon(
        icon: MdiIcons.flashOutline,
        color: ThemeColors.info,
      ),
      landscapeAction: const DeckModeChip(),
      trailing: _breakdown != null && _breakdown!.isNotEmpty
          ? HeaderIconButton(
              icon: MdiIcons.podium,
              color: ThemeColors.info,
              onTap: () => _showTopConsumers(context),
            )
          : null,
    );
  }

  // =============================================================================
  // PORTRAIT LAYOUT
  // =============================================================================

  /// Portrait: consumption card on top, chart below.
  Widget _buildPortraitLayout(BuildContext context) {
    return PortraitViewLayout(
      scrollable: false,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: AppSpacings.pMd,
        children: [
          EnergyConsumptionCard(
            summary: _summary!,
            selectedRange: _selectedRange,
          ),
          if (_timeseries != null && _timeseries!.isNotEmpty)
            Expanded(
              child: EnergyTimeseriesChart(
                timeseries: _timeseries!,
                selectedRange: _selectedRange,
              ),
            ),
        ],
      ),
    );
  }

  // =============================================================================
  // LANDSCAPE LAYOUT
  // =============================================================================

  /// Landscape: chart on left, consumption + production cards on right.
  Widget _buildLandscapeLayout(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final brightness = isDark ? Brightness.dark : Brightness.light;
    final successFamily = ThemeColorFamily.get(brightness, ThemeColors.success);
    final warningFamily = ThemeColorFamily.get(brightness, ThemeColors.warning);

    return LandscapeViewLayout(
      mainContentPadding: EdgeInsets.only(
        right: AppSpacings.pMd,
        left: AppSpacings.pMd,
        bottom: AppSpacings.pMd,
      ),
      mainContent: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pLg,
        children: [
          if (_timeseries != null && _timeseries!.isNotEmpty)
            Expanded(
              child: EnergyTimeseriesChart(
                timeseries: _timeseries!,
                selectedRange: _selectedRange,
              ),
            ),
        ],
      ),
      additionalContentScrollable: false,
      additionalContentPadding: EdgeInsets.only(
        left: AppSpacings.pMd,
        bottom: AppSpacings.pMd,
      ),
      additionalContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: AppSpacings.pMd,
        children: [
          Expanded(
            child: EnergyConsumptionCard(
              summary: _summary!,
              selectedRange: _selectedRange,
            ),
          ),
          if (_summary!.hasProduction) ...[
            BaseCard(
              child: EnergySecondaryValue(
                icon: MdiIcons.solarPower,
                label: localizations.energy_production,
                value: NumberFormatUtils.defaultFormat.formatDecimal(
                  _summary!.production!,
                  decimalPlaces: energyDecimals(_summary!.production!),
                ),
                unit: localizations.energy_unit_kwh,
                colorFamily: successFamily,
              ),
            ),
            if (_summary!.net != null)
              BaseCard(
                child: EnergySecondaryValue(
                  icon: MdiIcons.swapVertical,
                  label: localizations.energy_net,
                  value: NumberFormatUtils.defaultFormat.formatDecimal(
                    _summary!.net!,
                    decimalPlaces: energyDecimals(_summary!.net!),
                  ),
                  unit: localizations.energy_unit_kwh,
                  colorFamily:
                      _summary!.net! > 0 ? warningFamily : successFamily,
                ),
              ),
          ],
        ],
      ),
    );
  }

  // =============================================================================
  // TOP CONSUMERS (SHEET / DRAWER)
  // =============================================================================

  /// Opens top consumers: bottom sheet (portrait) or right drawer (landscape).
  void _showTopConsumers(BuildContext context) {
    if (_breakdown == null || _breakdown!.isEmpty) return;

    final localizations = AppLocalizations.of(context)!;
    final isLandscape = _screenService.isLandscape;
    final devices = _breakdown!.devices;
    final maxConsumption = devices
        .map((d) => d.consumption)
        .reduce((a, b) => a > b ? a : b);

    if (isLandscape) {
      DeckItemDrawer.showItemDrawer(
        context,
        title: localizations.energy_top_consumers,
        icon: MdiIcons.podium,
        itemCount: devices.length,
        itemBuilder: (context, index) => EnergyConsumerTile(
          device: devices[index],
          maxConsumption: maxConsumption,
        ),
      );
    } else {
      DeckItemSheet.showItemSheet(
        context,
        title: localizations.energy_top_consumers,
        icon: MdiIcons.podium,
        itemCount: devices.length,
        itemBuilder: (context, index) => EnergyConsumerTile(
          device: devices[index],
          maxConsumption: maxConsumption,
        ),
      );
    }
  }
}
