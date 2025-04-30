// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_channel_property.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleChannelProperty _$DevicesModuleChannelPropertyFromJson(
    Map<String, dynamic> json) {
  return _DevicesModuleChannelProperty.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleChannelProperty {
  /// System-generated unique identifier for the channel property.
  String get id => throw _privateConstructorUsedError;

  /// Specifies the type of channel property.
  String get type => throw _privateConstructorUsedError;

  /// Defines the category of the property, representing its functionality or characteristic.
  DevicesModuleChannelPropertyCategory get category =>
      throw _privateConstructorUsedError;

  /// Optional name of the property for easier identification.
  String? get name => throw _privateConstructorUsedError;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  List<DevicesModuleChannelPropertyPermissions> get permissions =>
      throw _privateConstructorUsedError;

  /// Measurement unit associated with the property’s value, if applicable.
  String? get unit => throw _privateConstructorUsedError;

  /// List of valid values or states for the property, where applicable.
  List<dynamic>? get format => throw _privateConstructorUsedError;

  /// Value to represent an invalid state for the property.
  dynamic get invalid => throw _privateConstructorUsedError;

  /// Step value indicating the smallest increment for the property.
  num? get step => throw _privateConstructorUsedError;

  /// Current value of the property.
  dynamic get value => throw _privateConstructorUsedError;

  /// Reference to the channel that this property belongs to.
  String get channel => throw _privateConstructorUsedError;

  /// Timestamp when the control was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Timestamp when the control was last updated, if applicable.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Data type of the property’s value, e.g., string, integer, or boolean.
  @JsonKey(name: 'data_type')
  DevicesModuleChannelPropertyDataType get dataType =>
      throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleChannelProperty to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleChannelPropertyCopyWith<DevicesModuleChannelProperty>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleChannelPropertyCopyWith<$Res> {
  factory $DevicesModuleChannelPropertyCopyWith(
          DevicesModuleChannelProperty value,
          $Res Function(DevicesModuleChannelProperty) then) =
      _$DevicesModuleChannelPropertyCopyWithImpl<$Res,
          DevicesModuleChannelProperty>;
  @useResult
  $Res call(
      {String id,
      String type,
      DevicesModuleChannelPropertyCategory category,
      String? name,
      List<DevicesModuleChannelPropertyPermissions> permissions,
      String? unit,
      List<dynamic>? format,
      dynamic invalid,
      num? step,
      dynamic value,
      String channel,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      @JsonKey(name: 'data_type')
      DevicesModuleChannelPropertyDataType dataType});
}

/// @nodoc
class _$DevicesModuleChannelPropertyCopyWithImpl<$Res,
        $Val extends DevicesModuleChannelProperty>
    implements $DevicesModuleChannelPropertyCopyWith<$Res> {
  _$DevicesModuleChannelPropertyCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? category = null,
    Object? name = freezed,
    Object? permissions = null,
    Object? unit = freezed,
    Object? format = freezed,
    Object? invalid = freezed,
    Object? step = freezed,
    Object? value = freezed,
    Object? channel = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? dataType = null,
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
              as DevicesModuleChannelPropertyCategory,
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
      permissions: null == permissions
          ? _value.permissions
          : permissions // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleChannelPropertyPermissions>,
      unit: freezed == unit
          ? _value.unit
          : unit // ignore: cast_nullable_to_non_nullable
              as String?,
      format: freezed == format
          ? _value.format
          : format // ignore: cast_nullable_to_non_nullable
              as List<dynamic>?,
      invalid: freezed == invalid
          ? _value.invalid
          : invalid // ignore: cast_nullable_to_non_nullable
              as dynamic,
      step: freezed == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as num?,
      value: freezed == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as dynamic,
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      dataType: null == dataType
          ? _value.dataType
          : dataType // ignore: cast_nullable_to_non_nullable
              as DevicesModuleChannelPropertyDataType,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesModuleChannelPropertyImplCopyWith<$Res>
    implements $DevicesModuleChannelPropertyCopyWith<$Res> {
  factory _$$DevicesModuleChannelPropertyImplCopyWith(
          _$DevicesModuleChannelPropertyImpl value,
          $Res Function(_$DevicesModuleChannelPropertyImpl) then) =
      __$$DevicesModuleChannelPropertyImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      DevicesModuleChannelPropertyCategory category,
      String? name,
      List<DevicesModuleChannelPropertyPermissions> permissions,
      String? unit,
      List<dynamic>? format,
      dynamic invalid,
      num? step,
      dynamic value,
      String channel,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      @JsonKey(name: 'data_type')
      DevicesModuleChannelPropertyDataType dataType});
}

/// @nodoc
class __$$DevicesModuleChannelPropertyImplCopyWithImpl<$Res>
    extends _$DevicesModuleChannelPropertyCopyWithImpl<$Res,
        _$DevicesModuleChannelPropertyImpl>
    implements _$$DevicesModuleChannelPropertyImplCopyWith<$Res> {
  __$$DevicesModuleChannelPropertyImplCopyWithImpl(
      _$DevicesModuleChannelPropertyImpl _value,
      $Res Function(_$DevicesModuleChannelPropertyImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? category = null,
    Object? name = freezed,
    Object? permissions = null,
    Object? unit = freezed,
    Object? format = freezed,
    Object? invalid = freezed,
    Object? step = freezed,
    Object? value = freezed,
    Object? channel = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? dataType = null,
  }) {
    return _then(_$DevicesModuleChannelPropertyImpl(
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
              as DevicesModuleChannelPropertyCategory,
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
      permissions: null == permissions
          ? _value._permissions
          : permissions // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleChannelPropertyPermissions>,
      unit: freezed == unit
          ? _value.unit
          : unit // ignore: cast_nullable_to_non_nullable
              as String?,
      format: freezed == format
          ? _value._format
          : format // ignore: cast_nullable_to_non_nullable
              as List<dynamic>?,
      invalid: freezed == invalid
          ? _value.invalid
          : invalid // ignore: cast_nullable_to_non_nullable
              as dynamic,
      step: freezed == step
          ? _value.step
          : step // ignore: cast_nullable_to_non_nullable
              as num?,
      value: freezed == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as dynamic,
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      dataType: null == dataType
          ? _value.dataType
          : dataType // ignore: cast_nullable_to_non_nullable
              as DevicesModuleChannelPropertyDataType,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesModuleChannelPropertyImpl
    implements _DevicesModuleChannelProperty {
  const _$DevicesModuleChannelPropertyImpl(
      {required this.id,
      required this.type,
      required this.category,
      required this.name,
      required final List<DevicesModuleChannelPropertyPermissions> permissions,
      required this.unit,
      required final List<dynamic>? format,
      required this.invalid,
      required this.step,
      required this.value,
      required this.channel,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      @JsonKey(name: 'data_type')
      this.dataType = DevicesModuleChannelPropertyDataType.unknown})
      : _permissions = permissions,
        _format = format;

  factory _$DevicesModuleChannelPropertyImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesModuleChannelPropertyImplFromJson(json);

  /// System-generated unique identifier for the channel property.
  @override
  final String id;

  /// Specifies the type of channel property.
  @override
  final String type;

  /// Defines the category of the property, representing its functionality or characteristic.
  @override
  final DevicesModuleChannelPropertyCategory category;

  /// Optional name of the property for easier identification.
  @override
  final String? name;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  final List<DevicesModuleChannelPropertyPermissions> _permissions;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  @override
  List<DevicesModuleChannelPropertyPermissions> get permissions {
    if (_permissions is EqualUnmodifiableListView) return _permissions;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_permissions);
  }

  /// Measurement unit associated with the property’s value, if applicable.
  @override
  final String? unit;

  /// List of valid values or states for the property, where applicable.
  final List<dynamic>? _format;

  /// List of valid values or states for the property, where applicable.
  @override
  List<dynamic>? get format {
    final value = _format;
    if (value == null) return null;
    if (_format is EqualUnmodifiableListView) return _format;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(value);
  }

  /// Value to represent an invalid state for the property.
  @override
  final dynamic invalid;

  /// Step value indicating the smallest increment for the property.
  @override
  final num? step;

  /// Current value of the property.
  @override
  final dynamic value;

  /// Reference to the channel that this property belongs to.
  @override
  final String channel;

  /// Timestamp when the control was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// Timestamp when the control was last updated, if applicable.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// Data type of the property’s value, e.g., string, integer, or boolean.
  @override
  @JsonKey(name: 'data_type')
  final DevicesModuleChannelPropertyDataType dataType;

  @override
  String toString() {
    return 'DevicesModuleChannelProperty(id: $id, type: $type, category: $category, name: $name, permissions: $permissions, unit: $unit, format: $format, invalid: $invalid, step: $step, value: $value, channel: $channel, createdAt: $createdAt, updatedAt: $updatedAt, dataType: $dataType)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleChannelPropertyImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.name, name) || other.name == name) &&
            const DeepCollectionEquality()
                .equals(other._permissions, _permissions) &&
            (identical(other.unit, unit) || other.unit == unit) &&
            const DeepCollectionEquality().equals(other._format, _format) &&
            const DeepCollectionEquality().equals(other.invalid, invalid) &&
            (identical(other.step, step) || other.step == step) &&
            const DeepCollectionEquality().equals(other.value, value) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.dataType, dataType) ||
                other.dataType == dataType));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      category,
      name,
      const DeepCollectionEquality().hash(_permissions),
      unit,
      const DeepCollectionEquality().hash(_format),
      const DeepCollectionEquality().hash(invalid),
      step,
      const DeepCollectionEquality().hash(value),
      channel,
      createdAt,
      updatedAt,
      dataType);

  /// Create a copy of DevicesModuleChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleChannelPropertyImplCopyWith<
          _$DevicesModuleChannelPropertyImpl>
      get copyWith => __$$DevicesModuleChannelPropertyImplCopyWithImpl<
          _$DevicesModuleChannelPropertyImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleChannelPropertyImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleChannelProperty
    implements DevicesModuleChannelProperty {
  const factory _DevicesModuleChannelProperty(
      {required final String id,
      required final String type,
      required final DevicesModuleChannelPropertyCategory category,
      required final String? name,
      required final List<DevicesModuleChannelPropertyPermissions> permissions,
      required final String? unit,
      required final List<dynamic>? format,
      required final dynamic invalid,
      required final num? step,
      required final dynamic value,
      required final String channel,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      @JsonKey(name: 'data_type')
      final DevicesModuleChannelPropertyDataType
          dataType}) = _$DevicesModuleChannelPropertyImpl;

  factory _DevicesModuleChannelProperty.fromJson(Map<String, dynamic> json) =
      _$DevicesModuleChannelPropertyImpl.fromJson;

  /// System-generated unique identifier for the channel property.
  @override
  String get id;

  /// Specifies the type of channel property.
  @override
  String get type;

  /// Defines the category of the property, representing its functionality or characteristic.
  @override
  DevicesModuleChannelPropertyCategory get category;

  /// Optional name of the property for easier identification.
  @override
  String? get name;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  @override
  List<DevicesModuleChannelPropertyPermissions> get permissions;

  /// Measurement unit associated with the property’s value, if applicable.
  @override
  String? get unit;

  /// List of valid values or states for the property, where applicable.
  @override
  List<dynamic>? get format;

  /// Value to represent an invalid state for the property.
  @override
  dynamic get invalid;

  /// Step value indicating the smallest increment for the property.
  @override
  num? get step;

  /// Current value of the property.
  @override
  dynamic get value;

  /// Reference to the channel that this property belongs to.
  @override
  String get channel;

  /// Timestamp when the control was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// Timestamp when the control was last updated, if applicable.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// Data type of the property’s value, e.g., string, integer, or boolean.
  @override
  @JsonKey(name: 'data_type')
  DevicesModuleChannelPropertyDataType get dataType;

  /// Create a copy of DevicesModuleChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleChannelPropertyImplCopyWith<
          _$DevicesModuleChannelPropertyImpl>
      get copyWith => throw _privateConstructorUsedError;
}
