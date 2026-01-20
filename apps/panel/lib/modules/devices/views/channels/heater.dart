import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/temperature.dart';

class HeaterChannelView extends ChannelView with ChannelTemperatureMixin {
  HeaterChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    super.parent,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });

  @override
  TemperatureChannelPropertyView get temperatureProp =>
      properties.whereType<TemperatureChannelPropertyView>().first;

  StatusChannelPropertyView get statusProp =>
      properties.whereType<StatusChannelPropertyView>().first;

  OnChannelPropertyView get onProp =>
      properties.whereType<OnChannelPropertyView>().first;

  bool get isOn {
    final value = onProp.value;

    return value is BooleanValueType ? value.value : false;
  }

  bool get isHeating {
    final value = statusProp.value;

    return value is BooleanValueType ? value.value : false;
  }
}
