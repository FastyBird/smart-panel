import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_energy.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/electrical_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/outlet.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';

class OutletDeviceView extends DeviceView
    with
        DeviceDeviceInformationMixin,
        DeviceElectricalEnergyMixin,
        DeviceElectricalPowerMixin {
  OutletDeviceView({
    required super.id,
    required super.type,
    super.category,
    required super.name,
    super.description,
    super.icon,
    super.roomId,
    super.zoneIds,
    required super.channels,
    super.enabled,
    super.isOnline,
    super.isValid,
    super.validationIssues,
  });

  @override
  DeviceInformationChannelView get deviceInformationChannel =>
      channels.whereType<DeviceInformationChannelView>().first;

  @override
  ElectricalEnergyChannelView? get electricalEnergyChannel =>
      channels.whereType<ElectricalEnergyChannelView>().firstOrNull;

  @override
  ElectricalPowerChannelView? get electricalPowerChannel =>
      channels.whereType<ElectricalPowerChannelView>().firstOrNull;

  List<OutletChannelView> get outletChannels =>
      channels.whereType<OutletChannelView>().toList();

  @override
  bool get isOn {
    final properties = outletChannels
        .expand((channel) => channel.properties)
        .where((property) => property.category == DevicesModulePropertyCategory.valueOn)
        .toList();

    return properties.every(
      (prop) {
        final value = prop.value;

        return value is BooleanValueType ? value.value : false;
      },
    );
  }

  bool get hasOutletInUse => outletChannels.any((channel) => channel.hasInUse);

  bool get isOutletInUse {
    final properties = outletChannels
        .expand((channel) => channel.properties)
        .where((property) => property.category == DevicesModulePropertyCategory.inUse)
        .toList();

    return properties.every(
      (prop) {
        final value = prop.value;

        return value is BooleanValueType ? value.value : false;
      },
    );
  }
}
