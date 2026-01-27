import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/intent_result/intent_result.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Utility for handling intent results and showing appropriate UI feedback.
///
/// This class provides static methods to check intent results for offline
/// devices and show alerts to the user when devices are skipped.
class IntentResultHandler {
  /// Shows an alert if any devices were skipped due to being offline.
  ///
  /// Returns true if an alert was shown, false otherwise.
  static bool showOfflineAlertIfNeeded(
    BuildContext context,
    LightingIntentResult? result,
  ) {
    if (kDebugMode) {
      debugPrint(
        '[IntentResultHandler] showOfflineAlertIfNeeded: result=${result != null ? "success=${result.success}, affected=${result.affectedDevices}, failed=${result.failedDevices}, skipped=${result.skippedOfflineDevices}" : "null"}',
      );
    }
    if (result == null) return false;
    return _showOfflineAlert(
      context,
      result.skippedOfflineDevices,
      result.success,
      result.affectedDevices,
    );
  }

  /// Shows an alert if any devices were skipped due to being offline.
  ///
  /// Returns true if an alert was shown, false otherwise.
  static bool showOfflineAlertIfNeededForClimate(
    BuildContext context,
    ClimateIntentResult? result,
  ) {
    if (result == null) return false;
    return _showOfflineAlert(
      context,
      result.skippedOfflineDevices,
      result.success,
      result.affectedDevices,
    );
  }

  /// Shows an alert if any devices were skipped due to being offline.
  ///
  /// Returns true if an alert was shown, false otherwise.
  static bool showOfflineAlertIfNeededForCovers(
    BuildContext context,
    CoversIntentResult? result,
  ) {
    if (result == null) return false;
    return _showOfflineAlert(
      context,
      result.skippedOfflineDevices,
      result.success,
      result.affectedDevices,
    );
  }

  /// Shows an alert if any devices were skipped due to being offline.
  ///
  /// Returns true if an alert was shown, false otherwise.
  static bool showOfflineAlertIfNeededForMedia(
    BuildContext context,
    MediaIntentResult? result,
  ) {
    if (result == null) return false;
    return _showOfflineAlert(
      context,
      result.skippedOfflineDevices,
      result.success,
      result.affectedDevices,
    );
  }

  static bool _showOfflineAlert(
    BuildContext context,
    int? skippedOfflineDevices,
    bool success,
    int affectedDevices,
  ) {
    if (kDebugMode) {
      debugPrint(
        '[IntentResultHandler] _showOfflineAlert: skipped=$skippedOfflineDevices, success=$success, affected=$affectedDevices',
      );
    }

    final localizations = AppLocalizations.of(context);
    if (localizations == null) {
      if (kDebugMode) {
        debugPrint('[IntentResultHandler] localizations is null');
      }
      return false;
    }

    // If no devices were skipped, no alert needed
    if (skippedOfflineDevices == null || skippedOfflineDevices == 0) {
      if (kDebugMode) {
        debugPrint('[IntentResultHandler] No devices skipped, returning false');
      }
      return false;
    }

    // If all devices were offline (no devices affected and not successful)
    if (!success && affectedDevices == 0) {
      AlertBar.showWarning(
        context,
        message: localizations.all_devices_offline,
        duration: const Duration(seconds: 5),
      );
      return true;
    }

    // Some devices were offline but some succeeded
    AlertBar.showInfo(
      context,
      message: localizations.devices_offline_skipped(skippedOfflineDevices),
      duration: const Duration(seconds: 4),
    );
    return true;
  }
}
