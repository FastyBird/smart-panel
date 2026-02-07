class SpacesModuleConstants {
  // Socket event names
  static const String moduleWildcardEvent = 'SpacesModule.*';

  static const String spaceCreatedEvent = 'SpacesModule.Space.Created';
  static const String spaceUpdatedEvent = 'SpacesModule.Space.Updated';
  static const String spaceDeletedEvent = 'SpacesModule.Space.Deleted';

  // WebSocket command events for intents
  static const String lightingIntentEvent = 'SpacesModule.LightingIntent';
  static const String climateIntentEvent = 'SpacesModule.ClimateIntent';
  static const String coversIntentEvent = 'SpacesModule.CoversIntent';
  static const String undoIntentEvent = 'SpacesModule.UndoIntent';

  static const String lightTargetCreatedEvent =
      'SpacesModule.LightTarget.Created';
  static const String lightTargetUpdatedEvent =
      'SpacesModule.LightTarget.Updated';
  static const String lightTargetDeletedEvent =
      'SpacesModule.LightTarget.Deleted';

  static const String climateTargetCreatedEvent =
      'SpacesModule.ClimateTarget.Created';
  static const String climateTargetUpdatedEvent =
      'SpacesModule.ClimateTarget.Updated';
  static const String climateTargetDeletedEvent =
      'SpacesModule.ClimateTarget.Deleted';

  static const String coversTargetCreatedEvent =
      'SpacesModule.CoversTarget.Created';
  static const String coversTargetUpdatedEvent =
      'SpacesModule.CoversTarget.Updated';
  static const String coversTargetDeletedEvent =
      'SpacesModule.CoversTarget.Deleted';

  // Aggregated state change events
  static const String lightingStateChangedEvent =
      'SpacesModule.Space.LightingStateChanged';
  static const String climateStateChangedEvent =
      'SpacesModule.Space.ClimateStateChanged';
  static const String coversStateChangedEvent =
      'SpacesModule.Space.CoversStateChanged';
  static const String sensorStateChangedEvent =
      'SpacesModule.Space.SensorStateChanged';

  // Media activity lifecycle events
  static const String mediaActivityActivatingEvent =
      'SpacesModule.MediaActivity.Activating';
  static const String mediaActivityActivatedEvent =
      'SpacesModule.MediaActivity.Activated';
  static const String mediaActivityFailedEvent =
      'SpacesModule.MediaActivity.Failed';
  static const String mediaActivityDeactivatedEvent =
      'SpacesModule.MediaActivity.Deactivated';
  static const String mediaActivityStepProgressEvent =
      'SpacesModule.MediaActivity.StepProgress';
}

/// WebSocket command handler names for spaces module intents
class SpacesModuleEventHandlerName {
  static const String lightingIntent = 'SpacesModule.LightingIntentHandler';
  static const String climateIntent = 'SpacesModule.ClimateIntentHandler';
  static const String coversIntent = 'SpacesModule.CoversIntentHandler';
  static const String undoIntent = 'SpacesModule.UndoIntentHandler';
}
