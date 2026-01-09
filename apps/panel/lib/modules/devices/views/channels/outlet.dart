import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/in_use.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';

class OutletChannelView extends ChannelView with ChannelOnMixin {
  OutletChannelView({
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
  OnChannelPropertyView? get onProp =>
      properties.whereType<OnChannelPropertyView>().firstOrNull;

  InUseChannelPropertyView? get inUseProp =>
      properties.whereType<InUseChannelPropertyView>().firstOrNull;

  bool get hasInUse => inUseProp != null;

  bool get inUse {
    final InUseChannelPropertyView? prop = inUseProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    return false;
  }
}
