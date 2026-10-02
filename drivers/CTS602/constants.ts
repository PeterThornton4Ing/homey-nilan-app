import { Register, ValueType, CapacityMapping, CapacityMap, UpdateMapping, UpdateMap } from '../../types';
import { REGISTERS } from './registers'

export const ID_REGISTERS: Register.Queries = Register.filter(REGISTERS, [
  'Bus.Version',
  'App.VersionMajor',
  'App.VersionMinor',
  'App.VersionRelease',
  'Control.Type',
  'AirQual.CO2_Enable',
]);

export const OPERATION_REGISTERS: Register.Queries = Register.filter(REGISTERS, [
  'Control.RunSet',
  'Control.ModeSet',
  'Control.VentSet',
  'Control.TempSet',
  'HotWater.TempSet_T11',
  'HotWater.TempSet_T12',
  'CentralHeat.TempSet',
  'AirQual.RH_LimLo',
  'AirFlow.AirExchMode',
//  'Program.UserFuncAct',
//  'Program.UserFuncSet',
//  'Program.UserTimeSet',
  'Control.PowerSave',
  'AirFlow.InletSpd_1',
  'AirFlow.InletSpd_2',
  'AirFlow.InletSpd_3',
  'AirFlow.InletSpd_4',
  'AirFlow.ExhaustSpd_1',
  'AirFlow.ExhaustSpd_2',
  'AirFlow.ExhaustSpd_3',
  'AirFlow.ExhaustSpd_4',
]);

export const SENSOR_REGISTERS: Register.Queries = Register.filter(REGISTERS, [
  'Input.T0_Controller',
  'Input.T1_Intake',
  'Input.T2_Inlet',
  'Input.T3_Exhaust',
  'Input.T4_Outlet',
  'Input.T5_Cond',
  'Input.T6_Evap',
  'Input.T7_Inlet',
  'Input.T8_Outdoor',
  'Input.T9_Heater',
  'Input.T10_Extern',
  'Input.T11_Top',
  'Input.T12_Bottom',
  'Input.T13_Return',
  'Input.T14_Supply',
  'Input.T15_Room',
  'Input.T16',
  'Input.RH',
  'Input.CO2',
  'Control.RunAct',
  'Control.ModeAct',
  'Control.State',
  'AirTemp.TempRoom',
  'Output.Compressor',
  'Output.WaterHeatEl',
  'Output.WaterHeat',
  'Output.CenCircPump',
  'Output.CenHeat_1',
  'Output.CenHeat_2',
  'Output.CenHeat_3',
  'Output.CenHeatExt',
  'Output.Defrosting',
  'Output.ExhaustSpeed',
  'Output.InletSpeed',
  'Output.AirHeatCap',
  'Output.CenHeatCap',
  'Output.CprCap',
  'AirFlow.VentSet',
  'AirFlow.InletAct',
  'AirFlow.ExhaustAct',
  'AirFlow.SinceFiltDay',
  'AirFlow.ToFiltDay',
]);

export const ALARM_REGISTERS: Register.Queries = Register.filter(REGISTERS, [
  'Alarm.Status',
  'Alarm.List_1_ID',
  'Alarm.List_2_ID',
  'Alarm.List_3_ID',
  'Input.AirFilter'
]);

export const CAPABILITIES: CapacityMap = new Map([
  [ 'Output.Compressor', {
    name: 'compressor_state',
    type: ValueType.Bool,
  }],
  [ 'Output.CenCircPump', {
    name: 'waterpump_state',
    type: ValueType.State,
  }],
  [ 'Output.CenHeatExt', {
    name: 'externalheater',
    type: ValueType.State,
  }],
  [ 'Output.Defrosting', {
    name: 'defrosting_state',
    type: ValueType.Bool,
  }],
  [ 'AirTemp.TempRoom', {
    name: [ 'measure_temperature', 'measure_temperature.indoor' ],
    type: ValueType.Number,
  }],
  [ 'Input.T0_Controller', {
    name: [ 'measure_temperature.controller', 'insights_dec_number.T0_controller' ],
    type: ValueType.Number,
  }],
  [ 'Input.T1_Intake', {
    name: [ 'measure_temperature.intake', 'insights_dec_number.T1_intake' ],
    type: ValueType.Number,
  }],
  [ 'Input.T2_Inlet', {
    name: [ 'measure_temperature.inlet_before', 'insights_dec_number.T2_inlet' ],
    type: ValueType.Number,
  }],
  [ 'Input.T3_Exhaust', {
    name: [ 'measure_temperature.exhaust', 'insights_dec_number.T3_exhaust' ],
    type: ValueType.Number,
  }],
  [ 'Input.T4_Outlet', {
    name: [ 'measure_temperature.outlet', 'insights_dec_number.T4_outlet' ],
    type: ValueType.Number,
  }],
  [ 'Input.T5_Cond', {
    name: [ 'measure_temperature.cond', 'insights_dec_number.T5_cond' ],
    type: ValueType.Number,
  }],
  [ 'Input.T6_Evap', {
    name: [ 'measure_temperature.evap', 'insights_dec_number.T6_evap' ],
    type: ValueType.Number,
  }],
  [ 'Input.T7_Inlet', {
    name: [ 'measure_temperature.inlet_after', 'insights_dec_number.T7_inlet' ],
    type: ValueType.Number,
  }],
  [ 'Input.T8_Outdoor', {
    name: [ 'measure_temperature.outdoor', 'insights_dec_number.T8_outdoor' ],
    type: ValueType.Number,
  }],
  [ 'Input.T9_Heater', {
    name: [ 'measure_temperature.heater', 'insights_dec_number.T9_heater' ],
    type: ValueType.Number,
  }],
  [ 'Input.T10_Extern', {
    name: [ 'measure_temperature.extern', 'insights_dec_number.T10_extern' ],
    type: ValueType.Number,
  }],
  [ 'Input.T11_Top', {
    name: [ 'measure_temperature.water', 'measure_temperature.water_current', 'measure_temperature.water_top', 'insights_dec_number.T11_water_top' ],
    type: ValueType.Number,
  }],
  [ 'Input.T12_Bottom', {
    name: [ 'measure_temperature.water_bottom', 'insights_dec_number.T12_water_bottom' ],
    type: ValueType.Number,
  }],
  [ 'Input.T13_Return', {
    name: [ 'measure_temperature.ek_return', 'insights_dec_number.T13_return' ],
    type: ValueType.Number,
  }],
  [ 'Input.T14_Supply', {
    name: [ 'measure_temperature.ek_supply', 'insights_dec_number.T14_supply' ],
    type: ValueType.Number,
  }],
  [ 'Input.T15_Room', {
    name: [ 'measure_temperature.panel', 'insights_dec_number.T15_room' ],
    type: ValueType.Number,
  }],
  [ 'Input.T16', {
    name: [ 'measure_temperature.aux', 'insights_dec_number.T16_aux'],
    type: ValueType.Number,
  }],
  [ 'Input.RH', {
    name: 'measure_humidity',
    type: ValueType.Number,
  }],
  [ 'Input.CO2', {
    name: 'measure_co2',
    type: ValueType.Number,
  }],
  [ 'AirQual.RH_LimLo', {
    name: 'nl_target_humidity',
    type: ValueType.Number,
    factor: 100,
    update: 'nl_target_humidity',
  }],
  [ 'AirFlow.VentSet', {
    name: 'fanstep_enum.ventilation',
    type: ValueType.State,
  }],
  [ 'AirFlow.InletAct', {
    name: 'fanstep.inlet',
    type: ValueType.Number,
  }],
  [ 'AirFlow.ExhaustAct', {
    name: 'fanstep.exhaust',
    type: ValueType.Number,
  }],
  [ 'Output.InletSpeed', {
    name: 'fanspeed.inlet',
    type: ValueType.Number,
  }],
  [ 'Output.ExhaustSpeed', {
    name: 'fanspeed.exhaust',
    type: ValueType.Number,
  }],
  [ 'Output.AirHeatCap', {
    name: [ 'capacity.airheat', 'insights_dec_number.air_heater_capacity' ],
    type: ValueType.Number,
  }],
  [ 'Output.CenHeatCap', {
    name: [ 'capacity.cenheat', 'insights_dec_number.central_heater_capacity' ],
    type: ValueType.Number,
  }],
  [ 'Output.CprCap', {
    name: [ 'capacity.compressor', 'insights_dec_number.compressor_capacity' ],
    type: ValueType.Number,
  }],
  [ 'AirFlow.SinceFiltDay', {
    name: 'filter_days.since',
    type: ValueType.Number,
  }],
  [ 'AirFlow.ToFiltDay', {
    name: 'filter_days.left',
    type: ValueType.Number,
  }],
  [ 'Bus.Version', {
    name: 'bus_version',
    type: ValueType.String,
  }],
  [ 'Control.TempSet', {
    name: 'target_temperature',
    type: ValueType.Number,
    update: 'target_temperature',
  }],
  [ 'HotWater.TempSet_T12', {
    name: 'target_temperature.water',
    type: ValueType.Number,
    update: 'target_temperature.water',
  }],
  [ 'CentralHeat.TempSet', {
    name: 'target_temperature.ek',
    type: ValueType.Number,
    update: 'target_temperature.ek',
  }],
  [ 'Control.Type', {
    name: [ 'cts602_type', 'heatpump_typecode' ],
    type: ValueType.State,
    update: 'heatpump_typecode',
  }],
  [ 'Control.RunSet', {
    name: 'pump_mode.run',
    type: ValueType.State,
    update: 'pump_mode.run',
  }],
  [ 'Control.RunAct', {
    name: 'run_state',
    type: ValueType.State,
    max: 2,
    update: 'pump_mode.run',
  }],
  [ 'Control.ModeSet', {
    name: 'pump_mode.mode',
    type: ValueType.State,
    update: 'pump_mode.mode',
  }],
  [ 'Control.VentSet', {
    name: [ 'fan_mode.ventilation', 'fanstep_enum.ventilation' ],
    type: ValueType.State,
    update: 'fan_mode.ventilation',
  }],
  [ 'Control.ModeAct', {
    name: 'heatpump_mode',
    type: ValueType.State,
    max: 5,
    update: 'pump_mode.mode',
  }],
  [ 'Control.State', {
    name: 'heatpump_state',
    max: 18,
    type: ValueType.State,
  }],
  [ 'AirFlow.AirExchMode', {
    name: [ 'pump_mode.air_exchange', 'air_exchange_mode' ],
    type: ValueType.State,
    update: 'pump_mode.air_exchange',
  }],
  [ 'Control.PowerSave', {
    name: [ 'pump_mode.power_save', 'power_save_mode' ],
    type: ValueType.State,
    update: 'pump_mode.power_save',
  }],
  [ 'AirFlow.InletSpd_1', {
    name: 'fan_speed.inlet1',
    type: ValueType.Number,
    factor: 100,
    update: 'fan_speed.inlet1',
  }],
  [ 'AirFlow.InletSpd_2', {
    name: 'fan_speed.inlet2',
    type: ValueType.Number,
    factor: 100,
    update: 'fan_speed.inlet2',
  }],
  [ 'AirFlow.InletSpd_3', {
    name: 'fan_speed.inlet3',
    type: ValueType.Number,
    factor: 100,
    update: 'fan_speed.inlet3',
  }],
  [ 'AirFlow.InletSpd_4', {
    name: 'fan_speed.inlet4',
    type: ValueType.Number,
    factor: 100,
    update: 'fan_speed.inlet4',
  }],
  [ 'AirFlow.ExhaustSpd_1', {
    name: 'fan_speed.exhaust1',
    type: ValueType.Number,
    factor: 100,
    update: 'fan_speed.exhaust1',
  }],
  [ 'AirFlow.ExhaustSpd_2', {
    name: 'fan_speed.exhaust2',
    type: ValueType.Number,
    factor: 100,
    update: 'fan_speed.exhaust2',
  }],
  [ 'AirFlow.ExhaustSpd_3', {
    name: 'fan_speed.exhaust3',
    type: ValueType.Number,
    factor: 100,
    update: 'fan_speed.exhaust3',
  }],
  [ 'AirFlow.ExhaustSpd_4', {
    name: 'fan_speed.exhaust4',
    type: ValueType.Number,
    factor: 100,
    update: 'fan_speed.exhaust4',
  }],
  [ 'App.VersionMajor', {
    name: 'hidden_string.version_major',
    type: ValueType.Parser,
    update: 'hidden_string.version_major',
  }],
  [ 'App.VersionMinor', {
    name: 'hidden_string.version_minor',
    type: ValueType.Parser,
    update: 'hidden_string.version_minor',
  }],
  [ 'App.VersionRelease', {
    name: 'hidden_string.version_release',
    type: ValueType.Parser,
    update: 'hidden_string.version_release',
  }],
  [ 'AirQual.CO2_Enable', {
    name: 'hidden_number.co2_enable',
    type: ValueType.Number,
    update: 'hidden_number.co2_enable',
  }],
]);

export const newUpdateMap = ((): UpdateMap => {
  return  new Map([
    [ 'target_temperature', {
      id: 'Control.TempSet',
      description: 'target temperature',
      queries: OPERATION_REGISTERS,
    }],
    [ 'target_temperature.water', {
       id: 'HotWater.TempSet_T12',
       description: 'water temperature',
       queries: OPERATION_REGISTERS,
    }],
    [ 'target_temperature.ek', {
       id: 'CentralHeat.TempSet',
       description: 'ek temperature',
       queries: OPERATION_REGISTERS,
    }],
    [ 'nl_target_humidity', {
      id: 'AirQual.RH_LimLo',
      description: 'target humidity',
      queries: OPERATION_REGISTERS,
      factor: 100,
    }],
    [ 'fan_mode.ventilation', {
      id: 'Control.VentSet',
      description: 'User ventilation step select',
      queries: OPERATION_REGISTERS,
      capability: 'fanstep_enum.ventilation'
    }],
    [ 'fan_speed.inlet1', {
      id: 'AirFlow.InletSpd_1',
      description: 'Inlet step 1 speed setup',
      queries: OPERATION_REGISTERS,
      factor: 100,
    }],
    [ 'fan_speed.inlet2', {
      id: 'AirFlow.InletSpd_2',
      description: 'Inlet step 2 speed setup',
      queries: OPERATION_REGISTERS,
      factor: 100,
    }],
    [ 'fan_speed.inlet3', {
      id: 'AirFlow.InletSpd_3',
      description: 'Inlet step 3 speed setup',
      queries: OPERATION_REGISTERS,
      factor: 100,
    }],
    [ 'fan_speed.inlet4', {
      id: 'AirFlow.InletSpd_4',
      description: 'Inlet step 4 speed setup',
      queries: OPERATION_REGISTERS,
      factor: 100,
    }],
    [ 'fan_speed.exhaust1', {
      id: 'AirFlow.ExhaustSpd_1',
      description: 'Exhaust step 1 speed setup',
      queries: OPERATION_REGISTERS,
      factor: 100,
    }],
    [ 'fan_speed.exhaust2', {
      id: 'AirFlow.ExhaustSpd_2',
      description: 'Exhaust step 2 speed setup',
      queries: OPERATION_REGISTERS,
      factor: 100,
    }],
    [ 'fan_speed.exhaust3', {
      id: 'AirFlow.ExhaustSpd_3',
      description: 'Exhaust step 3 speed setup',
      queries: OPERATION_REGISTERS,
      factor: 100,
    }],
    [ 'fan_speed.exhaust4', {
      id: 'AirFlow.ExhaustSpd_4',
      description: 'Exhaust step 4 speed setup',
      queries: OPERATION_REGISTERS,
      factor: 100,
    }],
    [ 'pump_mode.run', {
      id: 'Control.RunSet',
      description: 'run set',
      queries: OPERATION_REGISTERS,
      capability: 'run_state',
    }],
    [ 'pump_mode.mode', {
      id: 'Control.ModeSet',
      description: 'mode',
      queries: OPERATION_REGISTERS,
      capability: 'heatpump_mode',
    }],
    [ 'pump_mode.air_exchange', {
      id: 'AirFlow.AirExchMode',
      description: 'air exchange mode',
      queries: OPERATION_REGISTERS,
      capability: 'air_exchange_mode',
    }],
    [ 'pump_mode.power_save', {
      id: 'Control.PowerSave',
      description: 'power save mode',
      queries: OPERATION_REGISTERS,
      capability: 'power_save_mode',
    }],
  ]);
});

export const DEVICE_IDENTIFICATION_REGISTER = 'Control.Type';

/* List of types extracted from device's data -> device information after writing value to holding register 100* */
export const MachineTypes: Map<number, string> = new Map([
  [ 0, '?' ],
  [ 1, 'Test' ],
  [ 2, 'VPL 10' ],
  [ 3, 'VPL 15' ],
  [ 4, 'VPL 15c' ],
  [ 5, 'VPL 25-3' ],
  [ 6, 'VPL 25c-3' ],
  [ 7, 'VPL 28-2' ],
  [ 8, 'VPL 28c-2' ],
  [ 9, 'CompactSu' ],
  [ 10, 'CompactS' ],
  [ 11, 'VP 18comp' ],
  [ 12, 'VP 18c comp' ],
  [ 13, 'COMFORT' ],
  [ 14, 'COMFORT2' ],
  [ 15, 'VLX 1' ],
  [ 16, 'VLX 2' ],
  [ 17, 'VLX 3' ],
  [ 18, 'VP 18' ],
  [ 19, 'VP 18c' ],
  [ 20, '?' ],
  [ 21, 'VP 18cek' ],
  [ 22, 'VGU 250' ],
  [ 23, 'VGU 250ek' ],
  [ 24, 'VPL 25' ],
  [ 25, 'VPL 25c' ],
  [ 26, 'VPM/28EC' ],
  [ 27, 'COMFORTi' ],
  [ 28, 'VP 18cCoB' ],
  [ 29, 'VLX 4' ],
  [ 30, 'Compact N' ],
  [ 31, 'Comfort N' ],
  [ 32, 'VP 18 M1' ],
  [ 33, 'COMBI 300 N' ],
  [ 34, 'Compact U' ],
  [ 35, 'COMBI 302' ],
  [ 36, 'COMBI 302 T' ],
  [ 37, '?' ],
  [ 38, 'VGU180 ek' ],
  [ 39, 'VPM-1' ],
  [ 40, 'VPM-2' ],
  [ 41, 'VPM-3' ],
  [ 42, '?' ],
  [ 43, 'CompactP EK' ],
  [ 44, 'CompactP' ],
  [ 45, 'VPR' ],
  [ 46, 'Combi SH' ],
  [ 47, '?' ],
]);
