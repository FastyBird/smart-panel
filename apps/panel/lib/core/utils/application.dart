import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';

class AppInfo {
  /// Detects if the device has audio output capability (speakers)
  static Future<bool> hasAudioOutputSupport() async {
    try {
      if (Platform.isAndroid) {
        // Check Android device features for audio output
        final result = await Process.run('pm', ['list', 'features']);

        if (result.exitCode == 0) {
          final output = result.stdout as String;

          return output.contains('android.hardware.audio.output');
        }

        return false;
      }

      if (Platform.isIOS) {
        // iOS devices always have speakers
        return true;
      }

      if (Platform.isLinux) {
        // Check for playback devices on Linux (Raspberry Pi)
        final result = await Process.run('aplay', ['-l']);

        if (result.exitCode == 0) {
          final output = result.stdout as String;
          // Check if there are any playback devices listed
          return output.contains('card') && !output.contains('no soundcards');
        }

        // Fallback: check /proc/asound/cards
        final cardsFile = File('/proc/asound/cards');

        if (await cardsFile.exists()) {
          final content = await cardsFile.readAsString();

          return content.trim().isNotEmpty;
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[APP INFO] Error detecting audio output support: $e');
      }
    }

    return false;
  }

  /// Detects if the device has audio input capability (microphone)
  static Future<bool> hasAudioInputSupport() async {
    try {
      if (Platform.isAndroid) {
        // Check Android device features for microphone
        final result = await Process.run('pm', ['list', 'features']);

        if (result.exitCode == 0) {
          final output = result.stdout as String;

          return output.contains('android.hardware.microphone');
        }

        return false;
      }

      if (Platform.isIOS) {
        // iOS devices always have microphones
        return true;
      }

      if (Platform.isLinux) {
        // Check for recording devices on Linux (Raspberry Pi)
        final result = await Process.run('arecord', ['-l']);

        if (result.exitCode == 0) {
          final output = result.stdout as String;
          // Check if there are any recording devices listed
          return output.contains('card') && !output.contains('no soundcards');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[APP INFO] Error detecting audio input support: $e');
      }
    }

    return false;
  }

  static Future<AppVersion> getAppVersionInfo() async {
    const String envVersion = String.fromEnvironment(
      'APP_VERSION',
      defaultValue: '',
    );
    const String envBuild = String.fromEnvironment(
      'APP_BUILD',
      defaultValue: '',
    );

    String version = envVersion;
    String build = envBuild;

    if (version.isEmpty || build.isEmpty) {
      try {
        final info = await PackageInfo.fromPlatform();

        version = version.isNotEmpty ? version : info.version;
        build = build.isNotEmpty ? build : info.buildNumber;
      } catch (e) {
        throw StateError('Failed to load PackageInfo: $e');
      }
    }

    // Final fallback for emulators or missing info
    version = version.isNotEmpty ? version : '0.0.0';
    build = build.isNotEmpty ? build : '0';

    return AppVersion(
      version: version,
      build: build,
    );
  }

  static Future<String> getMacAddress([String interface = 'eth0']) async {
    try {
      final result =
          await Process.run('cat', ['/sys/class/net/$interface/address']);

      if (result.exitCode == 0) {
        final mac = (result.stdout as String).trim();

        if (mac.isNotEmpty) {
          return mac;
        }
      }
    } catch (_) {}

    // Return dummy MAC if real one can't be retrieved
    return '00:00:00:00:00:00';
  }
}

class AppVersion {
  final String version;
  final String build;

  const AppVersion({
    required this.version,
    required this.build,
  });

  @override
  String toString() => 'v$version+$build';
}
