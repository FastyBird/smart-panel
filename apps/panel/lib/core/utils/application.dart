import 'dart:convert';
import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:uuid/uuid.dart';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:fastybird_smart_panel/core/utils/secure_storage.dart';

class AppInfo {
  /// Cached device info to avoid repeated calls
  static AndroidDeviceInfo? _cachedAndroidInfo;

  /// Key for storing persistent device ID
  static const String _deviceIdKey = 'device_unique_id';

  /// Get Android device info (cached)
  static Future<AndroidDeviceInfo?> _getAndroidDeviceInfo() async {
    if (_cachedAndroidInfo != null) {
      return _cachedAndroidInfo;
    }

    if (!Platform.isAndroid) return null;

    try {
      final deviceInfo = DeviceInfoPlugin();

      _cachedAndroidInfo = await deviceInfo.androidInfo;

      return _cachedAndroidInfo;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[APP INFO] Error getting Android device info: $e');
      }
    }

    return null;
  }

  /// Check if running on Android emulator
  static Future<bool> isAndroidEmulator() async {
    if (!Platform.isAndroid) return false;

    final info = await _getAndroidDeviceInfo();

    if (info != null) {
      // device_info_plus provides isPhysicalDevice flag
      final isEmulator = !info.isPhysicalDevice;

      if (kDebugMode) {
        debugPrint(
          '[APP INFO] isPhysicalDevice: ${info.isPhysicalDevice}, isEmulator: $isEmulator',
        );
      }

      return isEmulator;
    }

    return false;
  }

  /// Get or create a persistent unique device identifier
  /// This is stored in secure storage and persists across app restarts
  /// Each emulator/device has its own isolated storage, so IDs will be unique
  static Future<String> getPersistentDeviceId() async {
    try {
      String? storedId;

      // Read existing ID from storage
      if (Platform.isAndroid || Platform.isIOS) {
        final storage = const FlutterSecureStorage();

        storedId = await storage.read(key: _deviceIdKey);

        if (storedId == null || storedId.isEmpty) {
          // Generate new UUID and store it
          storedId = const Uuid().v4();

          await storage.write(key: _deviceIdKey, value: storedId);

          if (kDebugMode) {
            debugPrint('[APP INFO] Generated new device ID: $storedId');
          }
        } else {
          if (kDebugMode) {
            debugPrint('[APP INFO] Using stored device ID: $storedId');
          }
        }
      } else {
        // Linux/other platforms
        final storage = SecureStorageFallback();

        storedId = await storage.read(key: _deviceIdKey);

        if (storedId == null || storedId.isEmpty) {
          storedId = const Uuid().v4();

          await storage.write(key: _deviceIdKey, value: storedId);

          if (kDebugMode) {
            debugPrint('[APP INFO] Generated new device ID: $storedId');
          }
        } else {
          if (kDebugMode) {
            debugPrint('[APP INFO] Using stored device ID: $storedId');
          }
        }
      }

      return storedId;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[APP INFO] Error getting persistent device ID: $e');
      }

      // Fallback to a random ID (won't persist but at least works)
      return const Uuid().v4();
    }
  }

  /// Convert a string to MAC address format using hash
  /// Takes first 12 hex characters from hash to form XX:XX:XX:XX:XX:XX
  static String stringToMacFormat(String input) {
    // Use a simple hash to generate consistent bytes
    final bytes = utf8.encode(input);
    var hash = 0;

    for (final byte in bytes) {
      hash = ((hash << 5) - hash + byte) & 0xFFFFFFFFFFFF;
    }

    // If input is long enough, use characters directly to get more uniqueness
    final hexString = hash.toRadixString(16).padLeft(12, '0').substring(0, 12);

    // Format as MAC address, set locally administered bit (second nibble odd)
    final parts = <String>[];

    for (var i = 0; i < 12; i += 2) {
      var part = hexString.substring(i, i + 2);

      // For the first octet, set the locally administered bit (bit 1)
      // This indicates a locally generated MAC address
      if (i == 0) {
        final firstOctet = int.parse(part, radix: 16);
        final locallyAdministered = (firstOctet | 0x02) & 0xFE;

        part = locallyAdministered.toRadixString(16).padLeft(2, '0');
      }

      parts.add(part);
    }

    return parts.join(':');
  }

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
    // For Android/iOS, use persistent device ID to generate a unique MAC
    // Each emulator/device has isolated storage, so IDs will be unique
    if (Platform.isAndroid || Platform.isIOS) {
      final deviceId = await getPersistentDeviceId();

      final generatedMac = stringToMacFormat('device:$deviceId');

      if (kDebugMode) {
        debugPrint(
          '[APP INFO] Generated MAC from persistent device ID "$deviceId": $generatedMac',
        );
      }

      return generatedMac;
    }

    // For Linux (Raspberry Pi), try to read real MAC address
    if (Platform.isLinux) {
      try {
        final result =
            await Process.run('cat', ['/sys/class/net/$interface/address']);

        if (result.exitCode == 0) {
          final mac = (result.stdout as String).trim();

          // Check if it's a valid, non-zero MAC address
          if (mac.isNotEmpty && mac != '00:00:00:00:00:00') {
            return mac;
          }
        }
      } catch (_) {}
    }

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
