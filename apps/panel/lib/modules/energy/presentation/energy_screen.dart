// Standalone Energy Screen — whole-installation energy overview.
//
// Mirrors the energy domain view visually, but uses EnergyRepository
// (ChangeNotifier via Provider) with spaceId='home' for whole-installation data.
//
// Sections:
// - ENERGY SCREEN (state, lifecycle, build)
// - HEADER
// - PORTRAIT LAYOUT
// - LANDSCAPE LAYOUT
// - SUMMARY CARDS (consumption hero, secondary values, comparison)
// - TIMESERIES CHART
// - TOP CONSUMERS (sheet / drawer)

import 'dart:async';
import 'dart:math';

import 'package:event_bus/event_bus.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/base_card.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_drawer.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_chip.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_page_activated_event.dart';
import 'package:fastybird_smart_panel/modules/energy/repositories/energy_repository.dart';
import 'package:fastybird_smart_panel/modules/energy/services/energy_service.dart';

// =============================================================================
// CONSTANTS
// =============================================================================

const String _homeSpaceId = 'home';

/// Constants and helpers for the energy screen.
class _EnergyViewConstants {
  static int energyDecimals(double value) {
    final abs = value.abs();
    if (abs >= 100) return 0;
    if (abs >= 10) return 1;
    return 2;
  }
}

// =============================================================================
// ENERGY SCREEN
// =============================================================================

class EnergyScreen extends StatefulWidget {
  /// When true, hides back/home navigation buttons (used when embedded in deck).
  final bool embedded;

  const EnergyScreen({super.key, this.embedded = false});

  @override
  State<EnergyScreen> createState() => _EnergyScreenState();
}

class _EnergyScreenState extends State<EnergyScreen> {
  final ScreenService _screenService = locator<ScreenService>();

  // Deck integration
  EventBus? _eventBus;
  BottomNavModeNotifier? _bottomNavModeNotifier;
  StreamSubscription<DeckPageActivatedEvent>? _pageActivatedSubscription;
  bool _isActivePage = false;

  @override
  void initState() {
    super.initState();

    if (widget.embedded) {
      if (locator.isRegistered<EventBus>()) {
        _eventBus = locator<EventBus>();
      }
      if (locator.isRegistered<BottomNavModeNotifier>()) {
        _bottomNavModeNotifier = locator<BottomNavModeNotifier>();
      }

      _pageActivatedSubscription =
          _eventBus?.on<DeckPageActivatedEvent>().listen(_onPageActivated);
    }
  }

  @override
  void dispose() {
    _pageActivatedSubscription?.cancel();
    super.dispose();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DECK INTEGRATION
  // ─────────────────────────────────────────────────────────────────────────

  void _onPageActivated(DeckPageActivatedEvent event) {
    if (!mounted) return;

    // The energy screen is a deck item — check if this event is for us.
    // When embedded, we register the range selector whenever activated.
    _isActivePage = true;

    final repo = context.read<EnergyRepository>();
    if (repo.summary != null) {
      _registerRangeModeConfig(repo);
    }
  }

  void _registerRangeModeConfig(EnergyRepository repo) {
    if (!widget.embedded || !_isActivePage) return;

    // During loading (range switch in-flight) keep the existing chip;
    // only clear when we have a definitive "no data" state.
    if (repo.summary == null) {
      if (repo.state != EnergyDataState.loading) {
        _bottomNavModeNotifier?.clear();
      }
      return;
    }

    final localizations = AppLocalizations.of(context)!;
    final rangeOptions = _getRangeOptions(localizations);
    final currentOption = rangeOptions.firstWhere(
      (o) => o.value == repo.selectedRange,
      orElse: () => rangeOptions.first,
    );

    _bottomNavModeNotifier?.setConfig(BottomNavModeConfig(
      icon: currentOption.icon,
      label: currentOption.label,
      color: ThemeColors.info,
      popupBuilder: (context, dismiss) =>
          _buildRangePopupContent(context, dismiss, repo),
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

  Widget _buildRangePopupContent(
    BuildContext context,
    VoidCallback dismiss,
    EnergyRepository repo,
  ) {
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
            onTap: () async {
              dismiss();
              await repo.setRange(_homeSpaceId, option.value);
              if (mounted) _registerRangeModeConfig(repo);
            },
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: EdgeInsets.symmetric(
                vertical: AppSpacings.pMd,
                horizontal: AppSpacings.pMd,
              ),
              margin: EdgeInsets.only(bottom: AppSpacings.pXs),
              decoration: BoxDecoration(
                color: option.value == repo.selectedRange
                    ? infoFamily.light9
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(AppBorderRadius.small),
                border: option.value == repo.selectedRange
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
                    color: option.value == repo.selectedRange
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
                        fontWeight: option.value == repo.selectedRange
                            ? FontWeight.w600
                            : FontWeight.w400,
                        color: option.value == repo.selectedRange
                            ? infoFamily.base
                            : (isDark
                                ? AppTextColorDark.regular
                                : AppTextColorLight.regular),
                      ),
                    ),
                  ),
                  if (option.value == repo.selectedRange)
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

  DomainLoadState _mapState(EnergyRepository repo) {
    if (repo.state == EnergyDataState.loading && repo.summary == null) {
      return DomainLoadState.loading;
    }
    if (repo.state == EnergyDataState.error && repo.summary == null) {
      return DomainLoadState.error;
    }
    if (repo.summary == null &&
        (repo.state == EnergyDataState.loaded ||
            repo.state == EnergyDataState.initial)) {
      return DomainLoadState.empty;
    }
    return DomainLoadState.loaded;
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Consumer<EnergyRepository>(
      builder: (context, repo, _) {
        final loadState = _mapState(repo);

        if (loadState != DomainLoadState.loaded &&
            loadState != DomainLoadState.empty) {
          return DomainStateView(
            state: loadState,
            onRetry: () => repo.fetchData(_homeSpaceId),
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
                _buildHeader(context, repo),
                Expanded(
                  child: repo.summary == null
                      ? DomainStateView(
                          state: DomainLoadState.notConfigured,
                          onRetry: () => repo.fetchData(_homeSpaceId),
                          domainName: localizations.domain_energy,
                          notConfiguredIcon: MdiIcons.flashOff,
                          notConfiguredTitle:
                              localizations.energy_empty_title,
                          notConfiguredDescription:
                              localizations.energy_empty_description,
                          child: const SizedBox.shrink(),
                        )
                      : OrientationBuilder(
                          builder: (context, orientation) {
                            return orientation == Orientation.landscape
                                ? _buildLandscapeLayout(context, repo)
                                : _buildPortraitLayout(context, repo);
                          },
                        ),
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

  Widget _buildHeader(BuildContext context, EnergyRepository repo) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final infoFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.info,
    );

    String subtitle;
    if (repo.summary != null) {
      final consumption = NumberFormatUtils.defaultFormat.formatDecimal(
        repo.summary!.consumption,
        decimalPlaces:
            _EnergyViewConstants.energyDecimals(repo.summary!.consumption),
      );
      subtitle = '$consumption ${localizations.energy_unit_kwh}';
      if (repo.summary!.hasProduction) {
        final production = NumberFormatUtils.defaultFormat.formatDecimal(
          repo.summary!.production!,
          decimalPlaces:
              _EnergyViewConstants.energyDecimals(repo.summary!.production!),
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
      subtitleColor: repo.summary != null ? infoFamily.base : null,
      onBack: widget.embedded ? null : () => Navigator.pop(context),
      leading: HeaderMainIcon(
        icon: MdiIcons.flashOutline,
        color: ThemeColors.info,
      ),
      landscapeAction: widget.embedded ? const DeckModeChip() : null,
      trailing: repo.breakdown != null && repo.breakdown!.isNotEmpty
          ? HeaderIconButton(
              icon: MdiIcons.podium,
              color: ThemeColors.info,
              onTap: () => _showTopConsumers(context, repo),
            )
          : null,
    );
  }

  // =============================================================================
  // PORTRAIT LAYOUT
  // =============================================================================

  Widget _buildPortraitLayout(BuildContext context, EnergyRepository repo) {
    return PortraitViewLayout(
      scrollable: false,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: AppSpacings.pMd,
        children: [
          _buildConsumptionCard(context, repo),
          if (repo.timeseries != null && repo.timeseries!.isNotEmpty)
            Expanded(child: _buildTimeseriesChart(context, repo)),
        ],
      ),
    );
  }

  // =============================================================================
  // LANDSCAPE LAYOUT
  // =============================================================================

  Widget _buildLandscapeLayout(BuildContext context, EnergyRepository repo) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final brightness = isDark ? Brightness.dark : Brightness.light;
    final successFamily = ThemeColorFamily.get(brightness, ThemeColors.success);
    final warningFamily = ThemeColorFamily.get(brightness, ThemeColors.warning);
    final summary = repo.summary!;

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
          if (repo.timeseries != null && repo.timeseries!.isNotEmpty)
            Expanded(child: _buildTimeseriesChart(context, repo)),
        ],
      ),
      additionalContentScrollable: false,
      additionalContentPadding: EdgeInsets.only(
        left: AppSpacings.pMd,
        right: AppSpacings.pMd,
        bottom: AppSpacings.pMd,
      ),
      additionalContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: AppSpacings.pMd,
        children: [
          Expanded(child: _buildConsumptionCard(context, repo)),
          if (summary.hasProduction) ...[
            BaseCard(
              child: _buildSecondaryValue(
                icon: MdiIcons.solarPower,
                label: localizations.energy_production,
                value: NumberFormatUtils.defaultFormat.formatDecimal(
                  summary.production!,
                  decimalPlaces: _EnergyViewConstants.energyDecimals(
                      summary.production!),
                ),
                unit: localizations.energy_unit_kwh,
                colorFamily: successFamily,
              ),
            ),
            if (summary.net != null)
              BaseCard(
                child: _buildSecondaryValue(
                  icon: MdiIcons.swapVertical,
                  label: localizations.energy_net,
                  value: NumberFormatUtils.defaultFormat.formatDecimal(
                    summary.net!,
                    decimalPlaces:
                        _EnergyViewConstants.energyDecimals(summary.net!),
                  ),
                  unit: localizations.energy_unit_kwh,
                  colorFamily:
                      summary.net! > 0 ? warningFamily : successFamily,
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

  Widget _buildConsumptionCard(BuildContext context, EnergyRepository repo) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final brightness = isDark ? Brightness.dark : Brightness.light;
    final isLandscape = _screenService.isLandscape;
    final infoFamily = ThemeColorFamily.get(brightness, ThemeColors.info);
    final successFamily = ThemeColorFamily.get(brightness, ThemeColors.success);
    final warningFamily = ThemeColorFamily.get(brightness, ThemeColors.warning);
    final summary = repo.summary!;
    final selectedRange = repo.selectedRange;

    final rangeIcon = switch (selectedRange) {
      EnergyRange.today => MdiIcons.calendarToday,
      EnergyRange.week => MdiIcons.calendarWeek,
      EnergyRange.month => MdiIcons.calendarMonth,
    };
    final rangeLabel = switch (selectedRange) {
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
                spacing: AppSpacings.pSm,
                children: [
                  // Badge pill (portrait only)
                  if (!isLandscape)
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
                        spacing: AppSpacings.pSm,
                        children: [
                          Icon(
                            rangeIcon,
                            size: badgeFontSize,
                            color: infoFamily.base,
                          ),
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
                  // Giant value
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Text(
                        NumberFormatUtils.defaultFormat.formatDecimal(
                          summary.consumption,
                          decimalPlaces: _EnergyViewConstants.energyDecimals(
                              summary.consumption),
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
            switch (selectedRange) {
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
          if (!isLandscape && summary.hasProduction) ...[
            AppSpacings.spacingXsVertical,
            IntrinsicHeight(
              child: Row(
                spacing: AppSpacings.pSm,
                children: [
                  Expanded(
                    child: _buildSecondaryValue(
                      icon: MdiIcons.solarPower,
                      label: localizations.energy_production,
                      value: NumberFormatUtils.defaultFormat.formatDecimal(
                        summary.production!,
                        decimalPlaces: _EnergyViewConstants.energyDecimals(
                            summary.production!),
                      ),
                      unit: localizations.energy_unit_kwh,
                      colorFamily: successFamily,
                    ),
                  ),
                  if (summary.net != null)
                    Expanded(
                      child: _buildSecondaryValue(
                        icon: MdiIcons.swapVertical,
                        label: localizations.energy_net,
                        value: NumberFormatUtils.defaultFormat.formatDecimal(
                          summary.net!,
                          decimalPlaces: _EnergyViewConstants.energyDecimals(
                              summary.net!),
                        ),
                        unit: localizations.energy_unit_kwh,
                        colorFamily:
                            summary.net! > 0 ? warningFamily : successFamily,
                      ),
                    ),
                ],
              ),
            ),
          ],
          // Comparison status
          if (summary.hasConsumptionComparison) ...[
            AppSpacings.spacingSmVertical,
            _buildComparisonStatus(
              context,
              changePercent: summary.consumptionChangePercent!,
              selectedRange: selectedRange,
              isDark: isDark,
            ),
          ]
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

  Widget _buildComparisonStatus(
    BuildContext context, {
    required double changePercent,
    required EnergyRange selectedRange,
    required bool isDark,
  }) {
    final localizations = AppLocalizations.of(context)!;
    final brightness = isDark ? Brightness.dark : Brightness.light;

    final periodLabel = switch (selectedRange) {
      EnergyRange.today => localizations.energy_comparison_vs_yesterday,
      EnergyRange.week => localizations.energy_comparison_vs_last_week,
      EnergyRange.month => localizations.energy_comparison_vs_last_month,
    };

    final barePeriod = switch (selectedRange) {
      EnergyRange.today => localizations.energy_period_yesterday,
      EnergyRange.week => localizations.energy_period_last_week,
      EnergyRange.month => localizations.energy_period_last_month,
    };

    final bool isZero = changePercent.abs() < 0.1;
    final bool isDown = !isZero && changePercent < 0;

    final IconData arrowIcon;
    final ThemeColorFamily colorFamily;
    final String text;

    if (isZero) {
      arrowIcon = Icons.remove;
      colorFamily = ThemeColorFamily.get(brightness, ThemeColors.neutral);
      text = localizations.energy_comparison_same(barePeriod);
    } else if (isDown) {
      arrowIcon = Icons.arrow_downward;
      colorFamily = ThemeColorFamily.get(brightness, ThemeColors.success);
      text = '${changePercent.abs().toStringAsFixed(1)}% $periodLabel';
    } else {
      arrowIcon = Icons.arrow_upward;
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

  Widget _buildTimeseriesChart(BuildContext context, EnergyRepository repo) {
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

    final points = repo.timeseries!.points;
    final hasProduction = repo.timeseries!.hasProduction;
    final selectedRange = repo.selectedRange;

    double maxY = 0;
    for (final p in points) {
      maxY = max(maxY, p.consumption);
      if (hasProduction) {
        maxY = max(maxY, p.production);
      }
    }
    maxY = maxY > 0 ? maxY * 1.2 : 1.0;

    final isCompact = _screenService.isSmallScreen ||
        (_screenService.isMediumScreen && !_screenService.isPortrait);
    final barWidth = points.length > 24
        ? AppSpacings.scale(isCompact ? 5 : 8)
        : AppSpacings.scale(isCompact ? 6 : 12);

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

    final widestLabel = NumberFormatUtils.defaultFormat.formatDecimal(
      maxY,
      decimalPlaces: yDecimals,
    );
    final yReservedSize = AppSpacings.scale(widestLabel.length * 7.0 + 4);

    return BaseCard(
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

                            final bool show;
                            String label;
                            if (selectedRange == EnergyRange.month) {
                              show = isCompact
                                  ? point.timestamp.day % 5 == 0
                                  : point.timestamp.day.isEven;
                              label = '${point.timestamp.day}';
                            } else if (selectedRange == EnergyRange.week) {
                              show = true;
                              label = _getShortDayName(
                                localizations,
                                point.timestamp.weekday,
                              );
                            } else {
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

  void _showTopConsumers(BuildContext context, EnergyRepository repo) {
    if (repo.breakdown == null || repo.breakdown!.isEmpty) return;

    final localizations = AppLocalizations.of(context)!;
    final isLandscape = _screenService.isLandscape;

    if (isLandscape) {
      DeckItemDrawer.showItemDrawer(
        context,
        title: localizations.energy_top_consumers,
        icon: MdiIcons.podium,
        itemCount: repo.breakdown!.devices.length,
        itemBuilder: (context, index) =>
            _buildConsumerTileForSheet(context, repo, index),
      );
    } else {
      DeckItemSheet.showItemSheet(
        context,
        title: localizations.energy_top_consumers,
        icon: MdiIcons.podium,
        itemCount: repo.breakdown!.devices.length,
        itemBuilder: (context, index) =>
            _buildConsumerTileForSheet(context, repo, index),
      );
    }
  }

  Widget _buildConsumerTileForSheet(
    BuildContext context,
    EnergyRepository repo,
    int index,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final infoFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.info,
    );

    final devices = repo.breakdown!.devices;
    final device = devices[index];
    final maxConsumption = devices.isNotEmpty
        ? devices.map((d) => d.consumption).reduce(max)
        : 1.0;
    final ratio =
        maxConsumption > 0 ? device.consumption / maxConsumption : 0.0;

    return BaseCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: AppSpacings.pSm,
        children: [
          Row(
            spacing: AppSpacings.pSm,
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
}
