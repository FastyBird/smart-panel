class ScenesModuleConstants {
  // Module wildcard event
  static const String moduleWildcardEvent = 'ScenesModule.*';

  // Scene events
  static const String sceneCreatedEvent = 'ScenesModule.Scene.Created';
  static const String sceneUpdatedEvent = 'ScenesModule.Scene.Updated';
  static const String sceneDeletedEvent = 'ScenesModule.Scene.Deleted';

  // Action events
  static const String actionCreatedEvent = 'ScenesModule.SceneAction.Created';
  static const String actionUpdatedEvent = 'ScenesModule.SceneAction.Updated';
  static const String actionDeletedEvent = 'ScenesModule.SceneAction.Deleted';

  // WebSocket command events
  static const String triggerSceneEvent = 'ScenesModule.TriggerScene';
}

/// WebSocket command handler names for scenes module
class ScenesModuleEventHandlerName {
  static const String triggerScene = 'ScenesModule.TriggerSceneHandler';
}
