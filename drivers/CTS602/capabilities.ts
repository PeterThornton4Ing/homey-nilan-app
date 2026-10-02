export const DeviceCapabilities: Map<number, Array<string>> = new Map([
 [ -1, [ 
   "target_temperature", "measure_temperature",
   "target_temperature.water", "measure_temperature.water",
   "target_temperature.ek",
   "nl_target_humidity",
   "fan_speed.inlet1", "fan_speed.inlet2", "fan_speed.inlet3", "fan_speed.inlet4",
   "fan_speed.exhaust1", "fan_speed.exhaust2", "fan_speed.exhaust3", "fan_speed.exhaust4",
   "fan_mode.ventilation",
   "pump_mode.run", "pump_mode.mode", "pump_mode.air_exchange", "pump_mode.power_save",
   "insights_number.compressor_state", "insights_number.hot_water_state", "insights_number.externalheater",
   "insights_number.waterpump_state", "insights_number.defrosting_state",
   "insights_number.electricheater", "insights_number.ventilation",
   "insights_number.run_state",
   "insights_dec_number.T0_controller", "insights_dec_number.T1_intake", "insights_dec_number.T2_inlet", "insights_dec_number.T3_exhaust",
   "insights_dec_number.T4_outlet", "insights_dec_number.T5_cond", "insights_dec_number.T6_evap", "insights_dec_number.T7_inlet",
   "insights_dec_number.T8_outdoor", "insights_dec_number.T9_heater", "insights_dec_number.T10_extern",
   "insights_dec_number.T11_water_top", "insights_dec_number.T12_water_bottom", "insights_dec_number.T14_supply",
   "insights_dec_number.T15_room", "insights_dec_number.T16_aux",
   "insights_dec_number.heater_capacity", "insights_dec_number.central_heater_capacity",
   "compressor_state",
   "electricheater",
   "externalheater",
   "hot_water_state",
   "waterpump_state",
   "defrosting_state",
   "measure_humidity",
   "measure_temperature.indoor", "measure_temperature.outdoor", "measure_temperature.water_current",
   "measure_temperature.ek_supply",
   "measure_temperature.controller", "measure_temperature.intake", "measure_temperature.inlet_before", "measure_temperature.exhaust",
   "measure_temperature.outlet", "measure_temperature.cond", "measure_temperature.evap", "measure_temperature.inlet_after",
   "measure_temperature.heater", "measure_temperature.extern", "measure_temperature.water_top", "measure_temperature.water_bottom",
   "measure_temperature.panel", "measure_temperature.aux",
   "fanstep_enum.ventilation", "fanstep.inlet", "fanstep.exhaust", "fanspeed.inlet", "fanspeed.exhaust",
   "capacity.airheat", "capacity.cenheat",
   "filter_days.left", "filter_days.since",
   "run_state", "heatpump_mode", "heatpump_state", "air_exchange_mode", "power_save_mode",
   "cts602_type", "heatpump_typecode",
   "hidden_string.version_major", "hidden_string.version_minor", "hidden_string.version_release",
   "firmware_version", "bus_version",
   "hidden_number.alarm_count", "alarm_generic.filter", "alarm_pump_device"
 ]],
 [ 21, [ 
   "target_temperature", "measure_temperature",
   "target_temperature.water", "measure_temperature.water",
   "target_temperature.ek",
   "nl_target_humidity",
   "fan_speed.inlet1", "fan_speed.inlet2", "fan_speed.inlet3", "fan_speed.inlet4",
   "fan_speed.exhaust1", "fan_speed.exhaust2", "fan_speed.exhaust3", "fan_speed.exhaust4",
   "fan_mode.ventilation",
   "pump_mode.run", "pump_mode.mode", "pump_mode.air_exchange", "pump_mode.power_save",
   "insights_number.compressor_state", "insights_number.hot_water_state",
   "insights_number.waterpump_state", "insights_number.defrosting_state",
   "insights_number.electricheater", "insights_number.ventilation",
   "insights_number.run_state",
   "insights_dec_number.T0_controller", "insights_dec_number.T1_intake", "insights_dec_number.T2_inlet",
   "insights_dec_number.T5_cond", "insights_dec_number.T6_evap", "insights_dec_number.T7_inlet",
   "insights_dec_number.T8_outdoor", "insights_dec_number.T10_extern",
   "insights_dec_number.T11_water_top", "insights_dec_number.T12_water_bottom", "insights_dec_number.T14_supply",
   "insights_dec_number.T15_room", "insights_dec_number.T16_aux",
   "insights_dec_number.central_heater_capacity",
   "compressor_state",
   "electricheater",
   "hot_water_state",
   "waterpump_state",
   "defrosting_state",
   "measure_humidity",
   "measure_temperature.indoor", "measure_temperature.outdoor", "measure_temperature.water_current",
   "measure_temperature.ek_supply",
   "measure_temperature.controller", "measure_temperature.intake", "measure_temperature.inlet_before",
   "measure_temperature.cond", "measure_temperature.evap", "measure_temperature.inlet_after",
   "measure_temperature.extern", "measure_temperature.water_top", "measure_temperature.water_bottom",
   "measure_temperature.panel",
   "fanstep_enum.ventilation", "fanstep.inlet", "fanspeed.inlet", "fanspeed.exhaust",
   "capacity.cenheat",
   "filter_days.left", "filter_days.since",
   "run_state", "heatpump_mode", "heatpump_state", "air_exchange_mode", "power_save_mode",
   "cts602_type", "heatpump_typecode",
   "hidden_string.version_major", "hidden_string.version_minor", "hidden_string.version_release",
   "firmware_version", "bus_version",
   "hidden_number.alarm_count", "alarm_generic.filter", "alarm_pump_device"
 ]]
]);

/* Device profiles:
   heatpump    - full CTS602 heat pump plants (default)
   ventilation - full CTS602 Comfort family; no compressor, hot water tank or central heating (EK)
   light       - CTS602 Light firmware (e.g. Comfort CT series); ventilation only with a reduced
                 register map, see docs/2019_03_Modbus_CTS602Light_Modbus.pdf */
export type DeviceProfile = 'heatpump' | 'ventilation' | 'light';

export const VENTILATION_MODELS: Array<number> = [ 13, 14, 27, 31 ];

export const getDeviceProfile = ((data: { model?: number, profile?: string }): DeviceProfile => {
  if (data.profile === 'light') return 'light';
  return data.model !== undefined && VENTILATION_MODELS.includes(data.model) ? 'ventilation' : 'heatpump';
});

export const VENTILATION_EXCLUDED_CAPABILITIES: Array<string> = [
  "target_temperature.water", "measure_temperature.water", "target_temperature.ek",
  "pump_mode.air_exchange", "air_exchange_mode",
  "insights_number.compressor_state", "insights_number.hot_water_state", "insights_number.externalheater",
  "insights_number.waterpump_state", "insights_number.electricheater",
  "insights_dec_number.T5_cond", "insights_dec_number.T6_evap",
  "insights_dec_number.T11_water_top", "insights_dec_number.T12_water_bottom",
  "insights_dec_number.T13_return", "insights_dec_number.T14_supply", "insights_dec_number.T16_aux",
  "insights_dec_number.heater_capacity", "insights_dec_number.central_heater_capacity",
  "insights_dec_number.compressor_capacity",
  "compressor_state", "electricheater", "externalheater", "hot_water_state", "waterpump_state",
  "measure_temperature.water_current", "measure_temperature.ek_supply", "measure_temperature.ek_return",
  "measure_temperature.cond", "measure_temperature.evap",
  "measure_temperature.water_top", "measure_temperature.water_bottom", "measure_temperature.aux",
  "capacity.cenheat", "capacity.compressor"
];

/* Sensors and outputs that CTS602 Light does not implement (Modbus exception on read), plus the
   full CTS602 type enum, whose model names do not apply to Light type codes. */
export const LIGHT_EXCLUDED_CAPABILITIES: Array<string> = [
  ...VENTILATION_EXCLUDED_CAPABILITIES,
  "measure_temperature.intake", "measure_temperature.inlet_before", "measure_temperature.heater",
  "measure_temperature.extern", "measure_temperature.panel",
  "insights_dec_number.T1_intake", "insights_dec_number.T2_inlet", "insights_dec_number.T9_heater",
  "insights_dec_number.T10_extern", "insights_dec_number.T15_room",
  "defrosting_state", "insights_number.defrosting_state",
  "cts602_type"
];

export const getExcludedCapabilities = ((profile: DeviceProfile): Array<string> => {
  if (profile === 'light') return LIGHT_EXCLUDED_CAPABILITIES;
  if (profile === 'ventilation') return VENTILATION_EXCLUDED_CAPABILITIES;
  return [];
});

export interface DeviceFeatures {
  externalHeater: boolean;
  co2Sensor: boolean;
}

const insertCapabilityBefore = (list: Array<string>, capability: string, before: string): void => {
  if (list.includes(capability)) return;

  const index = list.indexOf(before);
  if (index === -1) list.push(capability);
  else list.splice(index, 0, capability);
};

export const getDeviceCapabilities = ((devid?: number, features?: Partial<DeviceFeatures>, profile: DeviceProfile = 'heatpump'): Array<string> => {

  const id: number = devid || -1;
  const ventilation = profile !== 'heatpump';
  const excluded = getExcludedCapabilities(profile);
  // Clone the model template because installed options are specific to one device.
  const list: Array<string> = ventilation
    ? DeviceCapabilities.get(-1)!.filter(capId => !excluded.includes(capId))
    : [...(DeviceCapabilities.get(id) || DeviceCapabilities.get(-1)!)];

  insertCapabilityBefore(list, 'measure_power', 'alarm_generic');
  insertCapabilityBefore(list, 'meter_power', 'alarm_generic');

  if (profile === 'light') {
    insertCapabilityBefore(list, 'insights_number.bypass_state', 'insights_number.ventilation');
    insertCapabilityBefore(list, 'bypass_state', 'measure_humidity');
    insertCapabilityBefore(list, 'ventilation_state', 'fanstep_enum.ventilation');
  }

  // CTS602 Light has no external radiator heat output (H122).
  if (features?.externalHeater === true && (id === 21 || profile === 'ventilation')) {
    insertCapabilityBefore(list, 'insights_number.externalheater', ventilation ? 'insights_number.defrosting_state' : 'insights_number.waterpump_state');
    insertCapabilityBefore(list, 'externalheater', ventilation ? 'defrosting_state' : 'hot_water_state');
  }

  if (features?.co2Sensor === true && (id === 21 || ventilation))
    insertCapabilityBefore(list, 'measure_co2', 'fanstep_enum.ventilation');

  return list;
});

export const hasFwCaps = ((capIds: Array<string>): Boolean => {

  return (capIds.indexOf('bus_version') > -1) &&
         (capIds.indexOf('hidden_string.version_major') > -1) &&
         (capIds.indexOf('hidden_string.version_minor') > -1) &&
         (capIds.indexOf('hidden_string.version_release') > -1) &&
         (capIds.indexOf('firmware_version') > -1) ? true : false;
});

export const capIsFwRelated = ((capId: string): Boolean => {

  return capId === 'bus_version' || capId === 'hidden_string.version_major' || capId === 'hidden_string.version_minor' ||
           capId === 'hidden_string.version_release' || capId === 'firmware_version';
});

export const capIsInsightsNumber = ((capId: string): Boolean => {

  return capId === 'insights_number.compressor_state' || capId === 'insights_number.defrosting_state' || capId === 'insights_number.electricheater' ||
           capId === 'insights_number.externalheater' || capId === 'insights_number.hot_water_state' || capId === 'insights_number.waterpump_state' ||
           capId === 'insights_number.run_state' || capId === 'insights_number.bypass_state'
});

export const capIsAlarmRelated = ((capId: string): Boolean => {

  return capId === 'hidden_number.alarm_count' || capId === 'alarm_generic.filter' || capId === 'alarm_pump_device';
});
