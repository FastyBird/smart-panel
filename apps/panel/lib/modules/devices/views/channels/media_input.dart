import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/source.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/source_label.dart';

class MediaInputChannelView extends ChannelView with ChannelActiveMixin {
  MediaInputChannelView({
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

  SourceChannelPropertyView get sourceProp =>
      properties.whereType<SourceChannelPropertyView>().first;

  SourceLabelChannelPropertyView? get sourceLabelProp =>
      properties.whereType<SourceLabelChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  String get source {
    final ValueType? value = sourceProp.value;

    if (value is StringValueType) {
      return value.value;
    }

    throw Exception(
      'Channel is missing required value for property: ${sourceProp.category.json}',
    );
  }

  bool get hasSourceLabel => sourceLabelProp != null;

  String? get sourceLabel => sourceLabelProp?.label;

  List<String> get availableSources {
    final FormatType? format = sourceProp.format;

    if (format is StringListFormatType) {
      return format.value;
    }

    return [];
  }
}
