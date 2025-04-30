// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_create_channel_property.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleCreateChannelProperty _$DevicesModuleCreateChannelPropertyFromJson(
    Map<String, dynamic> json) {
  return _DevicesModuleCreateChannelProperty.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleCreateChannelProperty {
  /// Unique identifier for the property. Optional during creation and system-generated if not provided.
  String get id => throw _privateConstructorUsedError;

  /// Specifies the type of channel property.
  String get type => throw _privateConstructorUsedError;

  /// Defines the category of the property, representing its functionality or characteristic.
  DevicesModuleChannelPropertyCategory get category =>
      throw _privateConstructorUsedError;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  List<DevicesModuleCreateChannelPropertyPermissions> get permissions =>
      throw _privateConstructorUsedError;

  /// Data type of the property’s value, e.g., string, integer, or boolean.
  @JsonKey(name: 'data_type')
  DevicesModuleCreateChannelPropertyDataType get dataType =>
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

  /// Serializes this DevicesModuleCreateChannelProperty to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleCreateChannelPropertyCopyWith<
          DevicesModuleCreateChannelProperty>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleCreateChannelPropertyCopyWith<$Res> {
  factory $DevicesModuleCreateChannelPropertyCopyWith(
          DevicesModuleCreateChannelProperty value,
          $Res Function(DevicesModuleCreateChannelProperty) then) =
      _$DevicesModuleCreateChannelPropertyCopyWithImpl<$Res,
          DevicesModuleCreateChannelProperty>;
  @useResult
  $Res call(
      {String id,
      String type,
      DevicesModuleChannelPropertyCategory category,
      List<DevicesModuleCreateChannelPropertyPermissions> permissions,
      @JsonKey(name: 'data_type')
      DevicesModuleCreateChannelPropertyDataType dataType,
      String? name,
      String? unit,
      List<dynamic>? format,
      dynamic invalid,
      num? step,
      dynamic value});
}

/// @nodoc
class _$DevicesModuleCreateChannelPropertyCopyWithImpl<$Res,
        $Val extends DevicesModuleCreateChannelProperty>
    implements $DevicesModuleCreateChannelPropertyCopyWith<$Res> {
  _$DevicesModuleCreateChannelPropertyCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
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
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as DevicesModuleChannelPropertyCategory,
      permissions: null == permissions
          ? _value.permissions
          : permissions // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleCreateChannelPropertyPermissions>,
      dataType: null == dataType
          ? _value.dataType
          : dataType // ignore: cast_nullable_to_non_nullable
              as DevicesModuleCreateChannelPropertyDataType,
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
abstract class _$$DevicesModuleCreateChannelPropertyImplCopyWith<$Res>
    implements $DevicesModuleCreateChannelPropertyCopyWith<$Res> {
  factory _$$DevicesModuleCreateChannelPropertyImplCopyWith(
          _$DevicesModuleCreateChannelPropertyImpl value,
          $Res Function(_$DevicesModuleCreateChannelPropertyImpl) then) =
      __$$DevicesModuleCreateChannelPropertyImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      DevicesModuleChannelPropertyCategory category,
      List<DevicesModuleCreateChannelPropertyPermissions> permissions,
      @JsonKey(name: 'data_type')
      DevicesModuleCreateChannelPropertyDataType dataType,
      String? name,
      String? unit,
      List<dynamic>? format,
      dynamic invalid,
      num? step,
      dynamic value});
}

/// @nodoc
class __$$DevicesModuleCreateChannelPropertyImplCopyWithImpl<$Res>
    extends _$DevicesModuleCreateChannelPropertyCopyWithImpl<$Res,
        _$DevicesModuleCreateChannelPropertyImpl>
    implements _$$DevicesModuleCreateChannelPropertyImplCopyWith<$Res> {
  __$$DevicesModuleCreateChannelPropertyImplCopyWithImpl(
      _$DevicesModuleCreateChannelPropertyImpl _value,
      $Res Function(_$DevicesModuleCreateChannelPropertyImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
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
    return _then(_$DevicesModuleCreateChannelPropertyImpl(
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
      permissions: null == permissions
          ? _value._permissions
          : permissions // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleCreateChannelPropertyPermissions>,
      dataType: null == dataType
          ? _value.dataType
          : dataType // ignore: cast_nullable_to_non_nullable
              as DevicesModuleCreateChannelPropertyDataType,
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
class _$DevicesModuleCreateChannelPropertyImpl
    implements _DevicesModuleCreateChannelProperty {
  const _$DevicesModuleCreateChannelPropertyImpl(
      {required this.id,
      required this.type,
      required this.category,
      required final List<DevicesModuleCreateChannelPropertyPermissions>
          permissions,
      @JsonKey(name: 'data_type') required this.dataType,
      this.name,
      this.unit,
      final List<dynamic>? format,
      this.invalid,
      this.step,
      this.value})
      : _permissions = permissions,
        _format = format;

  factory _$DevicesModuleCreateChannelPropertyImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesModuleCreateChannelPropertyImplFromJson(json);

  /// Unique identifier for the property. Optional during creation and system-generated if not provided.
  @override
  final String id;

  /// Specifies the type of channel property.
  @override
  final String type;

  /// Defines the category of the property, representing its functionality or characteristic.
  @override
  final DevicesModuleChannelPropertyCategory category;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  final List<DevicesModuleCreateChannelPropertyPermissions> _permissions;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  @override
  List<DevicesModuleCreateChannelPropertyPermissions> get permissions {
    if (_permissions is EqualUnmodifiableListView) return _permissions;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_permissions);
  }

  /// Data type of the property’s value, e.g., string, integer, or boolean.
  @override
  @JsonKey(name: 'data_type')
  final DevicesModuleCreateChannelPropertyDataType dataType;

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
    return 'DevicesModuleCreateChannelProperty(id: $id, type: $type, category: $category, permissions: $permissions, dataType: $dataType, name: $name, unit: $unit, format: $format, invalid: $invalid, step: $step, value: $value)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleCreateChannelPropertyImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
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
      type,
      category,
      const DeepCollectionEquality().hash(_permissions),
      dataType,
      name,
      unit,
      const DeepCollectionEquality().hash(_format),
      const DeepCollectionEquality().hash(invalid),
      step,
      const DeepCollectionEquality().hash(value));

  /// Create a copy of DevicesModuleCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleCreateChannelPropertyImplCopyWith<
          _$DevicesModuleCreateChannelPropertyImpl>
      get copyWith => __$$DevicesModuleCreateChannelPropertyImplCopyWithImpl<
          _$DevicesModuleCreateChannelPropertyImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleCreateChannelPropertyImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleCreateChannelProperty
    implements DevicesModuleCreateChannelProperty {
  const factory _DevicesModuleCreateChannelProperty(
      {required final String id,
      required final String type,
      required final DevicesModuleChannelPropertyCategory category,
      required final List<DevicesModuleCreateChannelPropertyPermissions>
          permissions,
      @JsonKey(name: 'data_type')
      required final DevicesModuleCreateChannelPropertyDataType dataType,
      final String? name,
      final String? unit,
      final List<dynamic>? format,
      final dynamic invalid,
      final num? step,
      final dynamic value}) = _$DevicesModuleCreateChannelPropertyImpl;

  factory _DevicesModuleCreateChannelProperty.fromJson(
          Map<String, dynamic> json) =
      _$DevicesModuleCreateChannelPropertyImpl.fromJson;

  /// Unique identifier for the property. Optional during creation and system-generated if not provided.
  @override
  String get id;

  /// Specifies the type of channel property.
  @override
  String get type;

  /// Defines the category of the property, representing its functionality or characteristic.
  @override
  DevicesModuleChannelPropertyCategory get category;

  /// Access level for the property: read-only (ro), read-write (rw), write-only (wo), or event-only (ev).
  @override
  List<DevicesModuleCreateChannelPropertyPermissions> get permissions;

  /// Data type of the property’s value, e.g., string, integer, or boolean.
  @override
  @JsonKey(name: 'data_type')
  DevicesModuleCreateChannelPropertyDataType get dataType;

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

  /// Create a copy of DevicesModuleCreateChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleCreateChannelPropertyImplCopyWith<
          _$DevicesModuleCreateChannelPropertyImpl>
      get copyWith => throw _privateConstructorUsedError;
}
