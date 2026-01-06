class DevicesModuleConstants {
  // Socket event names
  static const String moduleWildcardEvent = 'DevicesModule.*';

  static const String deviceCreatedEvent = 'DevicesModule.Device.Created';
  static const String deviceUpdatedEvent = 'DevicesModule.Device.Updated';
  static const String deviceDeletedEvent = 'DevicesModule.Device.Deleted';
  static const String deviceControlCreatedEvent =
      'DevicesModule.DeviceControl.Created';
  static const String deviceControlDeletedEvent =
      'DevicesModule.DeviceControl.Deleted';
  static const String channelCreatedEvent = 'DevicesModule.Channel.Created';
  static const String channelUpdatedEvent = 'DevicesModule.Channel.Updated';
  static const String channelDeletedEvent = 'DevicesModule.Channel.Deleted';
  static const String channelControlCreatedEvent =
      'DevicesModule.ChannelControl.Created';
  static const String channelControlDeletedEvent =
      'DevicesModule.ChannelControl.Deleted';
  static const String channelPropertyCreatedEvent =
      'DevicesModule.ChannelProperty.Created';
  static const String channelPropertyUpdatedEvent =
      'DevicesModule.ChannelProperty.Updated';
  static const String channelPropertyDeletedEvent =
      'DevicesModule.ChannelProperty.Deleted';

  static const String channelPropertySetEvent =
      'DevicesModule.ChannelProperty.Set';
  static const String channelPropertyValueSetEvent =
      'DevicesModule.ChannelProperty.ValueSet';
}

class DevicesModuleEventHandlerName {
  static const String internalSetProperty =
      'DevicesModule.Internal.SetPropertyValue';
  static const String publicSetProperty =
      'DevicesModule.Public.SetPropertyValue';
}
