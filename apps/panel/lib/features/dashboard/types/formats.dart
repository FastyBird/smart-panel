import 'package:fastybird_smart_panel/features/dashboard/types/data_types.dart';

abstract class FormatType {
  factory FormatType.fromJson(dynamic json) {
    if (json is List) {
      if (json.isEmpty) {
        throw Exception('Invalid format: array is empty');
      }

      if (json.every((item) => item is String)) {
        return StringListFormatType(json.cast<String>());
      } else if (json.every((item) => item is List)) {
        return NestedListFormatType(json.map((item) {
          if (item is List) {
            return item.map((subItem) {
              if (subItem is String || subItem == null) {
                return subItem;
              } else if (subItem is List) {
                return DataFormat.fromJson(subItem);
              } else {
                throw Exception('Invalid nested list format: $subItem');
              }
            }).toList();
          } else {
            throw Exception('Invalid nested list item: $item');
          }
        }).toList());
      } else if (json.every((item) =>
          item is num || item == null || (item is List && item.length == 2))) {
        return NumberListFormatType(json.map((item) {
          if (item is num || item == null) {
            return item;
          } else if (item is List && item.length == 2) {
            return NumberFormatType.fromJson(item);
          } else {
            throw Exception('Invalid number list format: $item');
          }
        }).toList());
      }
    }

    throw Exception('Invalid format type: ${json.runtimeType}');
  }
}

class StringListFormatType implements FormatType {
  final List<String> value;

  StringListFormatType(this.value);
}

class NestedListFormatType implements FormatType {
  final List<List<dynamic>> value;

  NestedListFormatType(this.value);
}

class NumberListFormatType implements FormatType {
  final List<dynamic> value;

  NumberListFormatType(this.value);
}

class DataFormat {
  final ShortDataTypeType type;
  final dynamic value;

  DataFormat(this.type, this.value);

  factory DataFormat.fromJson(List<dynamic> json) {
    if (json.length < 2 || json.length > 2) {
      throw Exception('Invalid data format: $json');
    }

    final type = ShortDataTypeType.fromValue(json[0]);
    final value = json[1];

    if (type == null) {
      throw Exception('Invalid data format type: $type');
    }

    return DataFormat(type, value);
  }
}

class NumberFormatType {
  final ShortDataTypeType type;
  final num value;

  NumberFormatType(this.type, this.value);

  factory NumberFormatType.fromJson(List<dynamic> json) {
    if (json.length != 2) {
      throw Exception('Invalid number format type: $json');
    }

    final type = ShortDataTypeType.fromValue(json[0]);
    final value = json[1];

    if (type == null || value is! num) {
      throw Exception('Invalid number format type: $json');
    }

    return NumberFormatType(type, value);
  }
}

class StringFormatType {
  final ShortDataTypeType type;
  final String value;

  StringFormatType(this.type, this.value);

  factory StringFormatType.fromJson(List<dynamic> json) {
    if (json.length != 2) {
      throw Exception('Invalid string format type: $json');
    }

    final type = ShortDataTypeType.fromValue(json[0]);
    final value = json[1];

    if (type == null || value is! String) {
      throw Exception('Invalid string format type: $json');
    }

    return StringFormatType(type, value);
  }
}

class BooleanFormatType {
  final ShortDataTypeType type;
  final bool value;

  BooleanFormatType(this.type, this.value);

  factory BooleanFormatType.fromJson(List<dynamic> json) {
    if (json.length != 2) {
      throw Exception('Invalid boolean format type: $json');
    }

    final type = ShortDataTypeType.fromValue(json[0]);
    final value = json[1];

    if (type == null || value is! bool) {
      throw Exception('Invalid boolean format type: $json');
    }

    return BooleanFormatType(type, value);
  }
}
