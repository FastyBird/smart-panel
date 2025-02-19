import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/data/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/data/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices_module.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:provider/provider.dart';

class DeviceDetailPage extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final String id;

  DeviceDetailPage(this.id, {super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<DevicesModuleRepository>(builder: (
      context,
      devicesModuleRepository,
      _,
    ) {
      if (devicesModuleRepository.isLoading) {
        return Scaffold(
          body: Center(
            child: SizedBox(
              width: _screenService.scale(50),
              height: _screenService.scale(50),
              child: const CircularProgressIndicator(),
            ),
          ),
        );
      }

      var device = devicesModuleRepository.getDevice(id);
      DeviceCapability? capability;

      if (device != null) {
        capability = buildDeviceCapability(
          device,
          devicesModuleRepository
              .getChannels(device.channels)
              .map(
                (channel) => buildChannelCapability(
                  channel,
                  devicesModuleRepository
                      .getChannelsProperties(channel.properties),
                ),
              )
              .toList(),
        );
      }

      if (device == null || capability == null) {
        final localizations = AppLocalizations.of(context)!;

        return Scaffold(
          body: Center(
            child: Padding(
              padding: AppSpacings.paddingMd,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Symbols.warning,
                    color: Theme.of(context).warning,
                    size: _screenService.scale(64),
                  ),
                  AppSpacings.spacingMdVertical,
                  Text(
                    localizations.message_error_device_not_found_title,
                    textAlign: TextAlign.center,
                  ),
                  AppSpacings.spacingSmVertical,
                  Text(
                    localizations.message_error_device_not_found_description,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      }

      return buildDeviceDetail(device, capability);
    });
  }
}
