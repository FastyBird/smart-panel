// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_channel_property.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesChannelProperty _$DevicesChannelPropertyFromJson(
    Map<String, dynamic> json) {
  return _DevicesChannelProperty.fromJson(json);
}

/// @nodoc
mixin _$DevicesChannelProperty {
  /// System-generated unique identifier for the channel property.
  String get id => throw _privateConstructorUsedError;

  /// Defines the category of the property, representing its functionality or characteristic.
  DevicesChannelPropertyCategory get category =>
      throw _privateConstructorUsedError;

  /// Optional name of the property for easier identification.
  String? get name => throw _privateConstructorUsedError;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  List<DevicesChannelPropertyPermissions> get permissions =>
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
  DevicesChannelPropertyDataType get dataType =>
      throw _privateConstructorUsedError;

  /// Serializes this DevicesChannelProperty to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesChannelPropertyCopyWith<DevicesChannelProperty> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesChannelPropertyCopyWith<$Res> {
  factory $DevicesChannelPropertyCopyWith(DevicesChannelProperty value,
          $Res Function(DevicesChannelProperty) then) =
      _$DevicesChannelPropertyCopyWithImpl<$Res, DevicesChannelProperty>;
  @useResult
  $Res call(
      {String id,
      DevicesChannelPropertyCategory category,
      String? name,
      List<DevicesChannelPropertyPermissions> permissions,
      String? unit,
      List<dynamic>? format,
      dynamic invalid,
      num? step,
      dynamic value,
      String channel,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      @JsonKey(name: 'data_type') DevicesChannelPropertyDataType dataType});
}

/// @nodoc
class _$DevicesChannelPropertyCopyWithImpl<$Res,
        $Val extends DevicesChannelProperty>
    implements $DevicesChannelPropertyCopyWith<$Res> {
  _$DevicesChannelPropertyCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
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
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as DevicesChannelPropertyCategory,
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
      permissions: null == permissions
          ? _value.permissions
          : permissions // ignore: cast_nullable_to_non_nullable
              as List<DevicesChannelPropertyPermissions>,
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
              as DevicesChannelPropertyDataType,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesChannelPropertyImplCopyWith<$Res>
    implements $DevicesChannelPropertyCopyWith<$Res> {
  factory _$$DevicesChannelPropertyImplCopyWith(
          _$DevicesChannelPropertyImpl value,
          $Res Function(_$DevicesChannelPropertyImpl) then) =
      __$$DevicesChannelPropertyImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      DevicesChannelPropertyCategory category,
      String? name,
      List<DevicesChannelPropertyPermissions> permissions,
      String? unit,
      List<dynamic>? format,
      dynamic invalid,
      num? step,
      dynamic value,
      String channel,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      @JsonKey(name: 'data_type') DevicesChannelPropertyDataType dataType});
}

/// @nodoc
class __$$DevicesChannelPropertyImplCopyWithImpl<$Res>
    extends _$DevicesChannelPropertyCopyWithImpl<$Res,
        _$DevicesChannelPropertyImpl>
    implements _$$DevicesChannelPropertyImplCopyWith<$Res> {
  __$$DevicesChannelPropertyImplCopyWithImpl(
      _$DevicesChannelPropertyImpl _value,
      $Res Function(_$DevicesChannelPropertyImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
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
    return _then(_$DevicesChannelPropertyImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as DevicesChannelPropertyCategory,
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
      permissions: null == permissions
          ? _value._permissions
          : permissions // ignore: cast_nullable_to_non_nullable
              as List<DevicesChannelPropertyPermissions>,
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
              as DevicesChannelPropertyDataType,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesChannelPropertyImpl implements _DevicesChannelProperty {
  const _$DevicesChannelPropertyImpl(
      {required this.id,
      required this.category,
      required this.name,
      required final List<DevicesChannelPropertyPermissions> permissions,
      required this.unit,
      required final List<dynamic>? format,
      required this.invalid,
      required this.step,
      required this.value,
      required this.channel,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      @JsonKey(name: 'data_type')
      this.dataType = DevicesChannelPropertyDataType.unknown})
      : _permissions = permissions,
        _format = format;

  factory _$DevicesChannelPropertyImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesChannelPropertyImplFromJson(json);

  /// System-generated unique identifier for the channel property.
  @override
  final String id;

  /// Defines the category of the property, representing its functionality or characteristic.
  @override
  final DevicesChannelPropertyCategory category;

  /// Optional name of the property for easier identification.
  @override
  final String? name;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  final List<DevicesChannelPropertyPermissions> _permissions;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  @override
  List<DevicesChannelPropertyPermissions> get permissions {
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
  final DevicesChannelPropertyDataType dataType;

  @override
  String toString() {
    return 'DevicesChannelProperty(id: $id, category: $category, name: $name, permissions: $permissions, unit: $unit, format: $format, invalid: $invalid, step: $step, value: $value, channel: $channel, createdAt: $createdAt, updatedAt: $updatedAt, dataType: $dataType)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesChannelPropertyImpl &&
            (identical(other.id, id) || other.id == id) &&
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

  /// Create a copy of DevicesChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesChannelPropertyImplCopyWith<_$DevicesChannelPropertyImpl>
      get copyWith => __$$DevicesChannelPropertyImplCopyWithImpl<
          _$DevicesChannelPropertyImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesChannelPropertyImplToJson(
      this,
    );
  }
}

abstract class _DevicesChannelProperty implements DevicesChannelProperty {
  const factory _DevicesChannelProperty(
          {required final String id,
          required final DevicesChannelPropertyCategory category,
          required final String? name,
          required final List<DevicesChannelPropertyPermissions> permissions,
          required final String? unit,
          required final List<dynamic>? format,
          required final dynamic invalid,
          required final num? step,
          required final dynamic value,
          required final String channel,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
          @JsonKey(name: 'data_type')
          final DevicesChannelPropertyDataType dataType}) =
      _$DevicesChannelPropertyImpl;

  factory _DevicesChannelProperty.fromJson(Map<String, dynamic> json) =
      _$DevicesChannelPropertyImpl.fromJson;

  /// System-generated unique identifier for the channel property.
  @override
  String get id;

  /// Defines the category of the property, representing its functionality or characteristic.
  @override
  DevicesChannelPropertyCategory get category;

  /// Optional name of the property for easier identification.
  @override
  String? get name;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  @override
  List<DevicesChannelPropertyPermissions> get permissions;

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
  DevicesChannelPropertyDataType get dataType;

  /// Create a copy of DevicesChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesChannelPropertyImplCopyWith<_$DevicesChannelPropertyImpl>
      get copyWith => throw _privateConstructorUsedError;
}
