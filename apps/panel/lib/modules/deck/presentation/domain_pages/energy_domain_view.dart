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
// - Top consumers: [DeckItemSheet] (portrait) vs [showAppRightDrawer] (landscape).
// - Range switching is driven by [BottomNavModeNotifier] + [DeckPageActivatedEvent].
//
// **File structure:**
// - CONSTANTS
// - ENERGY DOMAIN VIEW PAGE (state, lifecycle, data loading, build)
// - HEADER
// - PORTRAIT LAYOUT
// - LANDSCAPE LAYOUT
// - SUMMARY CARDS (consumption hero, secondary values, comparison)
// - TIMESERIES CHART
// - TOP CONSUMERS (sheet / drawer)
// - EMPTY STATE

import 'dart:async';
import 'dart:math';

import 'package:event_bus/event_bus.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_card.dart';
import 'package:fastybird_smart_panel/core/widgets/app_right_drawer.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_chip.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/domain_data_loader.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_page_activated_event.dart';
import 'package:fastybird_smart_panel/modules/energy/export.dart';

// =============================================================================
// CONSTANTS
// =============================================================================

/// Constants and helpers for the energy domain view.
class _EnergyViewConstants {
  /// Max number of devices shown in the top consumers list.
  static const int breakdownLimit = 10;

  /// Adaptive decimal places for energy values so large numbers stay compact.
  static int energyDecimals(double value) {
    final abs = value.abs();
    if (abs >= 100) return 0;
    if (abs >= 10) return 1;
    return 2;
  }
}

// =============================================================================
// ENERGY DOMAIN VIEW PAGE
// =============================================================================

/// Energy domain page for a room: consumption, production, chart, top consumers.
///
/// Shown when the deck navigates to the energy domain for a space.
/// Uses [DomainDataLoader] for loading/error/retry; [EnergyService] for API.
class EnergyDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const EnergyDomainViewPage({super.key, required this.viewItem});

  @override
  State<EnergyDomainViewPage> createState() => _EnergyDomainViewPageState();
}

class _EnergyDomainViewPageState extends State<EnergyDomainViewPage>
    with DomainDataLoader<EnergyDomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();

  // Services & event bus
  EnergyService? _energyService;
  EventBus? _eventBus;
  BottomNavModeNotifier? _bottomNavModeNotifier;
  StreamSubscription<DeckPageActivatedEvent>? _pageActivatedSubscription;
  bool _isActivePage = false;

  // Range selection (today/week/month)
  EnergyRange _selectedRange = EnergyRange.today;
  bool _isRangeChangeInFlight = false;

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

    _pageActivatedSubscription =
        _eventBus?.on<DeckPageActivatedEvent>().listen(_onPageActivated);

    loadDomainData().then((_) {
      if (mounted) _registerRangeModeConfig();
    });
  }

  @override
  void dispose() {
    _pageActivatedSubscription?.cancel();
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOMAIN DATA LOADER
  // ─────────────────────────────────────────────────────────────────────────

  @override
  bool hasExistingData() => _summary != null;

  @override
  Future<void> fetchData() async {
    await _fetchAllData();
  }

  @override
  bool isDataEmpty() => _summary == null;

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
        limit: _EnergyViewConstants.breakdownLimit,
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
      // Clear stale data so hasExistingData() returns false
      // and loadDomainData() will call fetchData() for the new range
      _summary = null;
      _timeseries = null;
      _breakdown = null;
    });

    setLoadState(DomainLoadState.loading);

    try {
      await loadDomainData();
    } finally {
      _isRangeChangeInFlight = false;
      _registerRangeModeConfig();
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

  /// Registers today/week/month range selector in bottom nav chip.
  void _registerRangeModeConfig() {
    if (!_isActivePage || _summary == null) {
      _bottomNavModeNotifier?.clear();
      return;
    }

    final localizations = AppLocalizations.of(context)!;
    final rangeOptions = _getRangeOptions(localizations);
    final currentOption = rangeOptions.firstWhere(
      (o) => o.value == _selectedRange,
      orElse: () => rangeOptions.first,
    );

    _bottomNavModeNotifier?.setConfig(BottomNavModeConfig(
      icon: currentOption.icon,
      label: currentOption.label,
      color: ThemeColors.info,
      popupBuilder: _buildRangePopupContent,
    ));
  }

  /// Options for today/week/month range selector in bottom nav popup.
  List<ModeOption<EnergyRange>> _getRangeOptions(
    AppLocalizations localizations,
  ) {
    return [
      ModeOption(
        value: EnergyRange.today,
        icon: MdiIcons.calendarToday,
        label: localizations.energy_range_today,
      ),
      ModeOption(
        value: EnergyRange.week,
        icon: MdiIcons.calendarWeek,
        label: localizations.energy_range_week,
      ),
      ModeOption(
        value: EnergyRange.month,
        icon: MdiIcons.calendarMonth,
        label: localizations.energy_range_month,
      ),
    ];
  }

  /// Popup content for range selector (today/week/month) in bottom nav.
  Widget _buildRangePopupContent(BuildContext context, VoidCallback dismiss) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final rangeOptions = _getRangeOptions(localizations);
    final infoFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.info,
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(bottom: AppSpacings.pSm),
          child: Text(
            localizations.popup_label_mode.toUpperCase(),
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w600,
              letterSpacing: AppSpacings.scale(1),
              color: isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder,
            ),
          ),
        ),
        for (final option in rangeOptions)
          GestureDetector(
            onTap: () {
              _onRangeChanged(option.value);
              dismiss();
            },
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: EdgeInsets.symmetric(
                vertical: AppSpacings.pMd,
                horizontal: AppSpacings.pMd,
              ),
              margin: EdgeInsets.only(bottom: AppSpacings.pXs),
              decoration: BoxDecoration(
                color: option.value == _selectedRange
                    ? infoFamily.light9
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(AppBorderRadius.small),
                border: option.value == _selectedRange
                    ? Border.all(
                        color: infoFamily.light7,
                        width: AppSpacings.scale(1),
                      )
                    : null,
              ),
              child: Row(
                spacing: AppSpacings.pMd,
                children: [
                  Icon(
                    option.icon,
                    color: option.value == _selectedRange
                        ? infoFamily.base
                        : (isDark
                            ? AppTextColorDark.secondary
                            : AppTextColorLight.secondary),
                    size: AppSpacings.scale(20),
                  ),
                  Expanded(
                    child: Text(
                      option.label,
                      style: TextStyle(
                        fontSize: AppFontSize.base,
                        fontWeight: option.value == _selectedRange
                            ? FontWeight.w600
                            : FontWeight.w400,
                        color: option.value == _selectedRange
                            ? infoFamily.base
                            : (isDark
                                ? AppTextColorDark.regular
                                : AppTextColorLight.regular),
                      ),
                    ),
                  ),
                  if (option.value == _selectedRange)
                    Icon(
                      Icons.check,
                      color: infoFamily.base,
                      size: AppSpacings.scale(16),
                    ),
                ],
              ),
            ),
          ),
      ],
    );
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
        onRetry: retryLoad,
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
                  ? _buildEmptyState(context)
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
            _EnergyViewConstants.energyDecimals(_summary!.consumption),
      );
      subtitle = '$consumption ${localizations.energy_unit_kwh}';
      if (_summary!.hasProduction) {
        final production = NumberFormatUtils.defaultFormat.formatDecimal(
          _summary!.production!,
          decimalPlaces:
              _EnergyViewConstants.energyDecimals(_summary!.production!),
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
        spacing: AppSpacings.pSm,
        children: [
          _buildConsumptionCard(context),
          if (_timeseries != null && _timeseries!.isNotEmpty)
            Expanded(child: _buildTimeseriesChart(context)),
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
            Expanded(child: _buildTimeseriesChart(context)),
        ],
      ),
      additionalContentScrollable: false,
      additionalContentPadding: EdgeInsets.only(
        left: AppSpacings.pMd,
        bottom: AppSpacings.pMd,
      ),
      additionalContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: AppSpacings.pSm,
        children: [
          Expanded(child: _buildConsumptionCard(context)),
          if (_summary!.hasProduction) ...[
            AppCard(
              child: _buildSecondaryValue(
                icon: MdiIcons.solarPower,
                label: localizations.energy_production,
                value: NumberFormatUtils.defaultFormat.formatDecimal(
                  _summary!.production!,
                  decimalPlaces: _EnergyViewConstants.energyDecimals(
                      _summary!.production!),
                ),
                unit: localizations.energy_unit_kwh,
                colorFamily: successFamily,
              ),
            ),
            if (_summary!.net != null)
              AppCard(
                child: _buildSecondaryValue(
                  icon: MdiIcons.swapVertical,
                  label: localizations.energy_net,
                  value: NumberFormatUtils.defaultFormat.formatDecimal(
                    _summary!.net!,
                    decimalPlaces:
                        _EnergyViewConstants.energyDecimals(_summary!.net!),
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
  // SUMMARY CARDS
  // =============================================================================

  /// Hero card with main consumption value, optional production/net, comparison.
  Widget _buildConsumptionCard(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final brightness = isDark ? Brightness.dark : Brightness.light;
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;
    final infoFamily = ThemeColorFamily.get(brightness, ThemeColors.info);
    final successFamily = ThemeColorFamily.get(brightness, ThemeColors.success);
    final warningFamily = ThemeColorFamily.get(brightness, ThemeColors.warning);

    final rangeIcon = switch (_selectedRange) {
      EnergyRange.today => MdiIcons.calendarToday,
      EnergyRange.week => MdiIcons.calendarWeek,
      EnergyRange.month => MdiIcons.calendarMonth,
    };
    final rangeLabel = switch (_selectedRange) {
      EnergyRange.today => localizations.energy_range_today,
      EnergyRange.week => localizations.energy_range_week,
      EnergyRange.month => localizations.energy_range_month,
    };

    return HeroCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: AppSpacings.pSm,
        children: [
          // Hero row: badge (portrait only) + giant value
          LayoutBuilder(
            builder: (context, constraints) {
              final isCompactFont = _screenService.isPortrait
                  ? _screenService.isSmallScreen
                  : _screenService.isSmallScreen ||
                      _screenService.isMediumScreen;
              final fontSize = isCompactFont
                  ? (constraints.maxWidth * 0.18).clamp(
                      AppSpacings.scale(32),
                      AppSpacings.scale(96),
                    )
                  : (constraints.maxWidth * 0.22).clamp(
                      AppSpacings.scale(32),
                      AppSpacings.scale(96),
                    );
              final unitFontSize = fontSize * 0.27;
              final textColor =
                  isDark ? AppTextColorDark.regular : AppTextColorLight.regular;
              final unitColor = isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder;
              final badgeFontSize =
                  isCompactFont ? AppFontSize.small : AppFontSize.base;

              return Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  // Badge pill (portrait only)
                  if (!isLandscape) ...[
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: AppSpacings.pMd,
                        vertical: AppSpacings.pXs,
                      ),
                      height: AppSpacings.scale(24),
                      decoration: BoxDecoration(
                        color: infoFamily.light9,
                        borderRadius: BorderRadius.circular(
                          AppBorderRadius.round,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            rangeIcon,
                            size: badgeFontSize,
                            color: infoFamily.base,
                          ),
                          AppSpacings.spacingSmHorizontal,
                          Text(
                            rangeLabel.toUpperCase(),
                            style: TextStyle(
                              fontSize: badgeFontSize,
                              fontWeight: FontWeight.w700,
                              color: infoFamily.base,
                              letterSpacing: AppSpacings.scale(0.3),
                            ),
                          ),
                        ],
                      ),
                    ),
                    AppSpacings.spacingSmHorizontal,
                  ],
                  // Giant value
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Text(
                        NumberFormatUtils.defaultFormat.formatDecimal(
                          _summary!.consumption,
                          decimalPlaces: _EnergyViewConstants.energyDecimals(
                              _summary!.consumption),
                        ),
                        style: TextStyle(
                          fontSize: fontSize,
                          fontWeight: FontWeight.w200,
                          fontFamily: 'DIN1451',
                          color: textColor,
                          height: 0.7,
                        ),
                      ),
                      Positioned(
                        top: 0,
                        right: -unitFontSize * 2.25,
                        child: Text(
                          localizations.energy_unit_kwh,
                          style: TextStyle(
                            fontSize: unitFontSize,
                            fontWeight: FontWeight.w300,
                            color: unitColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
          AppSpacings.spacingSmVertical,
          // Description text
          Text(
            switch (_selectedRange) {
              EnergyRange.today => localizations.energy_consumed_today,
              EnergyRange.week => localizations.energy_consumed_week,
              EnergyRange.month => localizations.energy_consumed_month,
            },
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: AppFontSize.small,
              fontWeight: FontWeight.w400,
              color: isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder,
            ),
          ),
          // Production & Net row (portrait only, landscape has separate cards)
          if (!isLandscape && _summary!.hasProduction) ...[
            AppSpacings.spacingXsVertical,
            IntrinsicHeight(
              child: Row(
                spacing: AppSpacings.pSm,
                children: [
                  // Production
                  Expanded(
                    child: _buildSecondaryValue(
                      icon: MdiIcons.solarPower,
                      label: localizations.energy_production,
                      value: NumberFormatUtils.defaultFormat.formatDecimal(
                        _summary!.production!,
                        decimalPlaces: _EnergyViewConstants.energyDecimals(
                            _summary!.production!),
                      ),
                      unit: localizations.energy_unit_kwh,
                      colorFamily: successFamily,
                    ),
                  ),
                  // Net
                  if (_summary!.net != null)
                    Expanded(
                      child: _buildSecondaryValue(
                        icon: MdiIcons.swapVertical,
                        label: localizations.energy_net,
                        value: NumberFormatUtils.defaultFormat.formatDecimal(
                          _summary!.net!,
                          decimalPlaces: _EnergyViewConstants.energyDecimals(
                              _summary!.net!),
                        ),
                        unit: localizations.energy_unit_kwh,
                        colorFamily:
                            _summary!.net! > 0 ? warningFamily : successFamily,
                      ),
                    ),
                ],
              ),
            ),
          ],
          // Comparison status
          if (_summary!.hasConsumptionComparison) ...[
            AppSpacings.spacingSmVertical,
            _buildComparisonStatus(
              context,
              changePercent: _summary!.consumptionChangePercent!,
              isDark: isDark,
            ),
          ]
        ],
      ),
    );
  }

  /// Small labeled value tile (production, net) with icon and unit.
  Widget _buildSecondaryValue({
    required IconData icon,
    required String label,
    required String value,
    required String unit,
    required ThemeColorFamily colorFamily,
  }) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pSm,
      ),
      decoration: BoxDecoration(
        color: colorFamily.light9,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: colorFamily.light7,
          width: AppSpacings.scale(1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: AppSpacings.pXs,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: AppSpacings.pXs,
            children: [
              Icon(icon, size: AppSpacings.scale(14), color: colorFamily.base),
              Flexible(
                child: Text(
                  label,
                  style: TextStyle(
                    color: colorFamily.base,
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: RichText(
              maxLines: 1,
              text: TextSpan(
                children: [
                  TextSpan(
                    text: value,
                    style: TextStyle(
                      color: colorFamily.base,
                      fontSize: AppFontSize.base,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  TextSpan(
                    text: ' $unit',
                    style: TextStyle(
                      color: colorFamily.base,
                      fontSize: AppFontSize.extraSmall,
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Badge showing consumption change vs previous period (up/down/same).
  Widget _buildComparisonStatus(
    BuildContext context, {
    required double changePercent,
    required bool isDark,
  }) {
    final localizations = AppLocalizations.of(context)!;
    final brightness = isDark ? Brightness.dark : Brightness.light;

    // "vs yesterday" / "oproti včerejšku" — used with percentage values
    final periodLabel = switch (_selectedRange) {
      EnergyRange.today => localizations.energy_comparison_vs_yesterday,
      EnergyRange.week => localizations.energy_comparison_vs_last_week,
      EnergyRange.month => localizations.energy_comparison_vs_last_month,
    };

    // Bare period name — used with "Same as {period}" template
    final barePeriod = switch (_selectedRange) {
      EnergyRange.today => localizations.energy_period_yesterday,
      EnergyRange.week => localizations.energy_period_last_week,
      EnergyRange.month => localizations.energy_period_last_month,
    };

    // Determine display: icon, color, text
    final bool isZero = changePercent.abs() < 0.1;
    final bool isDown = changePercent < -0.1;

    final IconData arrowIcon;
    final ThemeColorFamily colorFamily;
    final String text;

    if (isZero) {
      arrowIcon = Icons.remove;
      colorFamily = ThemeColorFamily.get(brightness, ThemeColors.neutral);
      text = localizations.energy_comparison_same(barePeriod);
    } else if (isDown) {
      arrowIcon = Icons.arrow_downward;
      // Less consumption = good (green)
      colorFamily = ThemeColorFamily.get(brightness, ThemeColors.success);
      text = '${changePercent.abs().toStringAsFixed(1)}% $periodLabel';
    } else {
      arrowIcon = Icons.arrow_upward;
      // More consumption = warning (yellow)
      colorFamily = ThemeColorFamily.get(brightness, ThemeColors.warning);
      text = '${changePercent.abs().toStringAsFixed(1)}% $periodLabel';
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pXs,
      ),
      decoration: BoxDecoration(
        color: colorFamily.light8,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: AppSpacings.pXs,
        children: [
          Icon(
            arrowIcon,
            size: AppFontSize.small,
            color: colorFamily.base,
          ),
          Text(
            text,
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w600,
              color: colorFamily.base,
            ),
          ),
        ],
      ),
    );
  }

  // =============================================================================
  // TIMESERIES CHART
  // =============================================================================

  /// Bar chart of consumption (and production) over the selected range.
  Widget _buildTimeseriesChart(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final infoFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.info,
    );
    final successFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.success,
    );

    final points = _timeseries!.points;
    final hasProduction = _timeseries!.hasProduction;

    // Compute max for Y-axis
    double maxY = 0;
    for (final p in points) {
      maxY = max(maxY, p.consumption);
      if (hasProduction) {
        maxY = max(maxY, p.production);
      }
    }
    // Add 20% padding to max
    maxY = maxY > 0 ? maxY * 1.2 : 1.0;

    final isCompact = _screenService.isSmallScreen ||
        (_screenService.isMediumScreen && !_screenService.isPortrait);
    final barWidth = points.length > 24
        ? AppSpacings.scale(isCompact ? 5 : 8)
        : AppSpacings.scale(isCompact ? 6 : 12);

    // Adaptive decimal places so Y-axis labels stay meaningful for small values
    final yInterval = maxY / 4;
    final int yDecimals;
    if (yInterval >= 10) {
      yDecimals = 0;
    } else if (yInterval >= 1) {
      yDecimals = 1;
    } else if (yInterval >= 0.1) {
      yDecimals = 2;
    } else {
      yDecimals = 3;
    }

    // Calculate reserved size based on widest Y-axis label
    final widestLabel = NumberFormatUtils.defaultFormat.formatDecimal(
      maxY,
      decimalPlaces: yDecimals,
    );
    final yReservedSize = AppSpacings.scale(widestLabel.length * 7.0 + 4);

    return AppCard(
      expanded: true,
      headerIcon: MdiIcons.chartBar,
      headerTitle: localizations.energy_chart_title,
      child: Expanded(
        child: Padding(
          padding: EdgeInsets.only(
            left: AppSpacings.pMd,
            right: AppSpacings.pMd,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: AppSpacings.pMd,
            children: [
              Expanded(
                child: BarChart(
                  BarChartData(
                    alignment: BarChartAlignment.spaceAround,
                    maxY: maxY,
                    barTouchData: BarTouchData(
                      enabled: true,
                      touchTooltipData: BarTouchTooltipData(
                        getTooltipColor: (group) => isDark
                            ? AppFillColorDark.darker
                            : AppFillColorLight.darker,
                        tooltipPadding: EdgeInsets.symmetric(
                          horizontal: AppSpacings.pMd,
                          vertical: AppSpacings.pSm,
                        ),
                        maxContentWidth: AppSpacings.scale(150),
                        getTooltipItem: (group, groupIndex, rod, rodIndex) {
                          final value =
                              NumberFormatUtils.defaultFormat.formatDecimal(
                            rod.toY,
                            decimalPlaces: 2,
                          );
                          final label = rodIndex == 0
                              ? localizations.energy_consumption
                              : localizations.energy_production;
                          return BarTooltipItem(
                            '$label\n$value ${localizations.energy_unit_kwh}',
                            TextStyle(
                              color: isDark
                                  ? AppTextColorDark.primary
                                  : AppTextColorLight.primary,
                              fontSize: AppFontSize.extraSmall,
                              fontWeight: FontWeight.w500,
                            ),
                          );
                        },
                      ),
                    ),
                    titlesData: FlTitlesData(
                      show: true,
                      topTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                      rightTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                      leftTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          interval: yInterval,
                          reservedSize: yReservedSize,
                          getTitlesWidget: (value, meta) {
                            return SizedBox(
                              width: yReservedSize,
                              child: Padding(
                                padding:
                                    EdgeInsets.only(right: AppSpacings.pXs),
                                child: Text(
                                  NumberFormatUtils.defaultFormat.formatDecimal(
                                    value,
                                    decimalPlaces: yDecimals,
                                  ),
                                  textAlign: TextAlign.right,
                                  style: TextStyle(
                                    fontSize: AppFontSize.extraExtraSmall,
                                    color: isDark
                                        ? AppTextColorDark.placeholder
                                        : AppTextColorLight.placeholder,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: AppSpacings.scale(20),
                          getTitlesWidget: (value, meta) {
                            final index = value.toInt();
                            if (index < 0 || index >= points.length) {
                              return const SizedBox.shrink();
                            }
                            final point = points[index];

                            // Show labels at regular intervals, fewer on compact
                            final bool show;
                            String label;
                            if (_selectedRange == EnergyRange.month) {
                              // Compact: every 5th day, normal: even days
                              show = isCompact
                                  ? point.timestamp.day % 5 == 0
                                  : point.timestamp.day.isEven;
                              label = '${point.timestamp.day}';
                            } else if (_selectedRange == EnergyRange.week) {
                              // Daily interval — show localized short day name
                              show = true;
                              label = _getShortDayName(
                                localizations,
                                point.timestamp.weekday,
                              );
                            } else {
                              // Compact: every 4th hour, normal: even hours
                              show = isCompact
                                  ? point.timestamp.hour % 4 == 0
                                  : point.timestamp.hour.isEven;
                              label =
                                  '${point.timestamp.hour.toString().padLeft(2, '0')}:00';
                            }

                            if (!show) {
                              return const SizedBox.shrink();
                            }

                            return Padding(
                              padding: EdgeInsets.only(top: AppSpacings.pXs),
                              child: Text(
                                label,
                                style: TextStyle(
                                  fontSize: AppFontSize.extraExtraSmall,
                                  color: isDark
                                      ? AppTextColorDark.placeholder
                                      : AppTextColorLight.placeholder,
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                    gridData: FlGridData(
                      show: true,
                      drawVerticalLine: false,
                      horizontalInterval: maxY > 0 ? maxY / 4 : 1,
                      getDrawingHorizontalLine: (value) {
                        return FlLine(
                          color: isDark
                              ? AppFillColorDark.darker
                              : AppBorderColorLight.base,
                          strokeWidth: AppSpacings.scale(1),
                        );
                      },
                    ),
                    borderData: FlBorderData(show: false),
                    barGroups: List.generate(points.length, (index) {
                      final point = points[index];
                      final rods = <BarChartRodData>[
                        BarChartRodData(
                          toY: point.consumption,
                          color: infoFamily.base,
                          width: barWidth,
                          borderRadius: BorderRadius.vertical(
                            top: Radius.circular(AppSpacings.scale(2)),
                          ),
                        ),
                      ];

                      if (hasProduction) {
                        rods.add(BarChartRodData(
                          toY: point.production,
                          color: successFamily.base,
                          width: barWidth,
                          borderRadius: BorderRadius.vertical(
                            top: Radius.circular(AppSpacings.scale(2)),
                          ),
                        ));
                      }

                      return BarChartGroupData(
                        x: index,
                        barRods: rods,
                        barsSpace: hasProduction ? AppSpacings.scale(2) : 0,
                      );
                    }),
                  ),
                ),
              ),
              // Legend
              if (hasProduction)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  spacing: AppSpacings.pLg,
                  children: [
                    _buildLegendItem(
                      context,
                      color: infoFamily.base,
                      label: localizations.energy_consumption,
                    ),
                    _buildLegendItem(
                      context,
                      color: successFamily.base,
                      label: localizations.energy_production,
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }

  /// Returns localized short day name for weekday (1=Monday, 7=Sunday).
  static String _getShortDayName(AppLocalizations l10n, int weekday) {
    return switch (weekday) {
      1 => l10n.day_monday_short,
      2 => l10n.day_tuesday_short,
      3 => l10n.day_wednesday_short,
      4 => l10n.day_thursday_short,
      5 => l10n.day_friday_short,
      6 => l10n.day_saturday_short,
      7 => l10n.day_sunday_short,
      _ => '',
    };
  }

  Widget _buildLegendItem(
    BuildContext context, {
    required Color color,
    required String label,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      mainAxisSize: MainAxisSize.min,
      spacing: AppSpacings.pXs,
      children: [
        Container(
          width: AppSpacings.scale(12),
          height: AppSpacings.scale(12),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(AppSpacings.scale(2)),
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: AppFontSize.extraSmall,
            color: isDark
                ? AppTextColorDark.secondary
                : AppTextColorLight.secondary,
          ),
        ),
      ],
    );
  }

  // =============================================================================
  // TOP CONSUMERS (SHEET / DRAWER)
  // =============================================================================

  /// Opens top consumers: bottom sheet (portrait) or right drawer (landscape).
  void _showTopConsumers(BuildContext context) {
    if (_breakdown == null || _breakdown!.isEmpty) return;

    final localizations = AppLocalizations.of(context)!;
    final isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

    if (isLandscape) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final drawerBgColor =
          isDark ? AppFillColorDark.base : AppFillColorLight.blank;

      showAppRightDrawer(
        context,
        title: localizations.energy_top_consumers,
        titleIcon: MdiIcons.podium,
        scrollable: false,
        content: VerticalScrollWithGradient(
          gradientHeight: AppSpacings.pMd,
          itemCount: _breakdown!.devices.length,
          separatorHeight: AppSpacings.pSm,
          backgroundColor: drawerBgColor,
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pLg,
            vertical: AppSpacings.pMd,
          ),
          itemBuilder: (context, index) =>
              _buildConsumerTileForSheet(context, index),
        ),
      );
    } else {
      DeckItemSheet.showItemSheet(
        context,
        title: localizations.energy_top_consumers,
        icon: MdiIcons.podium,
        itemCount: _breakdown!.devices.length,
        itemBuilder: (context, index) =>
            _buildConsumerTileForSheet(context, index),
      );
    }
  }

  /// Single device tile with name, consumption value, and progress bar.
  Widget _buildConsumerTileForSheet(BuildContext context, int index) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final infoFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.info,
    );

    final devices = _breakdown!.devices;
    final device = devices[index];
    final maxConsumption = devices.isNotEmpty
        ? devices.map((d) => d.consumption).reduce(max)
        : 1.0;
    final ratio =
        maxConsumption > 0 ? device.consumption / maxConsumption : 0.0;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: AppSpacings.pSm,
        children: [
          Row(
            children: [
              Container(
                width: AppSpacings.scale(32),
                height: AppSpacings.scale(32),
                decoration: BoxDecoration(
                  color: infoFamily.light8,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                ),
                child: Icon(
                  MdiIcons.flashOutline,
                  size: AppSpacings.scale(24),
                  color: infoFamily.base,
                ),
              ),
              AppSpacings.spacingSmHorizontal,
              Expanded(
                child: Text(
                  device.roomName != null &&
                          device.deviceName.startsWith(device.roomName!)
                      ? device.deviceName
                          .substring(device.roomName!.length)
                          .trimLeft()
                      : device.deviceName,
                  style: TextStyle(
                    fontSize: AppFontSize.base,
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? AppTextColorDark.primary
                        : AppTextColorLight.primary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                '${NumberFormatUtils.defaultFormat.formatDecimal(device.consumption, decimalPlaces: _EnergyViewConstants.energyDecimals(device.consumption))} ${localizations.energy_unit_kwh}',
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.w600,
                  color: infoFamily.base,
                ),
              ),
            ],
          ),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacings.scale(2)),
            child: LinearProgressIndicator(
              value: ratio,
              minHeight: AppSpacings.scale(4),
              backgroundColor:
                  isDark ? AppFillColorDark.darker : AppBorderColorLight.base,
              valueColor: AlwaysStoppedAnimation<Color>(
                infoFamily.light3,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // =============================================================================
  // EMPTY STATE
  // =============================================================================

  /// Centered empty state when no energy data is available.
  Widget _buildEmptyState(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final infoFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.info,
    );

    return Center(
      child: Padding(
        padding: AppSpacings.paddingXl,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          spacing: AppSpacings.pMd,
          children: [
            Container(
              width: AppSpacings.scale(80),
              height: AppSpacings.scale(80),
              decoration: BoxDecoration(
                color: infoFamily.light8,
                shape: BoxShape.circle,
              ),
              child: Icon(
                MdiIcons.flashOff,
                size: AppSpacings.scale(48),
                color: infoFamily.base,
              ),
            ),
            Text(
              localizations.energy_empty_title,
              style: TextStyle(
                fontSize: AppFontSize.large,
                fontWeight: FontWeight.w600,
                color: isDark
                    ? AppTextColorDark.primary
                    : AppTextColorLight.primary,
              ),
              textAlign: TextAlign.center,
            ),
            Text(
              localizations.energy_empty_description,
              style: TextStyle(
                fontSize: AppFontSize.base,
                color: isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
