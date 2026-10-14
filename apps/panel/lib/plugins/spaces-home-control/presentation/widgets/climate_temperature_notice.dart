import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/climate_state/climate_state.dart';
import 'package:flutter/material.dart';

/// Explains withheld room readings without changing individual device controls.
class ClimateTemperatureNotice extends StatelessWidget {
  final ClimateTemperatureContribution? contribution;

  const ClimateTemperatureNotice({super.key, this.contribution});

  @override
  Widget build(BuildContext context) {
    if (contribution?.isUnavailable != true) return const SizedBox.shrink();
    final localizations = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Semantics(
        liveRegion: true,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.errorContainer,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            contribution!.hasConflict
                ? localizations.climate_temperature_coverage_conflict
                : localizations.climate_temperature_coverage_unavailable,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onErrorContainer,
            ),
          ),
        ),
      ),
    );
  }
}
