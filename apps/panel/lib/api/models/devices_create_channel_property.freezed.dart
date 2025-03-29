// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_create_channel_property.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesCreateChannelProperty _$DevicesCreateChannelPropertyFromJson(
    Map<String, dynamic> json) {
  return _DevicesCreateChannelProperty.fromJson(json);
}

/// @nodoc
mixin _$DevicesCreateChannelProperty {
  /// Unique identifier for the property. Optional during creation and system-generated if not provided.
  String get id => throw _privateConstructorUsedError;

  /// Defines the category of the property, representing its functionality or characteristic.
  DevicesChannelPropertyCategory get category =>
      throw _privateConstructorUsedError;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  List<DevicesCreateChannelPropertyPermissions> get permissions =>
      throw _privateConstructorUsedError;

  /// Data type of the property’s value, e.g., string, integer, or boolean.
  @JsonKey(name: 'data_type')
  DevicesCreateChannelPropertyDataType get dataType =>
      throw _privateConstructorUsedError;

  /// Optional name of the property for easier identification.
  String? get name => throw _privateConstructorUsedError;

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

  /// Serializes this DevicesCreateChannelProperty to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesCreateChannelPropertyCopyWith<DevicesCreateChannelProperty>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesCreateChannelPropertyCopyWith<$Res> {
  factory $DevicesCreateChannelPropertyCopyWith(
          DevicesCreateChannelProperty value,
          $Res Function(DevicesCreateChannelProperty) then) =
      _$DevicesCreateChannelPropertyCopyWithImpl<$Res,
          DevicesCreateChannelProperty>;
  @useResult
  $Res call(
      {String id,
      DevicesChannelPropertyCategory category,
      List<DevicesCreateChannelPropertyPermissions> permissions,
      @JsonKey(name: 'data_type') DevicesCreateChannelPropertyDataType dataType,
      String? name,
      String? unit,
      List<dynamic>? format,
      dynamic invalid,
      num? step,
      dynamic value});
}

/// @nodoc
class _$DevicesCreateChannelPropertyCopyWithImpl<$Res,
        $Val extends DevicesCreateChannelProperty>
    implements $DevicesCreateChannelPropertyCopyWith<$Res> {
  _$DevicesCreateChannelPropertyCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? category = null,
    Object? permissions = null,
    Object? dataType = null,
    Object? name = freezed,
    Object? unit = freezed,
    Object? format = freezed,
    Object? invalid = freezed,
    Object? step = freezed,
    Object? value = freezed,
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
      permissions: null == permissions
          ? _value.permissions
          : permissions // ignore: cast_nullable_to_non_nullable
              as List<DevicesCreateChannelPropertyPermissions>,
      dataType: null == dataType
          ? _value.dataType
          : dataType // ignore: cast_nullable_to_non_nullable
              as DevicesCreateChannelPropertyDataType,
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
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
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesCreateChannelPropertyImplCopyWith<$Res>
    implements $DevicesCreateChannelPropertyCopyWith<$Res> {
  factory _$$DevicesCreateChannelPropertyImplCopyWith(
          _$DevicesCreateChannelPropertyImpl value,
          $Res Function(_$DevicesCreateChannelPropertyImpl) then) =
      __$$DevicesCreateChannelPropertyImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      DevicesChannelPropertyCategory category,
      List<DevicesCreateChannelPropertyPermissions> permissions,
      @JsonKey(name: 'data_type') DevicesCreateChannelPropertyDataType dataType,
      String? name,
      String? unit,
      List<dynamic>? format,
      dynamic invalid,
      num? step,
      dynamic value});
}

/// @nodoc
class __$$DevicesCreateChannelPropertyImplCopyWithImpl<$Res>
    extends _$DevicesCreateChannelPropertyCopyWithImpl<$Res,
        _$DevicesCreateChannelPropertyImpl>
    implements _$$DevicesCreateChannelPropertyImplCopyWith<$Res> {
  __$$DevicesCreateChannelPropertyImplCopyWithImpl(
      _$DevicesCreateChannelPropertyImpl _value,
      $Res Function(_$DevicesCreateChannelPropertyImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? category = null,
    Object? permissions = null,
    Object? dataType = null,
    Object? name = freezed,
    Object? unit = freezed,
    Object? format = freezed,
    Object? invalid = freezed,
    Object? step = freezed,
    Object? value = freezed,
  }) {
    return _then(_$DevicesCreateChannelPropertyImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as DevicesChannelPropertyCategory,
      permissions: null == permissions
          ? _value._permissions
          : permissions // ignore: cast_nullable_to_non_nullable
              as List<DevicesCreateChannelPropertyPermissions>,
      dataType: null == dataType
          ? _value.dataType
          : dataType // ignore: cast_nullable_to_non_nullable
              as DevicesCreateChannelPropertyDataType,
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
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
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesCreateChannelPropertyImpl
    implements _DevicesCreateChannelProperty {
  const _$DevicesCreateChannelPropertyImpl(
      {required this.id,
      required this.category,
      required final List<DevicesCreateChannelPropertyPermissions> permissions,
      @JsonKey(name: 'data_type') required this.dataType,
      this.name,
      this.unit,
      final List<dynamic>? format,
      this.invalid,
      this.step,
      this.value})
      : _permissions = permissions,
        _format = format;

  factory _$DevicesCreateChannelPropertyImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesCreateChannelPropertyImplFromJson(json);

  /// Unique identifier for the property. Optional during creation and system-generated if not provided.
  @override
  final String id;

  /// Defines the category of the property, representing its functionality or characteristic.
  @override
  final DevicesChannelPropertyCategory category;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  final List<DevicesCreateChannelPropertyPermissions> _permissions;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  @override
  List<DevicesCreateChannelPropertyPermissions> get permissions {
    if (_permissions is EqualUnmodifiableListView) return _permissions;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_permissions);
  }

  /// Data type of the property’s value, e.g., string, integer, or boolean.
  @override
  @JsonKey(name: 'data_type')
  final DevicesCreateChannelPropertyDataType dataType;

  /// Optional name of the property for easier identification.
  @override
  final String? name;

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

  @override
  String toString() {
    return 'DevicesCreateChannelProperty(id: $id, category: $category, permissions: $permissions, dataType: $dataType, name: $name, unit: $unit, format: $format, invalid: $invalid, step: $step, value: $value)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesCreateChannelPropertyImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.category, category) ||
                other.category == category) &&
            const DeepCollectionEquality()
                .equals(other._permissions, _permissions) &&
            (identical(other.dataType, dataType) ||
                other.dataType == dataType) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.unit, unit) || other.unit == unit) &&
            const DeepCollectionEquality().equals(other._format, _format) &&
            const DeepCollectionEquality().equals(other.invalid, invalid) &&
            (identical(other.step, step) || other.step == step) &&
            const DeepCollectionEquality().equals(other.value, value));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      category,
      const DeepCollectionEquality().hash(_permissions),
      dataType,
      name,
      unit,
      const DeepCollectionEquality().hash(_format),
      const DeepCollectionEquality().hash(invalid),
      step,
      const DeepCollectionEquality().hash(value));

  /// Create a copy of DevicesCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesCreateChannelPropertyImplCopyWith<
          _$DevicesCreateChannelPropertyImpl>
      get copyWith => __$$DevicesCreateChannelPropertyImplCopyWithImpl<
          _$DevicesCreateChannelPropertyImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesCreateChannelPropertyImplToJson(
      this,
    );
  }
}

abstract class _DevicesCreateChannelProperty
    implements DevicesCreateChannelProperty {
  const factory _DevicesCreateChannelProperty(
      {required final String id,
      required final DevicesChannelPropertyCategory category,
      required final List<DevicesCreateChannelPropertyPermissions> permissions,
      @JsonKey(name: 'data_type')
      required final DevicesCreateChannelPropertyDataType dataType,
      final String? name,
      final String? unit,
      final List<dynamic>? format,
      final dynamic invalid,
      final num? step,
      final dynamic value}) = _$DevicesCreateChannelPropertyImpl;

  factory _DevicesCreateChannelProperty.fromJson(Map<String, dynamic> json) =
      _$DevicesCreateChannelPropertyImpl.fromJson;

  /// Unique identifier for the property. Optional during creation and system-generated if not provided.
  @override
  String get id;

  /// Defines the category of the property, representing its functionality or characteristic.
  @override
  DevicesChannelPropertyCategory get category;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  @override
  List<DevicesCreateChannelPropertyPermissions> get permissions;

  /// Data type of the property’s value, e.g., string, integer, or boolean.
  @override
  @JsonKey(name: 'data_type')
  DevicesCreateChannelPropertyDataType get dataType;

  /// Optional name of the property for easier identification.
  @override
  String? get name;

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

  /// Create a copy of DevicesCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesCreateChannelPropertyImplCopyWith<
          _$DevicesCreateChannelPropertyImpl>
      get copyWith => throw _privateConstructorUsedError;
}
