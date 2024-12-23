import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';

abstract class InvalidValueType {
  factory InvalidValueType.fromJson(dynamic json) {
    if (json is String) {
      return StringInvalidValueType(json);
    } else if (json is num) {
      return NumberInvalidValueType(json);
    } else if (json is bool) {
      return BooleanInvalidValueType(json);
    }

    throw Exception('Invalid invalid value type: ${json.runtimeType}');
  }
}

class StringInvalidValueType implements InvalidValueType {
  final String value;

  StringInvalidValueType(this.value);
}

class NumberInvalidValueType implements InvalidValueType {
  final num value;

  NumberInvalidValueType(this.value);
}

class BooleanInvalidValueType implements InvalidValueType {
  final bool value;

  BooleanInvalidValueType(this.value);
}

abstract class ValueType {
  factory ValueType.fromJson(dynamic json) {
    if (json is String) {
      if (ButtonPayloadType.contains(json)) {
        return ButtonPayloadValueType(ButtonPayloadType.fromValue(json)!);
      } else if (CoverPayloadType.contains(json)) {
        return CoverPayloadValueType(CoverPayloadType.fromValue(json)!);
      } else if (SwitcherPayloadType.contains(json)) {
        return SwitcherPayloadValueType(SwitcherPayloadType.fromValue(json)!);
      }

      return StringValueType(json);
    } else if (json is num) {
      return NumberValueType(json);
    } else if (json is bool) {
      return BooleanValueType(json);
    }

    throw Exception('Default invalid value type: ${json.runtimeType}');
  }
}

class StringValueType implements ValueType {
  final String value;

  StringValueType(this.value);
}

class NumberValueType implements ValueType {
  final num value;

  NumberValueType(this.value);
}

class BooleanValueType implements ValueType {
  final bool value;

  BooleanValueType(this.value);
}

class ButtonPayloadValueType implements ValueType {
  final ButtonPayloadType value;

  ButtonPayloadValueType(this.value);
}

class CoverPayloadValueType implements ValueType {
  final CoverPayloadType value;

  CoverPayloadValueType(this.value);
}

class SwitcherPayloadValueType implements ValueType {
  final SwitcherPayloadType value;

  SwitcherPayloadValueType(this.value);
}
