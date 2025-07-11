class SystemModuleConstants {
  // Socket event names
  static const String moduleWildcardEvent = 'SystemModule.*';

  static const String systemInfoEvent = 'SystemModule.System.Info';
  static const String systemRebootEvent = 'SystemModule.System.Reboot';
  static const String systemPowerOffEvent = 'SystemModule.System.PowerOff';
  static const String systemFactoryResetEvent =
      'SystemModule.System.FactoryReset';
  static const String systemRebootSetEvent = 'SystemModule.System.Reboot.Set';
  static const String systemPowerOffSetEvent =
      'SystemModule.System.PowerOff.Set';
  static const String systemFactoryResetSetEvent =
      'SystemModule.System.FactoryReset.Set';
}

class SystemModuleEventHandlerName {
  static const String systemInternalPlatformAction =
      'SystemModule.Internal.PlatformAction';
}
