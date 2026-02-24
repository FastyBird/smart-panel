import 'dart:io';

import 'package:flutter/foundation.dart';

/// Service for executing platform-level actions (reboot, power off)
/// directly on the device the panel app is running on.
///
/// Used in gateway mode where the display needs to control itself
/// instead of relying on the backend (which runs on a different device).
class PlatformActionsService {
  /// Reboot the device the panel is running on.
  ///
  /// On Linux: uses 'sudo /sbin/reboot'
  /// On Android: uses 'reboot' (requires root)
  Future<bool> reboot() async {
    try {
      if (Platform.isLinux) {
        final result = await Process.run('sudo', ['/sbin/reboot']);

        if (result.exitCode == 0) {
          if (kDebugMode) {
            debugPrint('[PLATFORM ACTIONS] Reboot command sent successfully');
          }
          return true;
        }

        if (kDebugMode) {
          debugPrint(
            '[PLATFORM ACTIONS] Reboot command failed with exit code: ${result.exitCode}, '
            'stderr: ${result.stderr}',
          );
        }
        return false;
      }

      if (Platform.isAndroid) {
        final result = await Process.run('reboot', []);

        if (result.exitCode == 0) {
          if (kDebugMode) {
            debugPrint('[PLATFORM ACTIONS] Reboot command sent successfully');
          }
          return true;
        }

        if (kDebugMode) {
          debugPrint(
            '[PLATFORM ACTIONS] Reboot command failed with exit code: ${result.exitCode}, '
            'stderr: ${result.stderr}',
          );
        }
        return false;
      }

      if (kDebugMode) {
        debugPrint(
          '[PLATFORM ACTIONS] Reboot not supported on this platform: ${Platform.operatingSystem}',
        );
      }
      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[PLATFORM ACTIONS] Reboot failed with error: $e');
      }
      return false;
    }
  }

  /// Power off the device the panel is running on.
  ///
  /// On Linux: uses 'sudo /sbin/poweroff'
  /// On Android: uses 'reboot -p' (requires root)
  Future<bool> powerOff() async {
    try {
      if (Platform.isLinux) {
        final result = await Process.run('sudo', ['/sbin/poweroff']);

        if (result.exitCode == 0) {
          if (kDebugMode) {
            debugPrint('[PLATFORM ACTIONS] Power off command sent successfully');
          }
          return true;
        }

        if (kDebugMode) {
          debugPrint(
            '[PLATFORM ACTIONS] Power off command failed with exit code: ${result.exitCode}, '
            'stderr: ${result.stderr}',
          );
        }
        return false;
      }

      if (Platform.isAndroid) {
        final result = await Process.run('reboot', ['-p']);

        if (result.exitCode == 0) {
          if (kDebugMode) {
            debugPrint('[PLATFORM ACTIONS] Power off command sent successfully');
          }
          return true;
        }

        if (kDebugMode) {
          debugPrint(
            '[PLATFORM ACTIONS] Power off command failed with exit code: ${result.exitCode}, '
            'stderr: ${result.stderr}',
          );
        }
        return false;
      }

      if (kDebugMode) {
        debugPrint(
          '[PLATFORM ACTIONS] Power off not supported on this platform: ${Platform.operatingSystem}',
        );
      }
      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[PLATFORM ACTIONS] Power off failed with error: $e');
      }
      return false;
    }
  }
}
