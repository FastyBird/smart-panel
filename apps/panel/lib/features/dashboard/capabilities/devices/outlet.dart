import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/device_information.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/outlet.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:flutter/cupertino.dart';
import 'package:material_symbols_icons/symbols.dart';

class OutletDeviceType extends DeviceType
    with
        DeviceDeviceInformationMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin {
  OutletDeviceType({
    required super.device,
    required super.capabilities,
  });

  @override
  IconData get icon => super.icon ?? Symbols.smart_outlet;

  @override
  DeviceInformationChannelCapability get deviceInformationCapability =>
      capabilities.whereType<DeviceInformationChannelCapability>().first;

  @override
  ElectricalEnergyChannelCapability? get electricalEnergyCapability =>
      capabilities.whereType<ElectricalEnergyChannelCapability>().firstOrNull;

  @override
  ElectricalPowerChannelCapability? get electricalPowerCapability =>
      capabilities.whereType<ElectricalPowerChannelCapability>().firstOrNull;

  List<OutletChannelCapability> get outletCapabilities =>
      capabilities.whereType<OutletChannelCapability>().toList();

  @override
  bool get isOn {
    final properties = outletCapabilities
        .expand((channel) => channel.properties)
        .where((property) => property.category == PropertyCategory.on)
        .toList();

    return properties.every(
      (prop) {
        final value = prop.value;

        return value is BooleanValueType ? value.value : false;
      },
    );
  }

  bool get hasOutletInUse =>
      outletCapabilities.any((channel) => channel.hasInUse);

  bool get isOutletInUse {
    final properties = outletCapabilities
        .expand((channel) => channel.properties)
        .where((property) => property.category == PropertyCategory.inUse)
        .toList();

    return properties.every(
      (prop) {
        final value = prop.value;

        return value is BooleanValueType ? value.value : false;
      },
    );
  }
}
