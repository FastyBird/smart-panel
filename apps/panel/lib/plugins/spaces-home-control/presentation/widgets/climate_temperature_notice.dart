import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/climate_state/climate_state.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Explains withheld room readings without changing individual device
/// controls: a danger line under the Climate header (design canvas, "Room
/// temperature notice").
class ClimateTemperatureNotice extends StatelessWidget {
  final ClimateTemperatureContribution? contribution;

  /// The class to render at; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  const ClimateTemperatureNotice({
    super.key,
    this.contribution,
    this.sizeClass,
  });

  /// The notice is one touch target high at least.
  static const double minHeight = 36;
  static const double iconSize = 14;

  @override
  Widget build(BuildContext context) {
    if (contribution?.isUnavailable != true) return const SizedBox.shrink();
    final localizations = AppLocalizations.of(context)!;
    final danger = Theme.of(context).status(AppStatus.danger);
    final metrics = PageHeaderMetrics.of(
      sizeClass ?? locator<ScreenService>().sizeClass,
    );

    return Semantics(
      liveRegion: true,
      container: true,
      child: Container(
        width: double.infinity,
        constraints: BoxConstraints(minHeight: AppSpacings.scale(minHeight)),
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pSmMd,
        ),
        decoration: BoxDecoration(
          color: danger.soft,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(color: danger.border, width: AppSpacings.scale(1)),
        ),
        child: Row(
          spacing: AppSpacings.pSmMd,
          children: [
            Icon(
              MdiIcons.alertOutline,
              size: AppSpacings.scale(iconSize),
              color: danger.text,
            ),
            Expanded(
              child: Text(
                contribution!.hasConflict
                    ? localizations.climate_temperature_coverage_conflict
                    : localizations.climate_temperature_coverage_unavailable,
                style: TextStyle(
                  color: Theme.of(context).neutrals.textPrimary,
                  fontSize: metrics.stateFontSize,
                  height: 1.3,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
