// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_channel.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleChannel _$DevicesModuleChannelFromJson(Map<String, dynamic> json) {
  return _DevicesModuleChannel.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleChannel {
  /// System-generated unique identifier for the channel.
  String get id => throw _privateConstructorUsedError;

  /// Specifies the type of channel.
  String get type => throw _privateConstructorUsedError;

  /// Type of the channel, indicating its functional category (e.g., temperature, light).
  DevicesModuleChannelCategory get category =>
      throw _privateConstructorUsedError;

  /// Human-readable name of the channel.
  String get name => throw _privateConstructorUsedError;

  /// Optional description of the channel’s purpose or functionality.
  String? get description => throw _privateConstructorUsedError;

  /// The parent device to which this channel belongs.
  String get device => throw _privateConstructorUsedError;

  /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
  List<DevicesModuleChannelControl> get controls =>
      throw _privateConstructorUsedError;

  /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
  List<DevicesModuleChannelProperty> get properties =>
      throw _privateConstructorUsedError;

  /// Timestamp when the channel was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Timestamp when the channel was last updated, if applicable.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleChannel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleChannelCopyWith<DevicesModuleChannel> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleChannelCopyWith<$Res> {
  factory $DevicesModuleChannelCopyWith(DevicesModuleChannel value,
          $Res Function(DevicesModuleChannel) then) =
      _$DevicesModuleChannelCopyWithImpl<$Res, DevicesModuleChannel>;
  @useResult
  $Res call(
      {String id,
      String type,
      DevicesModuleChannelCategory category,
      String name,
      String? description,
      String device,
      List<DevicesModuleChannelControl> controls,
      List<DevicesModuleChannelProperty> properties,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class _$DevicesModuleChannelCopyWithImpl<$Res,
        $Val extends DevicesModuleChannel>
    implements $DevicesModuleChannelCopyWith<$Res> {
  _$DevicesModuleChannelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? category = null,
    Object? name = null,
    Object? description = freezed,
    Object? device = null,
    Object? controls = null,
    Object? properties = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
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
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      controls: null == controls
          ? _value.controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleChannelControl>,
      properties: null == properties
          ? _value.properties
          : properties // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleChannelProperty>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesModuleChannelImplCopyWith<$Res>
    implements $DevicesModuleChannelCopyWith<$Res> {
  factory _$$DevicesModuleChannelImplCopyWith(_$DevicesModuleChannelImpl value,
          $Res Function(_$DevicesModuleChannelImpl) then) =
      __$$DevicesModuleChannelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      DevicesModuleChannelCategory category,
      String name,
      String? description,
      String device,
      List<DevicesModuleChannelControl> controls,
      List<DevicesModuleChannelProperty> properties,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class __$$DevicesModuleChannelImplCopyWithImpl<$Res>
    extends _$DevicesModuleChannelCopyWithImpl<$Res, _$DevicesModuleChannelImpl>
    implements _$$DevicesModuleChannelImplCopyWith<$Res> {
  __$$DevicesModuleChannelImplCopyWithImpl(_$DevicesModuleChannelImpl _value,
      $Res Function(_$DevicesModuleChannelImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? category = null,
    Object? name = null,
    Object? description = freezed,
    Object? device = null,
    Object? controls = null,
    Object? properties = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
  }) {
    return _then(_$DevicesModuleChannelImpl(
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
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      controls: null == controls
          ? _value._controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleChannelControl>,
      properties: null == properties
          ? _value._properties
          : properties // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleChannelProperty>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesModuleChannelImpl implements _DevicesModuleChannel {
  const _$DevicesModuleChannelImpl(
      {required this.id,
      required this.type,
      required this.category,
      required this.name,
      required this.description,
      required this.device,
      required final List<DevicesModuleChannelControl> controls,
      required final List<DevicesModuleChannelProperty> properties,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt})
      : _controls = controls,
        _properties = properties;

  factory _$DevicesModuleChannelImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesModuleChannelImplFromJson(json);

  /// System-generated unique identifier for the channel.
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

  /// Optional description of the channel’s purpose or functionality.
  @override
  final String? description;

  /// The parent device to which this channel belongs.
  @override
  final String device;

  /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
  final List<DevicesModuleChannelControl> _controls;

  /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
  @override
  List<DevicesModuleChannelControl> get controls {
    if (_controls is EqualUnmodifiableListView) return _controls;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_controls);
  }

  /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
  final List<DevicesModuleChannelProperty> _properties;

  /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
  @override
  List<DevicesModuleChannelProperty> get properties {
    if (_properties is EqualUnmodifiableListView) return _properties;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_properties);
  }

  /// Timestamp when the channel was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// Timestamp when the channel was last updated, if applicable.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  @override
  String toString() {
    return 'DevicesModuleChannel(id: $id, type: $type, category: $category, name: $name, description: $description, device: $device, controls: $controls, properties: $properties, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleChannelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.device, device) || other.device == device) &&
            const DeepCollectionEquality().equals(other._controls, _controls) &&
            const DeepCollectionEquality()
                .equals(other._properties, _properties) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      category,
      name,
      description,
      device,
      const DeepCollectionEquality().hash(_controls),
      const DeepCollectionEquality().hash(_properties),
      createdAt,
      updatedAt);

  /// Create a copy of DevicesModuleChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleChannelImplCopyWith<_$DevicesModuleChannelImpl>
      get copyWith =>
          __$$DevicesModuleChannelImplCopyWithImpl<_$DevicesModuleChannelImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleChannelImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleChannel implements DevicesModuleChannel {
  const factory _DevicesModuleChannel(
          {required final String id,
          required final String type,
          required final DevicesModuleChannelCategory category,
          required final String name,
          required final String? description,
          required final String device,
          required final List<DevicesModuleChannelControl> controls,
          required final List<DevicesModuleChannelProperty> properties,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt}) =
      _$DevicesModuleChannelImpl;

  factory _DevicesModuleChannel.fromJson(Map<String, dynamic> json) =
      _$DevicesModuleChannelImpl.fromJson;

  /// System-generated unique identifier for the channel.
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

  /// Optional description of the channel’s purpose or functionality.
  @override
  String? get description;

  /// The parent device to which this channel belongs.
  @override
  String get device;

  /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
  @override
  List<DevicesModuleChannelControl> get controls;

  /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
  @override
  List<DevicesModuleChannelProperty> get properties;

  /// Timestamp when the channel was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// Timestamp when the channel was last updated, if applicable.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// Create a copy of DevicesModuleChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleChannelImplCopyWith<_$DevicesModuleChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
