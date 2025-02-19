import 'dart:io';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';

class AboutPage extends StatefulWidget {
  const AboutPage({super.key});

  @override
  State<AboutPage> createState() => _AboutPageState();
}

class _AboutPageState extends State<AboutPage> {
  final ScreenService _screenService = locator<ScreenService>();

  String _appVersion = 'Loading...';
  String _ipAddress = 'Loading...';
  String _macAddress = 'Loading...';
  String _cpuUsage = 'Loading...';
  String _memoryUsage = 'Loading...';

  @override
  void initState() {
    super.initState();

    _fetchDeviceInfo();
  }

  Future<void> _fetchDeviceInfo() async {
    try {
      // Fetch app version
      final packageInfo = await PackageInfo.fromPlatform();

      setState(() {
        _appVersion = packageInfo.version;
      });
    } catch (e) {
      // Handle error gracefully
      setState(() {
        _appVersion = 'Error';
      });
    }

    try {
      // Fetch network information
      final networkInfo = NetworkInfo();
      final ipAddress = await networkInfo.getWifiIP();
      final macAddress = await networkInfo.getWifiBSSID();

      setState(() {
        _ipAddress = ipAddress ?? 'Unknown';
        _macAddress = macAddress ?? 'Unknown';
      });
    } catch (e) {
      // Handle error gracefully
      setState(() {
        _ipAddress = 'Error';
        _macAddress = 'Error';
      });
    }

    try {
      // Fetch system information
      final cpuUsage = await _getCpuUsage();
      final memoryUsage = await _getMemoryUsage();

      setState(() {
        _cpuUsage = cpuUsage;
        _memoryUsage = memoryUsage;
      });
    } catch (e) {
      // Handle error gracefully
      setState(() {
        _cpuUsage = 'Error';
        _memoryUsage = 'Error';
      });
    }
  }

  Future<String> _getCpuUsage() async {
    try {
      final lines = await File('/proc/stat').readAsLines();
      final cpuLine = lines.firstWhere((line) => line.startsWith('cpu '));
      final values =
          cpuLine.split(' ').where((value) => value.isNotEmpty).toList();
      final user = int.parse(values[1]);
      final nice = int.parse(values[2]);
      final system = int.parse(values[3]);
      final idle = int.parse(values[4]);

      final total = user + nice + system + idle;
      final usage = ((user + nice + system) / total) * 100;

      return '${usage.toStringAsFixed(1)}%';
    } catch (e) {
      return 'Error';
    }
  }

  Future<String> _getMemoryUsage() async {
    try {
      final lines = await File('/proc/meminfo').readAsLines();
      final totalMemoryLine =
          lines.firstWhere((line) => line.startsWith('MemTotal:'));
      final freeMemoryLine =
          lines.firstWhere((line) => line.startsWith('MemFree:'));

      final totalMemory = int.parse(totalMemoryLine.split(RegExp(r'\s+'))[1]);
      final freeMemory = int.parse(freeMemoryLine.split(RegExp(r'\s+'))[1]);

      final usedMemory = totalMemory - freeMemory;
      return '${(usedMemory / 1024).toStringAsFixed(1)} MB';
    } catch (e) {
      return 'Error';
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: ScreenAppBar(
        title: localizations.settings_about_title,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // App Icon and Title
              Center(
                child: Column(
                  children: [
                    Icon(
                      Symbols.settings,
                      size: _screenService.scale(72),
                    ),
                    AppSpacings.spacingLgVertical,
                    Text(
                      'FastyBird! Smart Panel',
                      style: TextStyle(
                        fontSize: AppFontSize.large,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    AppSpacings.spacingSmVertical,
                    Text(
                      'Version $_appVersion',
                      style: TextStyle(
                        fontSize: AppFontSize.extraSmall,
                        color: Colors.grey,
                      ),
                    ),
                  ],
                ),
              ),

              AppSpacings.spacingLgVertical,

              Text(
                localizations.settings_about_about_heading,
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.bold,
                ),
              ),
              AppSpacings.spacingSmVertical,
              Text(
                localizations.settings_about_about_info,
                textAlign: TextAlign.justify,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall,
                ),
              ),

              AppSpacings.spacingLgVertical,

              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          localizations.settings_about_developed_by_heading,
                          style: TextStyle(
                            fontSize: AppFontSize.base,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        AppSpacings.spacingSmVertical,
                        Text(
                          'FastyBird Team',
                          style: TextStyle(
                            fontSize: AppFontSize.extraSmall,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'https://fastybird.com',
                          style: TextStyle(
                            fontSize: AppFontSize.extraSmall,
                            color: AppColorsLight.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          localizations.settings_about_license_heading,
                          style: TextStyle(
                            fontSize: AppFontSize.base,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        AppSpacings.spacingSmVertical,
                        TextButton(
                          onPressed: () {
                            // Navigate to Open Source Licenses page
                          },
                          style: OutlinedButton.styleFrom(
                            padding: EdgeInsets.symmetric(
                              vertical: AppSpacings.pSm,
                              horizontal: AppSpacings.pSm,
                            ),
                          ),
                          child: Text(
                            localizations.settings_about_show_license_button,
                            style: TextStyle(
                              fontSize: AppFontSize.extraSmall,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              AppSpacings.spacingLgVertical,

              // Device Info Section
              Text(
                localizations.settings_about_device_information_heading,
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.bold,
                ),
              ),
              AppSpacings.spacingSmVertical,
              Wrap(
                spacing: AppSpacings.pSm,
                runSpacing: AppSpacings.pSm,
                children: [
                  SizedBox(
                    width: MediaQuery.of(context).size.width / 2 -
                        AppSpacings.pMd -
                        AppSpacings.pSm,
                    child: _buildInfoTile(
                      context,
                      Symbols.lan,
                      localizations.settings_about_ip_address_title,
                      _ipAddress,
                    ),
                  ),
                  SizedBox(
                    width: MediaQuery.of(context).size.width / 2 -
                        AppSpacings.pMd -
                        AppSpacings.pSm,
                    child: _buildInfoTile(
                      context,
                      Symbols.host,
                      localizations.settings_about_mac_address_title,
                      _macAddress,
                    ),
                  ),
                  SizedBox(
                    width: MediaQuery.of(context).size.width / 2 -
                        AppSpacings.pMd -
                        AppSpacings.pSm,
                    child: _buildInfoTile(
                      context,
                      Symbols.earthquake,
                      localizations.settings_about_cpu_usage_title,
                      _cpuUsage,
                    ),
                  ),
                  SizedBox(
                    width: MediaQuery.of(context).size.width / 2 -
                        AppSpacings.pMd -
                        AppSpacings.pSm,
                    child: _buildInfoTile(
                      context,
                      Symbols.memory,
                      localizations.settings_about_memory_usage_title,
                      _memoryUsage,
                    ),
                  ),
                  // Add more ListTiles here in the same pattern for CPU and Memory
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoTile(
    BuildContext context,
    IconData icon,
    String title,
    String value,
  ) {
    return SizedBox(
      width: MediaQuery.of(context).size.width / 2 - AppSpacings.pMd * 2,
      child: Material(
        elevation: 0,
        color: Colors.transparent,
        child: ListTile(
          contentPadding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pSm,
          ),
          dense: true,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
            side: BorderSide(
              color: Theme.of(context).brightness == Brightness.light
                  ? AppBorderColorLight.base
                  : AppBorderColorDark.base,
              width: _screenService.scale(1),
            ),
          ),
          textColor: Theme.of(context).brightness == Brightness.light
              ? AppTextColorLight.regular
              : AppTextColorDark.regular,
          leading: Icon(
            icon,
            size: AppFontSize.large,
          ),
          title: Text(
            title,
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w600,
            ),
          ),
          subtitle: Text(
            value,
            style: TextStyle(
              fontSize: _screenService.scale(8),
            ),
          ),
        ),
      ),
    );
  }
}
