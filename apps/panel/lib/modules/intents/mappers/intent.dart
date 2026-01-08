import 'package:fastybird_smart_panel/modules/intents/models/intents/intent.dart';
import 'package:fastybird_smart_panel/modules/intents/views/intents/view.dart';

IntentModel buildIntentModel(Map<String, dynamic> data) {
  return IntentModel.fromJson(data);
}

IntentView buildIntentView(IntentModel intent) {
  return IntentView(model: intent);
}
