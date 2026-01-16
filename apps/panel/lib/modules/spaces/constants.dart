class SpacesModuleConstants {
  // Socket event names
  static const String moduleWildcardEvent = 'SpacesModule.*';

  static const String spaceCreatedEvent = 'SpacesModule.Space.Created';
  static const String spaceUpdatedEvent = 'SpacesModule.Space.Updated';
  static const String spaceDeletedEvent = 'SpacesModule.Space.Deleted';

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

  // Aggregated state change events
  static const String lightingStateChangedEvent =
      'SpacesModule.Space.LightingStateChanged';
  static const String climateStateChangedEvent =
      'SpacesModule.Space.ClimateStateChanged';
}
