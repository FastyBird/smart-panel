import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/water_heater.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class WaterHeaterDeviceDetail extends StatefulWidget {
  final WaterHeaterDeviceView _device;
  final VoidCallback? onBack;

  const WaterHeaterDeviceDetail({
    super.key,
    required WaterHeaterDeviceView device,
    this.onBack,
  }) : _device = device;

  @override
  State<WaterHeaterDeviceDetail> createState() =>
      _WaterHeaterDeviceDetailState();
}

class _WaterHeaterDeviceDetailState extends State<WaterHeaterDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
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

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  String _getStatusLabel(AppLocalizations localizations) {
    if (_device.isOn) {
      return localizations.thermostat_state_heating;
    }
    return localizations.on_state_off;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.base : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, isDark),
            Expanded(
              child: _buildPlaceholder(context),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final heatingColor = DeviceColors.heating(isDark);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    return PageHeader(
      title: _device.name,
      subtitle: _getStatusLabel(localizations),
      subtitleColor: _device.isOn ? heatingColor : secondaryColor,
      backgroundColor: AppColors.blank,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: widget.onBack ?? () => Navigator.of(context).pop(),
          ),
          AppSpacings.spacingMdHorizontal,
          Container(
            width: _scale(44),
            height: _scale(44),
            decoration: BoxDecoration(
              color: _device.isOn
                  ? DeviceColors.heatingLight9(isDark)
                  : (isDark
                      ? AppFillColorDark.darker
                      : AppFillColorLight.darker),
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Icon(
              MdiIcons.waterBoiler,
              color: _device.isOn ? heatingColor : mutedColor,
              size: _scale(24),
            ),
          ),
        ],
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
          children: [
            Icon(
              MdiIcons.alert,
              color: Theme.of(context).warning,
              size: _scale(64),
            ),
            AppSpacings.spacingMdVertical,
            Text(
              localizations.message_error_no_device_detail_preparing_title,
              textAlign: TextAlign.center,
            ),
            AppSpacings.spacingSmVertical,
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
