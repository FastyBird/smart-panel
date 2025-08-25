import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/data_sources/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/utils/value.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/device_channel.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class DeviceChannelDataSourceWidget
    extends DataSourceWidget<DeviceChannelDataSourceView> {
  const DeviceChannelDataSourceWidget(super.dataSource, {super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<DevicesService>(builder: (
      context,
      devicesService,
      _,
    ) {
      final DeviceView? device = devicesService.getDevice(dataSource.device);

      if (device == null) {
        return _renderLoader(context);
      }

      final ChannelView? channel = device.getChannel(dataSource.channel);

      if (channel == null) {
        return _renderError(context);
      }

      final ChannelPropertyView? property = channel.getProperty(
        dataSource.property,
      );

      if (property == null) {
        return _renderError(context);
      }

      final List<Widget> parts = [
        Icon(
          _getIcon(property),
          size: AppFontSize.small,
        ),
        AppSpacings.spacingSmHorizontal,
        Text(
          _getValue(property, context),
          style: TextStyle(
            fontFamily: 'DIN1451',
            fontSize: AppFontSize.small,
          ),
        ),
      ];

      final String? unit = property.unit;

      if (unit != null && property.value != null) {
        parts.add(
          Text(
            unit,
            style: TextStyle(
              fontFamily: 'DIN1451',
              fontSize: AppFontSize.small,
            ),
          ),
        );
      }

      return Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisAlignment: MainAxisAlignment.start,
        children: parts,
      );
    });
  }

  IconData _getIcon(ChannelPropertyView property) {
    IconData? dataSourceIcon = dataSource.icon;

    if (dataSourceIcon != null) {
      return dataSourceIcon;
    }

    return buildChannelPropertyIcon(property.category);
  }

  String _getValue(ChannelPropertyView property, BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final value = property.value;

    switch (property.category) {
      case ChannelPropertyCategory.on:
        final isOn = value is BooleanValueType ? value.value : false;

        return isOn ? localizations.on_state_on : localizations.on_state_off;
      default:
        if (value is BooleanValueType) {
          return value.value
              ? localizations.on_state_on
              : localizations.on_state_off;
        }

        return ValueUtils.formatValue(property) ??
            localizations.value_not_available;
    }
  }

  Widget _renderLoader(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      mainAxisAlignment: MainAxisAlignment.start,
      children: [
        SizedBox(
          width: AppFontSize.extraSmall,
          height: AppFontSize.extraSmall,
          child: Theme(
            data: ThemeData(
              progressIndicatorTheme: ProgressIndicatorThemeData(
                color: Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.info
                    : AppColorsDark.info,
                linearTrackColor: AppColors.blank,
              ),
            ),
            child: const CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
        AppSpacings.spacingSmHorizontal,
        Text(
          localizations.value_loading,
          style: TextStyle(
            fontFamily: 'DIN1451',
            fontSize: AppFontSize.small,
          ),
        ),
      ],
    );
  }

  Widget _renderError(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      mainAxisAlignment: MainAxisAlignment.start,
      children: [
        Icon(
          MdiIcons.alertCircle,
          size: AppFontSize.small,
        ),
        AppSpacings.spacingSmHorizontal,
        Text(
          localizations.value_not_available,
          style: TextStyle(
            fontFamily: 'DIN1451',
            fontSize: AppFontSize.small,
          ),
        ),
      ],
    );
  }
}
