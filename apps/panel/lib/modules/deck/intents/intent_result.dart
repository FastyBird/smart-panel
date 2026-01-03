import 'package:fastybird_smart_panel/modules/deck/intents/intent_types.dart';

/// Result of executing an intent.
class IntentResult {
  /// The type of intent that was executed.
  final IntentType intentType;

  /// The result status.
  final IntentResultStatus status;

  /// Human-readable message about the result.
  final String? message;

  /// Additional data from the intent execution.
  final Map<String, dynamic>? data;

  const IntentResult({
    required this.intentType,
    required this.status,
    this.message,
    this.data,
  });

  /// Creates a successful result.
  factory IntentResult.success(
    IntentType type, {
    String? message,
    Map<String, dynamic>? data,
  }) {
    return IntentResult(
      intentType: type,
      status: IntentResultStatus.success,
      message: message,
      data: data,
    );
  }

  /// Creates a failure result.
  factory IntentResult.failure(
    IntentType type, {
    String? message,
    Map<String, dynamic>? data,
  }) {
    return IntentResult(
      intentType: type,
      status: IntentResultStatus.failure,
      message: message,
      data: data,
    );
  }

  /// Creates a partial success result.
  factory IntentResult.partialSuccess(
    IntentType type, {
    String? message,
    Map<String, dynamic>? data,
  }) {
    return IntentResult(
      intentType: type,
      status: IntentResultStatus.partialSuccess,
      message: message,
      data: data,
    );
  }

  /// Creates an invalid intent result.
  factory IntentResult.invalid(
    IntentType type, {
    String? message,
  }) {
    return IntentResult(
      intentType: type,
      status: IntentResultStatus.invalid,
      message: message,
    );
  }

  /// Whether the intent was successful.
  bool get isSuccess => status == IntentResultStatus.success;

  /// Whether the intent failed.
  bool get isFailure => status == IntentResultStatus.failure;

  /// Whether the intent was partially successful.
  bool get isPartialSuccess => status == IntentResultStatus.partialSuccess;

  @override
  String toString() {
    return 'IntentResult(type: ${intentType.name}, status: ${status.name}, message: $message)';
  }
}
