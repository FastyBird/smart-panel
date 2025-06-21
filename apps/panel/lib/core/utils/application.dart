import 'dart:io';

import 'package:package_info_plus/package_info_plus.dart';

class AppInfo {
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
