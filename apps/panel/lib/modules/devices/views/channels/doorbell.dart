import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/brightness.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/event.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tampered.dart';

class DoorbellChannelView extends ChannelView
    with ChannelBrightnessMixin, ChannelTamperedMixin {
  DoorbellChannelView({
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

  EventChannelPropertyView get eventPropProp =>
      properties.whereType<EventChannelPropertyView>().first;

  @override
  BrightnessChannelPropertyView? get brightnessProp =>
      properties.whereType<BrightnessChannelPropertyView>().firstOrNull;

  @override
  TamperedChannelPropertyView? get tamperedProp =>
      properties.whereType<TamperedChannelPropertyView>().firstOrNull;

  DoorbellEventValue? get event {
    final ValueType? value = eventPropProp.value;

    if (value is StringValueType && DoorbellEventValue.contains(value.value)) {
      return DoorbellEventValue.fromValue(value.value);
    }

    return null;
  }

  List<DoorbellEventValue> get availableEvents {
    final FormatType? format = eventPropProp.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => DoorbellEventValue.fromValue(item))
          .whereType<DoorbellEventValue>()
          .toList();
    }

    return [];
  }
}
