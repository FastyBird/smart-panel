import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/system/export.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';

class AboutPage extends StatefulWidget {
  const AboutPage({super.key});

  @override
  State<AboutPage> createState() => _AboutPageState();
}

class _AboutPageState extends State<AboutPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  String _appVersion = 'Loading...';

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
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: AppTopBar(
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
                      MdiIcons.cogOutline,
                      size: _screenService.scale(
                        72,
                        density: _visualDensityService.density,
                      ),
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
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.secondary
                            : AppTextColorDark.secondary,
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
                        AppSpacings.spacingMdVertical,
                        Text(
                          'FastyBird Team',
                          style: TextStyle(
                            fontSize: AppFontSize.extraSmall,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        AppSpacings.spacingSmVertical,
                        Text(
                          'https://fastybird.com',
                          style: TextStyle(
                            fontSize: _screenService.scale(
                              8,
                              density: _visualDensityService.density,
                            ),
                            color: AppColorsLight.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      spacing: AppSpacings.pSm,
                      children: [
                        Text(
                          localizations.settings_about_license_heading,
                          style: TextStyle(
                            fontSize: AppFontSize.base,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
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
                  _renderIpAddressTile(context),
                  _renderMacAddressTile(context),
                  _renderCpuUsageTile(context),
                  _renderMemoryUsageTile(context),
                  // Add more ListTiles here in the same pattern for CPU and Memory
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _renderIpAddressTile(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Consumer<SystemService>(
      builder: (
        context,
        systemService,
        _,
      ) {
        String? ipAddress = systemService.getSystemInfo()?.ipAddress;

        return _renderInfoTile(
          context: context,
          icon: MdiIcons.lan,
          title: localizations.settings_about_ip_address_title,
          value: ipAddress ?? localizations.value_not_available,
        );
      },
    );
  }

  Widget _renderMacAddressTile(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Consumer<SystemService>(
      builder: (
        context,
        systemService,
        _,
      ) {
        String? macAddress = systemService.getSystemInfo()?.macAddress;

        return _renderInfoTile(
          context: context,
          icon: MdiIcons.server,
          title: localizations.settings_about_mac_address_title,
          value: macAddress ?? localizations.value_not_available,
        );
      },
    );
  }

  Widget _renderCpuUsageTile(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Consumer<SystemService>(
      builder: (
        context,
        systemService,
        _,
      ) {
        double? cpuLoad = systemService.getSystemInfo()?.cpuLoad;

        return _renderInfoTile(
          context: context,
          icon: MdiIcons.gauge,
          title: localizations.settings_about_cpu_usage_title,
          value: cpuLoad != null
              ? NumberUtils.formatNumber(cpuLoad, 2)
              : NumberUtils.formatUnavailableNumber(2),
          unit: '%',
        );
      },
    );
  }

  Widget _renderMemoryUsageTile(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Consumer<SystemService>(
      builder: (
        context,
        systemService,
        _,
      ) {
        double? memoryUsed = systemService.getSystemInfo()?.memoryUsed.toDouble();

        return _renderInfoTile(
          context: context,
          icon: MdiIcons.memory,
          title: localizations.settings_about_memory_usage_title,
          value: memoryUsed != null
              ? NumberUtils.formatNumber(memoryUsed / 1024 / 1024, 0)
              : NumberUtils.formatUnavailableNumber(0),
          unit: 'MB',
        );
      },
    );
  }

  Widget _renderInfoTile({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String value,
    String? unit,
    bool showLoading = false,
  }) {
    return SizedBox(
      width: MediaQuery.of(context).size.width / 2 - // 2 columns layout
          AppSpacings.pMd - // Screen vertical margin
          AppSpacings.pSm / 2, // Grid spacing
      child: Material(
        elevation: 0,
        color: AppColors.blank,
        child: ListTile(
          leading: showLoading
              ? CircularProgressIndicator()
              : Icon(
                  icon,
                  size: AppFontSize.large,
                ),
          title: Column(
            mainAxisAlignment: MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.start,
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    value,
                    style: TextStyle(
                      fontSize: _screenService.scale(
                        8,
                        density: _visualDensityService.density,
                      ),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  unit != null ? AppSpacings.spacingXsHorizontal : null,
                  unit != null
                      ? Text(
                          unit,
                          style: TextStyle(
                            fontSize: _screenService.scale(
                              7,
                              density: _visualDensityService.density,
                            ),
                          ),
                        )
                      : null
                ].whereType<Widget>().toList(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
