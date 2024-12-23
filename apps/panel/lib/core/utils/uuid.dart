import 'package:uuid/uuid.dart';

class UuidUtils {
  /// Validates a single UUID string.
  static String validateUuid(String value) {
    if (!Uuid.isValidUUID(fromString: value)) {
      throw ArgumentError('Invalid UUID: $value');
    }
    return value;
  }

  /// Validates a list of UUID strings.
  static List<String> validateUuidList(List<String> values) {
    for (final value in values) {
      if (!Uuid.isValidUUID(fromString: value)) {
        throw ArgumentError('Invalid UUID in list: $value');
      }
    }

    return values;
  }
}
