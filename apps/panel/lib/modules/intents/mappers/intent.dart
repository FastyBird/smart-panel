import 'package:fastybird_smart_panel/modules/intents/models/intents/intent.dart';
import 'package:fastybird_smart_panel/modules/intents/views/intents/view.dart';

IntentModel buildIntentModel(Map<String, dynamic> data) {
  return IntentModel.fromJson(data);
}

IntentView buildIntentView(IntentModel intent) {
  return IntentView(
    id: intent.id,
    requestId: intent.requestId,
    type: intent.type,
    context: intent.context,
    targets: intent.targets,
    value: intent.value,
    status: intent.status,
    ttlMs: intent.ttlMs,
    createdAt: intent.createdAt ?? DateTime.now(),
    expiresAt: intent.expiresAt,
    completedAt: intent.completedAt,
    results: intent.results,
    isLocal: intent.isLocal,
  );
}
