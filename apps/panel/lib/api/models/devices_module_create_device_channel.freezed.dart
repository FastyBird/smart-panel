// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_create_device_channel.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleCreateDeviceChannel _$DevicesModuleCreateDeviceChannelFromJson(
    Map<String, dynamic> json) {
  return _DevicesModuleCreateDeviceChannel.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleCreateDeviceChannel {
  /// Unique identifier for the channel. Optional during creation and system-generated if not provided.
  String get id => throw _privateConstructorUsedError;

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

  /// Optional description of the channel’s purpose or functionality.
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleCreateDeviceChannel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleCreateDeviceChannelCopyWith<DevicesModuleCreateDeviceChannel>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleCreateDeviceChannelCopyWith<$Res> {
  factory $DevicesModuleCreateDeviceChannelCopyWith(
          DevicesModuleCreateDeviceChannel value,
          $Res Function(DevicesModuleCreateDeviceChannel) then) =
      _$DevicesModuleCreateDeviceChannelCopyWithImpl<$Res,
          DevicesModuleCreateDeviceChannel>;
  @useResult
  $Res call(
      {String id,
      DevicesModuleChannelCategory category,
      String name,
      List<DevicesModuleCreateChannelControl> controls,
      List<DevicesModuleCreateChannelProperty> properties,
      String? description});
}

/// @nodoc
class _$DevicesModuleCreateDeviceChannelCopyWithImpl<$Res,
        $Val extends DevicesModuleCreateDeviceChannel>
    implements $DevicesModuleCreateDeviceChannelCopyWith<$Res> {
  _$DevicesModuleCreateDeviceChannelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? category = null,
    Object? name = null,
    Object? controls = null,
    Object? properties = null,
    Object? description = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
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
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesModuleCreateDeviceChannelImplCopyWith<$Res>
    implements $DevicesModuleCreateDeviceChannelCopyWith<$Res> {
  factory _$$DevicesModuleCreateDeviceChannelImplCopyWith(
          _$DevicesModuleCreateDeviceChannelImpl value,
          $Res Function(_$DevicesModuleCreateDeviceChannelImpl) then) =
      __$$DevicesModuleCreateDeviceChannelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      DevicesModuleChannelCategory category,
      String name,
      List<DevicesModuleCreateChannelControl> controls,
      List<DevicesModuleCreateChannelProperty> properties,
      String? description});
}

/// @nodoc
class __$$DevicesModuleCreateDeviceChannelImplCopyWithImpl<$Res>
    extends _$DevicesModuleCreateDeviceChannelCopyWithImpl<$Res,
        _$DevicesModuleCreateDeviceChannelImpl>
    implements _$$DevicesModuleCreateDeviceChannelImplCopyWith<$Res> {
  __$$DevicesModuleCreateDeviceChannelImplCopyWithImpl(
      _$DevicesModuleCreateDeviceChannelImpl _value,
      $Res Function(_$DevicesModuleCreateDeviceChannelImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? category = null,
    Object? name = null,
    Object? controls = null,
    Object? properties = null,
    Object? description = freezed,
  }) {
    return _then(_$DevicesModuleCreateDeviceChannelImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
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
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesModuleCreateDeviceChannelImpl
    implements _DevicesModuleCreateDeviceChannel {
  const _$DevicesModuleCreateDeviceChannelImpl(
      {required this.id,
      required this.category,
      required this.name,
      required final List<DevicesModuleCreateChannelControl> controls,
      required final List<DevicesModuleCreateChannelProperty> properties,
      this.description})
      : _controls = controls,
        _properties = properties;

  factory _$DevicesModuleCreateDeviceChannelImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesModuleCreateDeviceChannelImplFromJson(json);

  /// Unique identifier for the channel. Optional during creation and system-generated if not provided.
  @override
  final String id;

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

  /// Optional description of the channel’s purpose or functionality.
  @override
  final String? description;

  @override
  String toString() {
    return 'DevicesModuleCreateDeviceChannel(id: $id, category: $category, name: $name, controls: $controls, properties: $properties, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleCreateDeviceChannelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.name, name) || other.name == name) &&
            const DeepCollectionEquality().equals(other._controls, _controls) &&
            const DeepCollectionEquality()
                .equals(other._properties, _properties) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      category,
      name,
      const DeepCollectionEquality().hash(_controls),
      const DeepCollectionEquality().hash(_properties),
      description);

  /// Create a copy of DevicesModuleCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleCreateDeviceChannelImplCopyWith<
          _$DevicesModuleCreateDeviceChannelImpl>
      get copyWith => __$$DevicesModuleCreateDeviceChannelImplCopyWithImpl<
          _$DevicesModuleCreateDeviceChannelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleCreateDeviceChannelImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleCreateDeviceChannel
    implements DevicesModuleCreateDeviceChannel {
  const factory _DevicesModuleCreateDeviceChannel(
      {required final String id,
      required final DevicesModuleChannelCategory category,
      required final String name,
      required final List<DevicesModuleCreateChannelControl> controls,
      required final List<DevicesModuleCreateChannelProperty> properties,
      final String? description}) = _$DevicesModuleCreateDeviceChannelImpl;

  factory _DevicesModuleCreateDeviceChannel.fromJson(
          Map<String, dynamic> json) =
      _$DevicesModuleCreateDeviceChannelImpl.fromJson;

  /// Unique identifier for the channel. Optional during creation and system-generated if not provided.
  @override
  String get id;

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

  /// Optional description of the channel’s purpose or functionality.
  @override
  String? get description;

  /// Create a copy of DevicesModuleCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleCreateDeviceChannelImplCopyWith<
          _$DevicesModuleCreateDeviceChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
