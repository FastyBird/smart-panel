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
// **File structure:**
// - CONSTANTS
// - ENERGY DOMAIN VIEW PAGE (state, lifecycle, data loading, build)
// - HEADER
// - RANGE SELECTOR
// - SUMMARY CARDS
// - TIMESERIES CHART
// - TOP CONSUMERS LIST
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

class _EnergyViewConstants {
  static const int breakdownLimit = 10;
}

// =============================================================================
// ENERGY DOMAIN VIEW PAGE
// =============================================================================

class EnergyDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const EnergyDomainViewPage({super.key, required this.viewItem});

  @override
  State<EnergyDomainViewPage> createState() => _EnergyDomainViewPageState();
}

class _EnergyDomainViewPageState extends State<EnergyDomainViewPage>
    with DomainDataLoader<EnergyDomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();

  EnergyService? _energyService;
  EventBus? _eventBus;
  BottomNavModeNotifier? _bottomNavModeNotifier;
  StreamSubscription<DeckPageActivatedEvent>? _pageActivatedSubscription;
  bool _isActivePage = false;

  EnergyRange _selectedRange = EnergyRange.today;
  bool _isRangeChangeInFlight = false;

  EnergySummary? _summary;
  EnergyTimeseries? _timeseries;
  EnergyBreakdown? _breakdown;

  String get _roomId => widget.viewItem.roomId;

  // --------------------------------------------------------------------------
  // LIFECYCLE
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // DOMAIN DATA LOADER
  // --------------------------------------------------------------------------

  @override
  bool hasExistingData() => _summary != null;

  @override
  Future<void> fetchData() async {
    await _fetchAllData();
  }

  @override
  bool isDataEmpty() => _summary == null;

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

  // --------------------------------------------------------------------------
  // BOTTOM NAV MODE REGISTRATION
  // --------------------------------------------------------------------------

  void _onPageActivated(DeckPageActivatedEvent event) {
    if (!mounted) return;
    _isActivePage = event.itemId == widget.viewItem.id;

    if (_isActivePage) {
      _registerRangeModeConfig();
    }
  }

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

  // --------------------------------------------------------------------------
  // BUILD
  // --------------------------------------------------------------------------

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

  Widget _buildHeader(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;

    String subtitle;
    if (_summary != null) {
      final consumption = NumberFormatUtils.defaultFormat.formatDecimal(
        _summary!.consumption,
        decimalPlaces: 2,
      );
      subtitle = '$consumption ${localizations.energy_unit_kwh}';
      if (_summary!.hasProduction) {
        final production = NumberFormatUtils.defaultFormat.formatDecimal(
          _summary!.production!,
          decimalPlaces: 2,
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
      subtitleColor: _summary != null ? infoColor : null,
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

  Widget _buildPortraitLayout(BuildContext context) {
    return PortraitViewLayout(
      scrollable: false,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: AppSpacings.pSm,
        children: [
          _buildConsumptionCard(context),
          if (_timeseries != null && _timeseries!.isNotEmpty)
            _buildTimeseriesChart(context),
        ],
      ),
    );
  }

  // =============================================================================
  // LANDSCAPE LAYOUT
  // =============================================================================

  Widget _buildLandscapeLayout(BuildContext context) {
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
            _buildTimeseriesChart(context),
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
          _buildConsumptionCard(context),
        ],
      ),
    );
  }

  // =============================================================================
  // SUMMARY CARDS
  // =============================================================================

  Widget _buildConsumptionCard(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final brightness = isDark ? Brightness.dark : Brightness.light;
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

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        spacing: AppSpacings.pSm,
        children: [
          // Hero row: badge + giant value
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
              final textColor = isDark
                  ? AppTextColorDark.regular
                  : AppTextColorLight.regular;
              final unitColor = isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder;
              final badgeFontSize = isCompactFont
                  ? AppFontSize.small
                  : AppFontSize.base;

              return Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  // Badge pill
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
                  // Giant value
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Text(
                        NumberFormatUtils.defaultFormat.formatDecimal(
                          _summary!.consumption,
                          decimalPlaces: 2,
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
            style: TextStyle(
              fontSize: AppFontSize.small,
              fontWeight: FontWeight.w400,
              color: isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder,
            ),
          ),
          // Production & Net row
          if (_summary!.hasProduction) ...[
            SizedBox(height: AppSpacings.pXs),
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
                        decimalPlaces: 2,
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
                          decimalPlaces: 2,
                        ),
                        unit: localizations.energy_unit_kwh,
                        colorFamily: _summary!.net! > 0
                            ? warningFamily
                            : successFamily,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

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

  // =============================================================================
  // TIMESERIES CHART
  // =============================================================================

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

    final barWidth = _screenService.isSmallScreen
        ? AppSpacings.scale(8)
        : AppSpacings.scale(12);

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

    return AppCard(
      headerIcon: MdiIcons.chartBar,
      headerTitle: localizations.energy_chart_title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          SizedBox(
            height: AppSpacings.scale(200),
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
                      horizontal: AppSpacings.pSm,
                      vertical: AppSpacings.pXs,
                    ),
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
                      reservedSize: AppSpacings.scale(40),
                      getTitlesWidget: (value, meta) {
                        return Text(
                          NumberFormatUtils.defaultFormat.formatDecimal(
                            value,
                            decimalPlaces: yDecimals,
                          ),
                          style: TextStyle(
                            fontSize: AppFontSize.extraSmall,
                            color: isDark
                                ? AppTextColorDark.placeholder
                                : AppTextColorLight.placeholder,
                          ),
                        );
                      },
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: AppSpacings.scale(24),
                      getTitlesWidget: (value, meta) {
                        final index = value.toInt();
                        if (index < 0 || index >= points.length) {
                          return const SizedBox.shrink();
                        }
                        // Show every Nth label to avoid crowding
                        final step =
                            (points.length / 4).ceil().clamp(1, points.length);
                        if (index % step != 0 && index != points.length - 1) {
                          return const SizedBox.shrink();
                        }
                        final point = points[index];
                        final hour =
                            point.timestamp.hour.toString().padLeft(2, '0');
                        String label;
                        if (_selectedRange == EnergyRange.month) {
                          label = '${point.timestamp.day}';
                        } else if (_selectedRange == EnergyRange.week) {
                          label =
                              '${point.timestamp.day}/${point.timestamp.month} $hour:00';
                        } else {
                          label = '$hour:00';
                        }
                        return Padding(
                          padding: EdgeInsets.only(top: AppSpacings.pXs),
                          child: Text(
                            label,
                            style: TextStyle(
                              fontSize: AppFontSize.extraSmall,
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
    );
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
              Icon(
                MdiIcons.flashOutline,
                size: AppSpacings.scale(16),
                color: infoFamily.base,
              ),
              AppSpacings.spacingSmHorizontal,
              Expanded(
                child: Text(
                  device.deviceName,
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
                '${NumberFormatUtils.defaultFormat.formatDecimal(device.consumption, decimalPlaces: 2)} ${localizations.energy_unit_kwh}',
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
                infoFamily.base.withValues(alpha: 0.6),
              ),
            ),
          ),
          if (device.roomName != null)
            Text(
              device.roomName!,
              style: TextStyle(
                fontSize: AppFontSize.extraSmall,
                color: isDark
                    ? AppTextColorDark.placeholder
                    : AppTextColorLight.placeholder,
              ),
            ),
        ],
      ),
    );
  }

  // =============================================================================
  // EMPTY STATE
  // =============================================================================

  Widget _buildEmptyState(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;
    final infoBgColor =
        isDark ? AppColorsDark.infoLight9 : AppColorsLight.infoLight9;

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
                color: infoBgColor,
                shape: BoxShape.circle,
              ),
              child: Icon(
                MdiIcons.flashOff,
                size: AppSpacings.scale(48),
                color: infoColor,
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
