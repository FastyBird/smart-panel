// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_home_assistant_plugin_create_home_assistant_channel_property.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty
    _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyFromJson(
        Map<String, dynamic> json) {
  return _DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty.fromJson(
      json);
}

/// @nodoc
mixin _$DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty {
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

  /// A HA device entity identifier.
  @JsonKey(name: 'ha_entity_id')
  String get haEntityId => throw _privateConstructorUsedError;

  /// A HA device entity attribute.
  @JsonKey(name: 'ha_attribute')
  String get haAttribute => throw _privateConstructorUsedError;

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

  /// Serializes this DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyCopyWith<
          DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyCopyWith<
    $Res> {
  factory $DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyCopyWith(
          DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty value,
          $Res Function(
                  DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty)
              then) =
      _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyCopyWithImpl<
          $Res, DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty>;
  @useResult
  $Res call(
      {String id,
      String type,
      DevicesModuleChannelPropertyCategory category,
      List<DevicesModuleCreateChannelPropertyPermissions> permissions,
      @JsonKey(name: 'data_type')
      DevicesModuleCreateChannelPropertyDataType dataType,
      @JsonKey(name: 'ha_entity_id') String haEntityId,
      @JsonKey(name: 'ha_attribute') String haAttribute,
      String? name,
      String? unit,
      List<dynamic>? format,
      dynamic invalid,
      num? step,
      dynamic value});
}

/// @nodoc
class _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyCopyWithImpl<
        $Res,
        $Val extends DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty>
    implements
        $DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyCopyWith<
            $Res> {
  _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? category = null,
    Object? permissions = null,
    Object? dataType = null,
    Object? haEntityId = null,
    Object? haAttribute = null,
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
      haEntityId: null == haEntityId
          ? _value.haEntityId
          : haEntityId // ignore: cast_nullable_to_non_nullable
              as String,
      haAttribute: null == haAttribute
          ? _value.haAttribute
          : haAttribute // ignore: cast_nullable_to_non_nullable
              as String,
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
abstract class _$$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImplCopyWith<
        $Res>
    implements
        $DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyCopyWith<
            $Res> {
  factory _$$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImplCopyWith(
          _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl value,
          $Res Function(
                  _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl)
              then) =
      __$$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImplCopyWithImpl<
          $Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      DevicesModuleChannelPropertyCategory category,
      List<DevicesModuleCreateChannelPropertyPermissions> permissions,
      @JsonKey(name: 'data_type')
      DevicesModuleCreateChannelPropertyDataType dataType,
      @JsonKey(name: 'ha_entity_id') String haEntityId,
      @JsonKey(name: 'ha_attribute') String haAttribute,
      String? name,
      String? unit,
      List<dynamic>? format,
      dynamic invalid,
      num? step,
      dynamic value});
}

/// @nodoc
class __$$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImplCopyWithImpl<
        $Res>
    extends _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyCopyWithImpl<
        $Res,
        _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl>
    implements
        _$$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImplCopyWith<
            $Res> {
  __$$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImplCopyWithImpl(
      _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl _value,
      $Res Function(
              _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? category = null,
    Object? permissions = null,
    Object? dataType = null,
    Object? haEntityId = null,
    Object? haAttribute = null,
    Object? name = freezed,
    Object? unit = freezed,
    Object? format = freezed,
    Object? invalid = freezed,
    Object? step = freezed,
    Object? value = freezed,
  }) {
    return _then(
        _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl(
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
      haEntityId: null == haEntityId
          ? _value.haEntityId
          : haEntityId // ignore: cast_nullable_to_non_nullable
              as String,
      haAttribute: null == haAttribute
          ? _value.haAttribute
          : haAttribute // ignore: cast_nullable_to_non_nullable
              as String,
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
class _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl
    implements _DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty {
  const _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl(
      {required this.id,
      required this.type,
      required this.category,
      required final List<DevicesModuleCreateChannelPropertyPermissions>
          permissions,
      @JsonKey(name: 'data_type') required this.dataType,
      @JsonKey(name: 'ha_entity_id') required this.haEntityId,
      @JsonKey(name: 'ha_attribute') required this.haAttribute,
      this.name,
      this.unit,
      final List<dynamic>? format,
      this.invalid,
      this.step,
      this.value})
      : _permissions = permissions,
        _format = format;

  factory _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImplFromJson(
          json);

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

  /// A HA device entity identifier.
  @override
  @JsonKey(name: 'ha_entity_id')
  final String haEntityId;

  /// A HA device entity attribute.
  @override
  @JsonKey(name: 'ha_attribute')
  final String haAttribute;

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
    return 'DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty(id: $id, type: $type, category: $category, permissions: $permissions, dataType: $dataType, haEntityId: $haEntityId, haAttribute: $haAttribute, name: $name, unit: $unit, format: $format, invalid: $invalid, step: $step, value: $value)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other
                is _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.category, category) ||
                other.category == category) &&
            const DeepCollectionEquality()
                .equals(other._permissions, _permissions) &&
            (identical(other.dataType, dataType) ||
                other.dataType == dataType) &&
            (identical(other.haEntityId, haEntityId) ||
                other.haEntityId == haEntityId) &&
            (identical(other.haAttribute, haAttribute) ||
                other.haAttribute == haAttribute) &&
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
      haEntityId,
      haAttribute,
      name,
      unit,
      const DeepCollectionEquality().hash(_format),
      const DeepCollectionEquality().hash(invalid),
      step,
      const DeepCollectionEquality().hash(value));

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImplCopyWith<
          _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl>
      get copyWith =>
          __$$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImplCopyWithImpl<
                  _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImplToJson(
      this,
    );
  }
}

abstract class _DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty
    implements DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty {
  const factory _DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty(
          {required final String id,
          required final String type,
          required final DevicesModuleChannelPropertyCategory category,
          required final List<DevicesModuleCreateChannelPropertyPermissions>
              permissions,
          @JsonKey(name: 'data_type')
          required final DevicesModuleCreateChannelPropertyDataType dataType,
          @JsonKey(name: 'ha_entity_id') required final String haEntityId,
          @JsonKey(name: 'ha_attribute') required final String haAttribute,
          final String? name,
          final String? unit,
          final List<dynamic>? format,
          final dynamic invalid,
          final num? step,
          final dynamic value}) =
      _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl;

  factory _DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty.fromJson(
          Map<String, dynamic> json) =
      _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl
      .fromJson;

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

  /// A HA device entity identifier.
  @override
  @JsonKey(name: 'ha_entity_id')
  String get haEntityId;

  /// A HA device entity attribute.
  @override
  @JsonKey(name: 'ha_attribute')
  String get haAttribute;

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

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantChannelProperty
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImplCopyWith<
          _$DevicesHomeAssistantPluginCreateHomeAssistantChannelPropertyImpl>
      get copyWith => throw _privateConstructorUsedError;
}
