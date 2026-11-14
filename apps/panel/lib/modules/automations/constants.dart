class AutomationsModuleConstants {
  // Module wildcard event
  static const String moduleWildcardEvent = 'AutomationsModule.*';

  // Automation events. A display receives each automation without its graph.
  static const String automationCreatedEvent =
      'AutomationsModule.Automation.Created';
  static const String automationUpdatedEvent =
      'AutomationsModule.Automation.Updated';
  static const String automationDeletedEvent =
      'AutomationsModule.Automation.Deleted';
  static const String moduleResetEvent = 'AutomationsModule.All.Reset';

  /// How long switching an automation on or off may take before the panel
  /// gives up and shows the stored state again.
  static const Duration setEnabledTimeout = Duration(seconds: 10);
}
