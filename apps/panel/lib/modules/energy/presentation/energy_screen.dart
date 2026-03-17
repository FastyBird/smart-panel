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
// - TOP CONSUMERS (sheet / drawer)

import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/base_card.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_drawer.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_chip.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_page_activated_event.dart';
import 'package:fastybird_smart_panel/modules/energy/presentation/widgets/energy_consumption_card.dart';
import 'package:fastybird_smart_panel/modules/energy/presentation/widgets/energy_consumer_tile.dart';
import 'package:fastybird_smart_panel/modules/energy/presentation/widgets/energy_range_options.dart';
import 'package:fastybird_smart_panel/modules/energy/presentation/widgets/energy_timeseries_chart.dart';
import 'package:fastybird_smart_panel/modules/energy/repositories/energy_repository.dart';
import 'package:fastybird_smart_panel/modules/energy/utils/energy_format.dart';

// =============================================================================
// CONSTANTS
// =============================================================================

const String _homeSpaceId = 'home';

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

    _isActivePage = event.item is EnergyViewItem;

    if (_isActivePage) {
      _registerRangeModeConfig(context.read<EnergyRepository>());
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
    final rangeOptions = getEnergyRangeOptions(localizations);
    final currentOption = rangeOptions.firstWhere(
      (o) => o.value == repo.selectedRange,
      orElse: () => rangeOptions.first,
    );

    _bottomNavModeNotifier?.setConfig(BottomNavModeConfig(
      icon: currentOption.icon,
      label: currentOption.label,
      color: ThemeColors.info,
      popupBuilder: (context, dismiss) {
        final localizations = AppLocalizations.of(context)!;
        return EnergyRangeOptionsList(
          selectedRange: repo.selectedRange,
          rangeOptions: getEnergyRangeOptions(localizations),
          onSelected: (range) async {
            dismiss();
            await repo.setRange(_homeSpaceId, range);
            if (mounted) _registerRangeModeConfig(repo);
          },
        );
      },
    ));
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
        final isDark = Theme.of(context).brightness == Brightness.dark;

        return Scaffold(
          backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
          body: SafeArea(
            child: Column(
              children: [
                _buildHeader(context, repo),
                Expanded(
                  child: _buildContent(
                      context, repo, loadState, localizations),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildContent(
    BuildContext context,
    EnergyRepository repo,
    DomainLoadState loadState,
    AppLocalizations localizations,
  ) {
    if (loadState == DomainLoadState.loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (loadState == DomainLoadState.error) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      final warningColor =
          isDark ? AppColorsDark.warning : AppColorsLight.warning;

      return Center(
        child: Padding(
          padding: AppSpacings.paddingXl,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: AppSpacings.pMd,
            children: [
              Icon(MdiIcons.alertCircleOutline,
                  size: AppSpacings.scale(48), color: warningColor),
              Text(
                localizations.domain_data_load_failed(
                    localizations.domain_energy),
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
                localizations.domain_data_load_failed_description,
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  color: isDark
                      ? AppTextColorDark.secondary
                      : AppTextColorLight.secondary,
                ),
                textAlign: TextAlign.center,
              ),
              Theme(
                data: ThemeData(
                  filledButtonTheme: isDark
                      ? AppFilledButtonsDarkThemes.primary
                      : AppFilledButtonsLightThemes.primary,
                ),
                child: FilledButton.icon(
                  onPressed: () => repo.fetchData(_homeSpaceId),
                  icon: Icon(
                    MdiIcons.refresh,
                    size: AppFontSize.base,
                    color: isDark
                        ? AppFilledButtonsDarkThemes.primaryForegroundColor
                        : AppFilledButtonsLightThemes.primaryForegroundColor,
                  ),
                  label: Text(localizations.action_retry),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (repo.summary == null) {
      return DomainStateView(
        state: DomainLoadState.notConfigured,
        onRetry: () => repo.fetchData(_homeSpaceId),
        domainName: localizations.domain_energy,
        notConfiguredIcon: MdiIcons.flashOff,
        notConfiguredTitle: localizations.energy_empty_title,
        notConfiguredDescription: localizations.energy_empty_description,
        child: const SizedBox.shrink(),
      );
    }

    return OrientationBuilder(
      builder: (context, orientation) {
        return orientation == Orientation.landscape
            ? _buildLandscapeLayout(context, repo)
            : _buildPortraitLayout(context, repo);
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
            energyDecimals(repo.summary!.consumption),
      );
      subtitle = '$consumption ${localizations.energy_unit_kwh}';
      if (repo.summary!.hasProduction) {
        final production = NumberFormatUtils.defaultFormat.formatDecimal(
          repo.summary!.production!,
          decimalPlaces:
              energyDecimals(repo.summary!.production!),
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
      trailing: _buildHeaderTrailing(context, repo),
    );
  }

  Widget? _buildHeaderTrailing(BuildContext context, EnergyRepository repo) {
    final hasBreakdown = repo.breakdown != null && repo.breakdown!.isNotEmpty;
    final showRangeButton = !widget.embedded && repo.summary != null;

    if (!hasBreakdown && !showRangeButton) return null;

    final children = <Widget>[];

    if (showRangeButton) {
      final localizations = AppLocalizations.of(context)!;
      final rangeOptions = getEnergyRangeOptions(localizations);
      final currentOption = rangeOptions.firstWhere(
        (o) => o.value == repo.selectedRange,
        orElse: () => rangeOptions.first,
      );

      children.add(
        HeaderIconButton(
          icon: currentOption.icon,
          color: ThemeColors.info,
          onTap: () => _showStandaloneRangePopup(context, repo),
        ),
      );
    }

    if (hasBreakdown) {
      children.add(
        HeaderIconButton(
          icon: MdiIcons.podium,
          color: ThemeColors.info,
          onTap: () => _showTopConsumers(context, repo),
        ),
      );
    }

    if (children.length == 1) return children.first;

    return Row(
      mainAxisSize: MainAxisSize.min,
      spacing: AppSpacings.pSm,
      children: children,
    );
  }

  void _showStandaloneRangePopup(BuildContext context, EnergyRepository repo) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;

    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor:
            isDark ? AppFillColorDark.base : AppFillColorLight.base,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
        ),
        contentPadding: AppSpacings.paddingMd,
        content: EnergyRangeOptionsList(
          selectedRange: repo.selectedRange,
          rangeOptions: getEnergyRangeOptions(localizations),
          onSelected: (range) async {
            Navigator.pop(dialogContext);
            await repo.setRange(_homeSpaceId, range);
          },
        ),
      ),
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
          EnergyConsumptionCard(
            summary: repo.summary!,
            selectedRange: repo.selectedRange,
            onRangeBadgeTap: widget.embedded
                ? null
                : () => _showStandaloneRangePopup(context, repo),
          ),
          if (repo.timeseries != null && repo.timeseries!.isNotEmpty)
            Expanded(
              child: EnergyTimeseriesChart(
                timeseries: repo.timeseries!,
                selectedRange: repo.selectedRange,
              ),
            ),
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
            Expanded(
              child: EnergyTimeseriesChart(
                timeseries: repo.timeseries!,
                selectedRange: repo.selectedRange,
              ),
            ),
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
          Expanded(
            child: EnergyConsumptionCard(
              summary: summary,
              selectedRange: repo.selectedRange,
              onRangeBadgeTap: widget.embedded
                  ? null
                  : () => _showStandaloneRangePopup(context, repo),
            ),
          ),
          if (summary.hasProduction) ...[
            BaseCard(
              child: EnergySecondaryValue(
                icon: MdiIcons.solarPower,
                label: localizations.energy_production,
                value: NumberFormatUtils.defaultFormat.formatDecimal(
                  summary.production!,
                  decimalPlaces: energyDecimals(summary.production!),
                ),
                unit: localizations.energy_unit_kwh,
                colorFamily: successFamily,
              ),
            ),
            if (summary.net != null)
              BaseCard(
                child: EnergySecondaryValue(
                  icon: MdiIcons.swapVertical,
                  label: localizations.energy_net,
                  value: NumberFormatUtils.defaultFormat.formatDecimal(
                    summary.net!,
                    decimalPlaces: energyDecimals(summary.net!),
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
  // TOP CONSUMERS (SHEET / DRAWER)
  // =============================================================================

  void _showTopConsumers(BuildContext context, EnergyRepository repo) {
    if (repo.breakdown == null || repo.breakdown!.isEmpty) return;

    final localizations = AppLocalizations.of(context)!;
    final isLandscape = _screenService.isLandscape;
    final devices = repo.breakdown!.devices;
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
