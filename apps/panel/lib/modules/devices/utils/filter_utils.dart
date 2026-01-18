import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

/// Utility class for filter channel related label conversions.
/// Used by air purifier and other devices with filter monitoring.
class FilterUtils {
  /// Get human-readable label for filter status.
  static String getStatusLabel(
    AppLocalizations localizations,
    FilterStatusValue? status,
  ) {
    if (status == null) return localizations.filter_status_unknown;
    switch (status) {
      case FilterStatusValue.good:
        return localizations.filter_status_good;
      case FilterStatusValue.replaceSoon:
        return localizations.filter_status_replace_soon;
      case FilterStatusValue.replaceNow:
        return localizations.filter_status_replace_now;
    }
  }

  /// Check if filter needs replacement based on status.
  static bool needsReplacement(FilterStatusValue? status) {
    return status == FilterStatusValue.replaceNow ||
        status == FilterStatusValue.replaceSoon;
  }

  /// Check if filter status is good.
  static bool isGood(FilterStatusValue? status) {
    return status == FilterStatusValue.good;
  }
}
