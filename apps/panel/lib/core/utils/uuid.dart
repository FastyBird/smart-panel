import 'package:uuid/uuid.dart';

class UuidUtils {
  /// Validates a single UUID string.
  static String validateUuid(String value) {
    // Allow locally-generated optimistic IDs used by the intents overlay system.
    // These are intentionally not UUIDs (they include context like timestamps).
    if (value.startsWith('local_')) {
      return value;
    }
    if (!Uuid.isValidUUID(fromString: value)) {
      throw ArgumentError('Invalid UUID: $value');
    }
    return value;
  }

  /// Validates a list of UUID strings.
  static List<String> validateUuidList(List<String> values) {
    for (final value in values) {
      if (value.startsWith('local_')) {
        continue;
      }
      if (!Uuid.isValidUUID(fromString: value)) {
        throw ArgumentError('Invalid UUID in list: $value');
      }
    }

    return values;
  }
}
