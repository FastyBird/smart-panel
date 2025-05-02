// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_home_assistant_plugin_create_home_assistant_channel.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesHomeAssistantPluginCreateHomeAssistantChannel
    _$DevicesHomeAssistantPluginCreateHomeAssistantChannelFromJson(
        Map<String, dynamic> json) {
  return _DevicesHomeAssistantPluginCreateHomeAssistantChannel.fromJson(json);
}

/// @nodoc
mixin _$DevicesHomeAssistantPluginCreateHomeAssistantChannel {
  /// Unique identifier for the channel. Optional during creation and system-generated if not provided.
  String get id => throw _privateConstructorUsedError;

  /// Specifies the type of channel.
  String get type => throw _privateConstructorUsedError;

  /// Type of the channel, indicating its functional category (e.g., temperature, light).
  DevicesModuleChannelCategory get category =>
      throw _privateConstructorUsedError;

  /// Human-readable name of the channel.
  String get name => throw _privateConstructorUsedError;

  /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
  List<DevicesModuleCreateChannelControl> get controls =>
      throw _privateConstructorUsedError;

  /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
  List<DevicesModuleCreateChannelProperty> get properties =>
      throw _privateConstructorUsedError;

  /// The parent device to which this channel belongs.
  String get device => throw _privateConstructorUsedError;

  /// A HA device entity identifier.
  @JsonKey(name: 'ha_entity_id')
  String get haEntityId => throw _privateConstructorUsedError;

  /// Optional description of the channel’s purpose or functionality.
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this DevicesHomeAssistantPluginCreateHomeAssistantChannel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesHomeAssistantPluginCreateHomeAssistantChannelCopyWith<
          DevicesHomeAssistantPluginCreateHomeAssistantChannel>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesHomeAssistantPluginCreateHomeAssistantChannelCopyWith<
    $Res> {
  factory $DevicesHomeAssistantPluginCreateHomeAssistantChannelCopyWith(
          DevicesHomeAssistantPluginCreateHomeAssistantChannel value,
          $Res Function(DevicesHomeAssistantPluginCreateHomeAssistantChannel)
              then) =
      _$DevicesHomeAssistantPluginCreateHomeAssistantChannelCopyWithImpl<$Res,
          DevicesHomeAssistantPluginCreateHomeAssistantChannel>;
  @useResult
  $Res call(
      {String id,
      String type,
      DevicesModuleChannelCategory category,
      String name,
      List<DevicesModuleCreateChannelControl> controls,
      List<DevicesModuleCreateChannelProperty> properties,
      String device,
      @JsonKey(name: 'ha_entity_id') String haEntityId,
      String? description});
}

/// @nodoc
class _$DevicesHomeAssistantPluginCreateHomeAssistantChannelCopyWithImpl<$Res,
        $Val extends DevicesHomeAssistantPluginCreateHomeAssistantChannel>
    implements
        $DevicesHomeAssistantPluginCreateHomeAssistantChannelCopyWith<$Res> {
  _$DevicesHomeAssistantPluginCreateHomeAssistantChannelCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? category = null,
    Object? name = null,
    Object? controls = null,
    Object? properties = null,
    Object? device = null,
    Object? haEntityId = null,
    Object? description = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as DevicesModuleChannelCategory,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      controls: null == controls
          ? _value.controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleCreateChannelControl>,
      properties: null == properties
          ? _value.properties
          : properties // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleCreateChannelProperty>,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      haEntityId: null == haEntityId
          ? _value.haEntityId
          : haEntityId // ignore: cast_nullable_to_non_nullable
              as String,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesHomeAssistantPluginCreateHomeAssistantChannelImplCopyWith<
        $Res>
    implements
        $DevicesHomeAssistantPluginCreateHomeAssistantChannelCopyWith<$Res> {
  factory _$$DevicesHomeAssistantPluginCreateHomeAssistantChannelImplCopyWith(
          _$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl value,
          $Res Function(
                  _$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl)
              then) =
      __$$DevicesHomeAssistantPluginCreateHomeAssistantChannelImplCopyWithImpl<
          $Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      DevicesModuleChannelCategory category,
      String name,
      List<DevicesModuleCreateChannelControl> controls,
      List<DevicesModuleCreateChannelProperty> properties,
      String device,
      @JsonKey(name: 'ha_entity_id') String haEntityId,
      String? description});
}

/// @nodoc
class __$$DevicesHomeAssistantPluginCreateHomeAssistantChannelImplCopyWithImpl<
        $Res>
    extends _$DevicesHomeAssistantPluginCreateHomeAssistantChannelCopyWithImpl<
        $Res, _$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl>
    implements
        _$$DevicesHomeAssistantPluginCreateHomeAssistantChannelImplCopyWith<
            $Res> {
  __$$DevicesHomeAssistantPluginCreateHomeAssistantChannelImplCopyWithImpl(
      _$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl _value,
      $Res Function(_$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? category = null,
    Object? name = null,
    Object? controls = null,
    Object? properties = null,
    Object? device = null,
    Object? haEntityId = null,
    Object? description = freezed,
  }) {
    return _then(_$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as DevicesModuleChannelCategory,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      controls: null == controls
          ? _value._controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleCreateChannelControl>,
      properties: null == properties
          ? _value._properties
          : properties // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleCreateChannelProperty>,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      haEntityId: null == haEntityId
          ? _value.haEntityId
          : haEntityId // ignore: cast_nullable_to_non_nullable
              as String,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl
    implements _DevicesHomeAssistantPluginCreateHomeAssistantChannel {
  const _$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl(
      {required this.id,
      required this.type,
      required this.category,
      required this.name,
      required final List<DevicesModuleCreateChannelControl> controls,
      required final List<DevicesModuleCreateChannelProperty> properties,
      required this.device,
      @JsonKey(name: 'ha_entity_id') required this.haEntityId,
      this.description})
      : _controls = controls,
        _properties = properties;

  factory _$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesHomeAssistantPluginCreateHomeAssistantChannelImplFromJson(json);

  /// Unique identifier for the channel. Optional during creation and system-generated if not provided.
  @override
  final String id;

  /// Specifies the type of channel.
  @override
  final String type;

  /// Type of the channel, indicating its functional category (e.g., temperature, light).
  @override
  final DevicesModuleChannelCategory category;

  /// Human-readable name of the channel.
  @override
  final String name;

  /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
  final List<DevicesModuleCreateChannelControl> _controls;

  /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
  @override
  List<DevicesModuleCreateChannelControl> get controls {
    if (_controls is EqualUnmodifiableListView) return _controls;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_controls);
  }

  /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
  final List<DevicesModuleCreateChannelProperty> _properties;

  /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
  @override
  List<DevicesModuleCreateChannelProperty> get properties {
    if (_properties is EqualUnmodifiableListView) return _properties;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_properties);
  }

  /// The parent device to which this channel belongs.
  @override
  final String device;

  /// A HA device entity identifier.
  @override
  @JsonKey(name: 'ha_entity_id')
  final String haEntityId;

  /// Optional description of the channel’s purpose or functionality.
  @override
  final String? description;

  @override
  String toString() {
    return 'DevicesHomeAssistantPluginCreateHomeAssistantChannel(id: $id, type: $type, category: $category, name: $name, controls: $controls, properties: $properties, device: $device, haEntityId: $haEntityId, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other
                is _$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.name, name) || other.name == name) &&
            const DeepCollectionEquality().equals(other._controls, _controls) &&
            const DeepCollectionEquality()
                .equals(other._properties, _properties) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.haEntityId, haEntityId) ||
                other.haEntityId == haEntityId) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      category,
      name,
      const DeepCollectionEquality().hash(_controls),
      const DeepCollectionEquality().hash(_properties),
      device,
      haEntityId,
      description);

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesHomeAssistantPluginCreateHomeAssistantChannelImplCopyWith<
          _$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl>
      get copyWith =>
          __$$DevicesHomeAssistantPluginCreateHomeAssistantChannelImplCopyWithImpl<
                  _$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesHomeAssistantPluginCreateHomeAssistantChannelImplToJson(
      this,
    );
  }
}

abstract class _DevicesHomeAssistantPluginCreateHomeAssistantChannel
    implements DevicesHomeAssistantPluginCreateHomeAssistantChannel {
  const factory _DevicesHomeAssistantPluginCreateHomeAssistantChannel(
          {required final String id,
          required final String type,
          required final DevicesModuleChannelCategory category,
          required final String name,
          required final List<DevicesModuleCreateChannelControl> controls,
          required final List<DevicesModuleCreateChannelProperty> properties,
          required final String device,
          @JsonKey(name: 'ha_entity_id') required final String haEntityId,
          final String? description}) =
      _$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl;

  factory _DevicesHomeAssistantPluginCreateHomeAssistantChannel.fromJson(
          Map<String, dynamic> json) =
      _$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl.fromJson;

  /// Unique identifier for the channel. Optional during creation and system-generated if not provided.
  @override
  String get id;

  /// Specifies the type of channel.
  @override
  String get type;

  /// Type of the channel, indicating its functional category (e.g., temperature, light).
  @override
  DevicesModuleChannelCategory get category;

  /// Human-readable name of the channel.
  @override
  String get name;

  /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
  @override
  List<DevicesModuleCreateChannelControl> get controls;

  /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
  @override
  List<DevicesModuleCreateChannelProperty> get properties;

  /// The parent device to which this channel belongs.
  @override
  String get device;

  /// A HA device entity identifier.
  @override
  @JsonKey(name: 'ha_entity_id')
  String get haEntityId;

  /// Optional description of the channel’s purpose or functionality.
  @override
  String? get description;

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesHomeAssistantPluginCreateHomeAssistantChannelImplCopyWith<
          _$DevicesHomeAssistantPluginCreateHomeAssistantChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
