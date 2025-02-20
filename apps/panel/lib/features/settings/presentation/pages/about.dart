import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/general/system.dart';
import 'package:fastybird_smart_panel/core/repositories/system_module.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
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
  final SystemModuleRepository _repository = locator<SystemModuleRepository>();

  String _appVersion = 'Loading...';
  String _ipAddress = 'Loading...';
  String _macAddress = 'Loading...';

  late double _cpuLoad;
  late int _memoryUsed;

  @override
  void initState() {
    super.initState();

    _fetchDeviceInfo();

    _syncStateWithRepository();

    _repository.addListener(_syncStateWithRepository);
  }

  @override
  void dispose() {
    super.dispose();

    _repository.removeListener(_syncStateWithRepository);
  }

  void _syncStateWithRepository() {
    SystemInfoModel systemInfo = _repository.systemInfo;

    setState(() {
      _cpuLoad = systemInfo.cpuLoad;
      _memoryUsed = systemInfo.memory.used;
    });
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
                            fontSize: _screenService.scale(8),
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
                  _renderInfoTile(
                    context: context,
                    icon: Symbols.earthquake,
                    title: localizations.settings_about_cpu_usage_title,
                    value: _ipAddress,
                  ),
                  _renderInfoTile(
                    context: context,
                    icon: Symbols.host,
                    title: localizations.settings_about_mac_address_title,
                    value: _macAddress,
                  ),
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

  Widget _renderCpuUsageTile(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return _renderInfoTile(
      context: context,
      icon: Symbols.earthquake,
      title: localizations.settings_about_cpu_usage_title,
      value: NumberUtils.formatNumber(_cpuLoad, 2),
      unit: '%',
    );
  }

  Widget _renderMemoryUsageTile(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    double memoryUsed = _memoryUsed.toDouble() / 1024 / 1024;

    return _renderInfoTile(
      context: context,
      icon: Symbols.memory,
      title: localizations.settings_about_memory_usage_title,
      value: NumberUtils.formatNumber(memoryUsed, 0),
      unit: 'MB',
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
          leading: showLoading
              ? CircularProgressIndicator()
              : Icon(
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
          subtitle: Row(
            mainAxisAlignment: MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: _screenService.scale(8),
                  fontWeight: FontWeight.w600,
                ),
              ),
              unit != null ? AppSpacings.spacingXsHorizontal : null,
              unit != null
                  ? Text(
                      unit,
                      style: TextStyle(
                        fontSize: _screenService.scale(7),
                      ),
                    )
                  : null
            ].whereType<Widget>().toList(),
          ),
        ),
      ),
    );
  }
}
