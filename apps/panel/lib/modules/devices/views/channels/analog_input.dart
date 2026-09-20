import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/unit.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/value.dart';

class AnalogInputChannelView extends ChannelView
    with ChannelActiveMixin {
  AnalogInputChannelView({
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

  ValueChannelPropertyView get valueProp =>
      properties.whereType<ValueChannelPropertyView>().first;

  UnitChannelPropertyView? get unitProp =>
      properties.whereType<UnitChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  num? get value => valueProp.valueNum;

  String? get unit => unitProp?.unitString ?? valueProp.unit;
}
