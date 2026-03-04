import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/device_detail_config.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/water_heater.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class WaterHeaterDeviceDetail extends StatefulWidget {
  final WaterHeaterDeviceView _device;
  final VoidCallback? onBack;
  final DeviceDetailConfig? config;

  const WaterHeaterDeviceDetail({
    super.key,
    required WaterHeaterDeviceView device,
    this.onBack,
    this.config,
  }) : _device = device;

  @override
  State<WaterHeaterDeviceDetail> createState() =>
      _WaterHeaterDeviceDetailState();
}

class _WaterHeaterDeviceDetailState extends State<WaterHeaterDeviceDetail> {
  final DevicesService _devicesService = locator<DevicesService>();

  @override
  void initState() {
    super.initState();
    _devicesService.addListener(_onDeviceChanged);
  }

  @override
  void dispose() {
    _devicesService.removeListener(_onDeviceChanged);
    super.dispose();
  }

  void _onDeviceChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  WaterHeaterDeviceView get _device {
    final updated = _devicesService.getDevice(widget._device.id);
    if (updated is WaterHeaterDeviceView) {
      return updated;
    }
    return widget._device;
  }

  String _getStatusLabel(AppLocalizations localizations) {
    if (_device.isOn) {
      return localizations.thermostat_state_heating;
    }
    return localizations.on_state_off;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final body = _buildPlaceholder(context);

    if (!(widget.config?.showHeader ?? true)) return body;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, isDark),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final heatingColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final showBack = widget.config?.showBackButton ?? true;
    final iconData = widget.config?.iconOverride ?? buildDeviceIcon(_device.category, _device.icon);

    return PageHeader(
      title: widget.config?.titleOverride ?? _device.name,
      subtitle: _getStatusLabel(localizations),
      subtitleColor: _device.isOn ? heatingColor : secondaryColor,
      leading: showBack
          ? Row(
              mainAxisSize: MainAxisSize.min,
              spacing: AppSpacings.pMd,
              children: [
                HeaderIconButton(
                  icon: MdiIcons.arrowLeft,
                  onTap: widget.onBack ?? () => Navigator.of(context).pop(),
                ),
                HeaderMainIcon(
                  icon: iconData,
                  color: _device.isOn ? ThemeColors.warning : ThemeColors.neutral,
                ),
              ],
            )
          : HeaderMainIcon(
              icon: iconData,
              color: _device.isOn ? ThemeColors.warning : ThemeColors.neutral,
            ),
    );
  }

  Widget _buildPlaceholder(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Center(
      child: Padding(
        padding: AppSpacings.paddingMd,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          spacing: AppSpacings.pMd,
          children: [
            Icon(
              MdiIcons.alert,
              color: Theme.of(context).warning,
              size: AppSpacings.scale(64),
            ),
            Text(
              localizations.message_error_no_device_detail_preparing_title,
              textAlign: TextAlign.center,
            ),
            Text(
              localizations
                  .message_error_no_device_detail_preparing_description,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
