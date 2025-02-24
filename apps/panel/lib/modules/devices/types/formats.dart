abstract class FormatType {
  factory FormatType.fromJson(dynamic json) {
    if (json is List) {
      if (json.isEmpty) {
        throw Exception('Invalid format: array is empty');
      }

      if (json.every((item) => item is String)) {
        return StringListFormatType(json.cast<String>());
      } else if (json.every((item) => item is num || item == null)) {
        return NumberListFormatType(json);
      }
    }

    throw Exception('Invalid format type: ${json.runtimeType}');
  }
}

class StringListFormatType implements FormatType {
  final List<String> value;

  StringListFormatType(this.value);
}

class NumberListFormatType implements FormatType {
  final List<dynamic> value;

  NumberListFormatType(this.value);
}
