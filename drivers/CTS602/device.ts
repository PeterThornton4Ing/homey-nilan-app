import Homey from 'homey';
import net from 'net';
import { Register, ValueType, CapacityMapping, CapacityMap, UpdateMapping, UpdateMap, Fetch, limitValueRange } from '../../types';
import { ID_REGISTERS, OPERATION_REGISTERS, SENSOR_REGISTERS, ALARM_REGISTERS, CAPABILITIES, HEATPUMP_ONLY_REGISTERS, LIGHT_UNSUPPORTED_REGISTERS, LIGHT_SENSOR_REGISTERS, newUpdateMap, withoutRegisters } from './constants';
import { ModbusApi } from '../../modbus_api';
import { DeviceCapabilities, getDeviceCapabilities, DeviceFeatures, hasFwCaps, capIsFwRelated, capIsInsightsNumber, capIsAlarmRelated, getDeviceProfile, getExcludedCapabilities } from './capabilities';

const ENERGY_PERSIST_INTERVAL_MS = 5 * 60 * 1000;
const EK_RETURN_CONFIRMATION_READS = 3;
const EK_RETURN_MIN_TEMPERATURE = -20;
const EK_RETURN_MAX_TEMPERATURE = 80;
const POWER_SETTING_DEFAULTS: Record<string, number> = {
  'power-compressor': 700,
  'power-fan-step-1': 30,
  'power-fan-step-2': 50,
  'power-fan-step-3': 70,
  'power-fan-step-4': 100,
  'power-hot-water-heater': 1000,
  'power-central-heater-element': 2000,
  'power-water-pump': 0,
  'power-external-heat-source': 0
};

module.exports = class CTS602Device extends Homey.Device {

  _api!: ModbusApi;
  fetchTimeout?: NodeJS.Timeout;
  updates: UpdateMap = newUpdateMap();
  fetches: Array<Fetch> = [
    {
      queries: OPERATION_REGISTERS,
      condition: ((now, last): Boolean => { return true; }),
      timeout: 0,
    },
    {
      queries: SENSOR_REGISTERS,
      condition: ((now, last): Boolean => {
        return (!last || now - last > ( this.getSetting('temp-report-interval') * 1000 )) ? true : false;
      }),
      timeout: 1000,
    },
    {
      queries: ALARM_REGISTERS,
      condition: ((now, last): Boolean => { return (!last || now - last > 10 * 1000) ? true : false; }),
      timeout: 5000,
    },
    {
      queries:ID_REGISTERS,
      condition: ((now, last): Boolean => { return (!last || now - last > 10 * 30 * 1000) ? true : false }),
      timeout: 8000,
    }
  ];
  capIds: Array<string> = [];
  lastPowerUpdate?: number;
  estimatedEnergy = 0;
  lastEstimatedPower = 0;
  lastEnergyPersist?: number;
  latestOperationValues: Register.Results = new Map();
  ekReturnConfirmationCount = 0;
  ekReturnCapabilityReady = false;
  compressorCapacityCapabilityReady = false;

  async onInit() {

    this._api = new ModbusApi({
      device: this,
      homey: this.homey,
      logger: this.log,
      onUpdateValues: this.onUpdateValues
    });

    const data = this.getData();
    const settings = this.getSettings();
    const storedFeatures = data.features as Partial<DeviceFeatures> | undefined;
    const explicitlyConfiguredFeatures = data.externalHeater !== undefined
      || data.co2Sensor !== undefined
      || data.externalheater !== undefined
      || data.co2sensor !== undefined
      || storedFeatures !== undefined;
    const features: DeviceFeatures = {
      externalHeater: data.externalHeater === true
        || storedFeatures?.externalHeater === true
        || data.externalheater === true
        || settings['external-heater-installed'] === true,
      co2Sensor: data.co2Sensor === true
        || storedFeatures?.co2Sensor === true
        || data.co2sensor === true
        || settings['co2-sensor-installed'] === true
    };
    const profile = getDeviceProfile(data);
    const capIds = getDeviceCapabilities(data.model ?? -1, features, profile);

    this.log('data:', data);
    this.log('installed features:', features);

    if (profile !== 'heatpump') {
      this.log(profile, 'unit, skipping unsupported registers and capabilities');

      const unsupported = profile === 'light' ? LIGHT_UNSUPPORTED_REGISTERS : HEATPUMP_ONLY_REGISTERS;
      for (const fetch of this.fetches)
        fetch.queries = withoutRegisters(fetch.queries, unsupported);

      if (profile === 'light') {
        const sensors = this.fetches.find(fetch => fetch.queries.has('Input.T3_Exhaust'));
        if (sensors) sensors.queries = new Map([...sensors.queries, ...LIGHT_SENSOR_REGISTERS]);
      }

      if (this.getClass() !== 'airtreatment')
        await this.setClass('airtreatment');

      // Devices paired before the ventilation profile existed received the heat pump capabilities.
      for (const capId of getExcludedCapabilities(profile)) {
        if (!capIds.includes(capId) && this.hasCapability(capId)) {
          await this.removeCapability(capId);
          this.log('Removed heat pump capability', capId, 'from ventilation unit');
        }
      }
    }

    let curIds = await this.getCapabilities();
    let didAddAlarms: Boolean = false;

    this.log('adding capabilities for type', data.model, ':', capIds);
    this.log('cur ids:', curIds);
  
    for (const capId of capIds) {
    
      if (!curIds.includes(capId)) {

        await this.addCapability(capId);

        try {

          if (capIsFwRelated(capId))
            await this.setCapabilityValue(capId, capId === 'firmware_version' ? '-' : '');
          else if (capIsInsightsNumber(capId))
            await this.setCapabilityValue(capId, 0);
          else if (capIsAlarmRelated(capId))
            didAddAlarms = true;

        } catch (err) {
          this.log('failed to set initial capacity value for ', capId, ': ', err);
        }

      }
    }

    this.capIds.splice(0);
    
    for (const id of await this.getCapabilities())
      this.capIds.push(id);

    this.ekReturnCapabilityReady = this.capIds.includes('measure_temperature.ek_return');

    const compressorCapacityWasDetected = await this.getStoreValue('compressor-capacity-detected') === true;
    const currentCompressorCapacity = this.hasCapability('capacity.compressor')
      ? Number(await this.getCapabilityValue('capacity.compressor'))
      : 0;
    this.compressorCapacityCapabilityReady = compressorCapacityWasDetected || currentCompressorCapacity > 0;
    if (this.compressorCapacityCapabilityReady && !compressorCapacityWasDetected)
      await this.setStoreValue('compressor-capacity-detected', true);

    if (!this.compressorCapacityCapabilityReady) {
      for (const capability of ['capacity.compressor', 'insights_dec_number.compressor_capacity']) {
        if (this.hasCapability(capability)) await this.removeCapability(capability);
        const index = this.capIds.indexOf(capability);
        if (index >= 0) this.capIds.splice(index, 1);
      }
    }

    if (explicitlyConfiguredFeatures && !features.co2Sensor && this.hasCapability('measure_co2')) {
      await this.removeCapability('measure_co2');
      const co2Index = this.capIds.indexOf('measure_co2');
      if (co2Index >= 0) this.capIds.splice(co2Index, 1);
      this.log('Removed CO2 capability because the sensor was not selected during pairing');
    }

    if (didAddAlarms) {
      try {
        await this.resetAlarms();
      } catch(err) {
        this.log('initial alarm reset failed: ', err);
      }
    }

    this.updates.forEach((item, key) => {
      const capabilityId = item.capability || key;

      if (item.queries.has(item.id) && this.capIds.includes(capabilityId)) {
        this.registerCapabilityListener(capabilityId, (value, opts) => {
          return this.updateValue(key, value, opts);
        });
      }
    });

    this.estimatedEnergy = Number(this.getStoreValue('estimated-energy-kwh')) || 0;
    this.lastPowerUpdate = Date.now();
    this.lastEnergyPersist = this.lastPowerUpdate;
    await this.setCapabilityValue2('meter_power', this.estimatedEnergy);

    this.addFetchTimeout(1);
    await this.connect();

    if ((this._api._socket === undefined) || (this._api._client === undefined))
      this.log('waiting for connection to device');
    else {
      await this.setAvailable();
      this.log('device initialized');
    }
  }

  async onAdded(): Promise<void> {
    this.log('device added');
  }

  async onUninit(): Promise<void> {

    if (this.capIds.includes('meter_power'))
      await this.setStoreValue('estimated-energy-kwh', this.estimatedEnergy);

    this._api._onUpdateValues = undefined;
    this.clearFetchTimeout();   
    this.disconnect();   
    this.log('device uninitialized');
  }

  onDeleted() {

    if (this.capIds.includes('meter_power'))
      this.setStoreValue('estimated-energy-kwh', this.estimatedEnergy).catch(err => this.error(err));

    this._api._onUpdateValues = undefined;
    this.clearFetchTimeout();
    this.disconnect();
    this.log('device deleted');
  }

  async setCapabilityValue2(id: string, value: number | string | Boolean): Promise<void> {

    if (this.capIds.indexOf(id) > -1)
      await this.setCapabilityValue(id, value);
  }

  async ready(): Promise<void> {

    this.log('preparing device');
    await this.connect();
  }

  async onSettings({oldSettings, newSettings, changedKeys}: {
    oldSettings: object;
    newSettings: object;
    changedKeys: string[];
  }): Promise<string | void> {
    if ((changedKeys.includes('device-ip')) || (changedKeys.includes('device-port')) || (changedKeys.includes('device-id'))) {
      if (!this.getAvailable()) {
        await this.setAvailable();
        this.addFetchTimeout(1);
      }
      this._api.resetSocket();
    }
    if (changedKeys.includes('polling-interval') || changedKeys.includes('temp-report-interval')) {
      this.addFetchTimeout();
    }
    if (changedKeys.some(key => key.startsWith('power-')) && this.latestOperationValues.size > 0) {
      await this.updateEstimatedEnergy(new Map());
    }
    if (changedKeys.includes('meter_power')) {
      const meterValue = Number((newSettings as Record<string, unknown>)['meter_power']);
      if (Number.isFinite(meterValue) && meterValue >= 0) {
        this.estimatedEnergy = meterValue;
        this.lastPowerUpdate = Date.now();
        await this.setStoreValue('estimated-energy-kwh', meterValue);
      }
    }
  }

  addFetchTimeout(seconds?: number): void {
    this.clearFetchTimeout();
    const settings = this.getSettings();
    const interval = seconds || settings['polling-interval'] || 10;
    this.fetchTimeout = this.homey.setTimeout(() => this.fetchParameters(), 1000 * interval);
  }

  clearFetchTimeout(): void {
    if (this.fetchTimeout) {
      this.homey.clearTimeout(this.fetchTimeout);
      this.fetchTimeout = undefined;
    }
  }

  async connect(): Promise<void> {
        
    const settings = this.getSettings();
    await this._api._connection(settings['device-ip'], settings['device-port'], settings['device-id']);
  }

  async disconnect(): Promise<void> {

    if (this._api) {
      if (this._api._clearSocketTimeout) {
        await this._api._clearSocketTimeout();  
      }
      await this._api._disconnect();
    }
  }

  async fetchParameters(): Promise<void> {

    let connectionLost = false;
    let connectionRestored = false;

    try {
      if (this.getAvailable()) {

        if ((this.getSetting('device-ip') === undefined) || (this.getSetting('device-ip') === null) || (this.getSetting('device-ip').endsWith('.xxx')) || (this.getSetting('device-ip') === '')) {
          this.log('IP address not set');
          await this.setUnavailable(this.homey.__('unavailable.set_ip_address'));
        } else if (!net.isIP(this.getSetting('device-ip'))) {
          this.log('Invalid ip address');
          await this.setUnavailable(this.homey.__('errors.invalid_ip_address'));
        } else if ((this._api._socket === undefined) || (this._api._client === undefined)) {
          this.log('Connection to device was lost');
          connectionLost = true;
          await this.setUnavailable(this.homey.__('errors.connection_lost'));
        } else {

          const now = Date.now();
          for ( let i = 0; i < this.fetches.length; i++ ) {
            if (this.fetches[i].condition(now, this.fetches[i].last)) {
              if (this.fetches[i].timeout === 0 ) {
                try {
                  await this._api.read(this.fetches[i].queries).catch((err: any) => this.log(err));
                  this.fetches[i].last = now;
                } catch (err) {}
              } else {
                this.homey.setTimeout(async () => {
                  try {
                    await this._api.read(this.fetches[i].queries).catch((err: any) => this.log(err));
                    this.fetches[i].last = now;
                  } catch (err) {}
                }, this.fetches[i].timeout);
              }
            }
          }
        }
      } else {

        await this.connect();

        if ((this._api._socket !== undefined) && (this._api._client !== undefined)) {
          await this.setAvailable();
          connectionRestored = true;
          this.log('Connection to device was restored');
        }
      }
    } catch (err) {
      this.log('fetchSensors error', err);
    } finally {
      if (connectionLost) {
        this.addFetchTimeout(5);
      } else if (connectionRestored) {
        this.addFetchTimeout(1);
      } else {
        this.addFetchTimeout();
      }
    }
  }

  getPowerSetting(key: string): number {
    const rawValue = this.getSetting(key);
    if (rawValue === null || rawValue === undefined || rawValue === '')
      return POWER_SETTING_DEFAULTS[key];

    const configured = Number(rawValue);
    return Number.isFinite(configured) && configured >= 0
      ? configured
      : POWER_SETTING_DEFAULTS[key];
  }

  getCentralHeaterLevel(values: Register.Results): number {
    const relay1 = Number(values.get('Output.CenHeat_1') ?? 0) !== 0 ? 1 : 0;
    const relay2 = Number(values.get('Output.CenHeat_2') ?? 0) !== 0 ? 1 : 0;
    const relay3 = Number(values.get('Output.CenHeat_3') ?? 0) !== 0 ? 1 : 0;
    return relay1 + relay2 * 2 + relay3 * 4;
  }

  getCentralHeaterElementPower(): number {
    const configured = this.getSetting('power-central-heater-element');
    if (configured !== null && configured !== undefined && configured !== '') {
      const value = Number(configured);
      if (Number.isFinite(value) && value >= 0) return value;
    }

    // Compatibility with devices created while the estimate used three separate settings.
    const legacy = Number(this.getSetting('power-central-heater-1'));
    return Number.isFinite(legacy) && legacy >= 0
      ? legacy
      : POWER_SETTING_DEFAULTS['power-central-heater-element'];
  }

  getEstimatedPower(values: Register.Results): number {
    const active = (key: string): boolean => (values.get(key) || 0) > 0;
    const inletStep = Math.max(0, Math.min(4, Math.round(values.get('AirFlow.InletAct') || 0)));
    const exhaustStep = Math.max(0, Math.min(4, Math.round(values.get('AirFlow.ExhaustAct') || 0)));
    const fanStep = Math.max(inletStep, exhaustStep);

    let power = fanStep > 0 ? this.getPowerSetting(`power-fan-step-${fanStep}`) : 0;
    if (active('Output.Compressor')) power += this.getPowerSetting('power-compressor');
    if (active('Output.WaterHeatEl')) power += this.getPowerSetting('power-hot-water-heater');
    power += this.getCentralHeaterLevel(values) * this.getCentralHeaterElementPower();
    if (active('Output.CenCircPump')) power += this.getPowerSetting('power-water-pump');
    if (active('Output.CenHeatExt') && this.capIds.includes('externalheater'))
      power += this.getPowerSetting('power-external-heat-source');

    return Math.max(0, power);
  }

  async updateEstimatedEnergy(values: Register.Results): Promise<void> {
    values.forEach((value, key) => this.latestOperationValues.set(key, value));

    const now = Date.now();
    const power = this.getEstimatedPower(this.latestOperationValues);
    if (this.lastPowerUpdate !== undefined) {
      const elapsedHours = Math.min(now - this.lastPowerUpdate, 10 * 60 * 1000) / 3600000;
      this.estimatedEnergy += this.lastEstimatedPower * elapsedHours / 1000;
    }
    this.lastPowerUpdate = now;
    this.lastEstimatedPower = power;

    await this.setCapabilityValue2('measure_power', Math.round(power));
    await this.setCapabilityValue2('meter_power', Number(this.estimatedEnergy.toFixed(3)));

    if (!this.lastEnergyPersist || now - this.lastEnergyPersist >= ENERGY_PERSIST_INTERVAL_MS) {
      await this.setStoreValue('estimated-energy-kwh', this.estimatedEnergy);
      this.lastEnergyPersist = now;
    }
  }

  async detectEkReturnSensor(result: Register.Results): Promise<void> {
    if (this.ekReturnCapabilityReady || !result.has('Input.T13_Return')) return;

    const temperature = result.get('Input.T13_Return');
    const plausible = temperature !== undefined
      && temperature !== 0
      && temperature >= EK_RETURN_MIN_TEMPERATURE
      && temperature <= EK_RETURN_MAX_TEMPERATURE;
    this.ekReturnConfirmationCount = plausible ? this.ekReturnConfirmationCount + 1 : 0;

    if (this.ekReturnConfirmationCount < EK_RETURN_CONFIRMATION_READS) return;

    for (const capability of ['measure_temperature.ek_return', 'insights_dec_number.T13_return']) {
      if (!this.hasCapability(capability)) await this.addCapability(capability);
      if (!this.capIds.includes(capability)) this.capIds.push(capability);
    }
    this.ekReturnCapabilityReady = true;
    this.log('Detected a plausible EK return-water sensor value; capabilities added');
  }

  async detectCompressorCapacity(result: Register.Results): Promise<void> {
    if (this.compressorCapacityCapabilityReady || !result.has('Output.CprCap')) return;

    const capacity = result.get('Output.CprCap');
    if (capacity === undefined || !Number.isFinite(capacity) || capacity <= 0 || capacity > 100) return;

    for (const capability of ['capacity.compressor', 'insights_dec_number.compressor_capacity']) {
      if (!this.hasCapability(capability)) await this.addCapability(capability);
      if (!this.capIds.includes(capability)) this.capIds.push(capability);
    }
    this.compressorCapacityCapabilityReady = true;
    await this.setStoreValue('compressor-capacity-detected', true);
    this.log('Detected a non-zero compressor capacity value; capabilities added');
  }

  async onUpdateValues(result: Register.Results, device: any): Promise<void> {

    if (!device.getAvailable())
      return;

    await device.detectEkReturnSensor(result);
    await device.detectCompressorCapacity(result);
    await device.updateEstimatedEnergy(result);

    if (result.has('Alarm.Status') && result.has('Alarm.List_1_ID') && result.has('Alarm.List_2_ID') && result.has('Alarm.List_3_ID') && result.has('Input.AirFilter'))
      device.updateAlarms(result.get('Alarm.Status'), result.get('Alarm.List_1_ID'), result.get('Alarm.List_2_ID'), result.get('Alarm.List_3_ID'), result.get('Input.AirFilter'));

    if (result.has('Output.WaterHeat') && result.has('Output.WaterHeatEl')) {
      await device.setCapabilityValue2('hot_water_state', result.get('Output.WaterHeat') === 1 ? ( result.get('Output.WaterHeatEl') === 0 ? '1' : '2' ) : '0');
      await device.setCapabilityValue2('insights_number.hot_water_state', result.get('Output.WaterHeat') === 1 ? ( result.get('Output.WaterHeatEl') === 0 ? 1 : 2 ) : 0);
    }

    if (result.has('Output.Compressor'))
      await device.setCapabilityValue2('insights_number.compressor_state', result.get('Output.Compressor') === 0 ? 0 : 1);

    if (result.has('Output.CenHeat_1') && result.has('Output.CenHeat_2') && result.has('Output.CenHeat_3')) {

      const heaterLevel = device.getCentralHeaterLevel(result);
      await device.setCapabilityValue2('electricheater', String(heaterLevel));
      await device.setCapabilityValue2('insights_number.electricheater', heaterLevel);
    }

    if (result.has('Output.Defrosting'))
      await device.setCapabilityValue2('insights_number.defrosting_state', result.get('Output.Defrosting') === 0 ? 0 : 1);

    if (result.has('AirBypass.IsOpen'))
      await device.setCapabilityValue2('insights_number.bypass_state', result.get('AirBypass.IsOpen') === 0 ? 0 : 1);

    if (result.has('Output.CenHeatExt'))
      await device.setCapabilityValue2('insights_number.externalheater', result.get('Output.CenHeatExt') === 0 ? 0 : 1);

    if (result.has('Output.CenCircPump'))
      await device.setCapabilityValue2('insights_number.waterpump_state', result.get('Output.CenCircPump') === 0 ? 0 : 1);

    if (result.has('Control.RunAct'))
      await device.setCapabilityValue2('insights_number.run_state', result.get('Control.RunAct') === 0 ? 0 : 1);

    if (result.has('AirFlow.InletAct'))
      await device.setCapabilityValue2('insights_number.ventilation', result.get('AirFlow.InletAct'));

    result.forEach((value, key) => {
      const mapping = CAPABILITIES.get(key);
      if (mapping !== undefined) {
        if (mapping.type !== ValueType.Parser)
          device.updateNumber(mapping, limitValueRange(value, mapping.min, mapping.max));
        else device.parseValue(mapping, limitValueRange(value, mapping.min, mapping.max));
      }
    })
  }

  async updateNumber(mapping: CapacityMapping, value: number, override?: Boolean): Promise<void> {

    if ((override === undefined || override === false) && (mapping.update !== undefined) && (this.updates.has(mapping.update)) && (this.updates.get(mapping.update)!.timeout !== undefined))
      return;

    const factor = mapping.factor || 1;
    const toValue = Math.round(10 * value / factor) * 0.1

    if (typeof(mapping.name) === 'string') {
      await this.setCapabilityValue2(mapping.name,
        ( mapping.type === ValueType.State || mapping.type === ValueType.String ) ? toValue.toString() : (mapping.type === ValueType.Bool ? ( toValue === 0 ? false : true ) : toValue)).catch(err => this.log(err));
    } else if (Array.isArray(mapping.name)) {
      for ( let i = 0; i < mapping.name.length; i++ )        
        await this.setCapabilityValue2(mapping.name[i],
          ( mapping.type === ValueType.State || mapping.type === ValueType.String ) ? toValue.toString() : (mapping.type === ValueType.Bool ? ( toValue === 0 ? false : true ) : toValue)).catch(err => this.log(err));
    }
  }

  async parseValue(mapping: CapacityMapping, value: number) {

    if ((mapping.update !== undefined) && (this.updates.has(mapping.update)) && (this.updates.get(mapping.update)!.timeout !== undefined))
      return;

    if (mapping.name == 'hidden_string.version_major' || mapping.name == 'hidden_string.version_minor' || mapping.name == 'hidden_string.version_release') {

      const ver = this.parseVersionNumber(value);
      if (ver !== '' && hasFwCaps(this.capIds)) {
        await this.setCapabilityValue2(mapping.name, ver).catch(err => this.log(err));

        const major = await this.getCapabilityValue('hidden_string.version_major');
        const minor = await this.getCapabilityValue('hidden_string.version_minor');
        const release = await this.getCapabilityValue('hidden_string.version_release');
        const current_fw = await this.getCapabilityValue('firmware_version');
        const combined = major + '.' + minor + '.' + release;

        if (major !== null && major !== '' && minor !== null && minor !== '' && release !== null && release !== '' && current_fw !== combined)
          await this.setCapabilityValue2('firmware_version', combined);
      }

    } else await this.updateNumber(mapping, value);
  }

  parseVersionNumber(value: number): string {

    const high = ((value >> 8) & 0xff);
    const low = value & 0xff;
    let result = '';
     
    if ((high > 47) && (high < 58)) {
      const v = high - 48;
      result += v.toString();
    }
    
    if ((low > 47) && (low < 58)) {
      const v = low - 48;
      result += v.toString();
    }

    return result;
  }

  async setAlarms(alarms: Array<number>): Promise<void> {

    const filterState = await this.getCapabilityValue('alarm_generic.filter');
    const alarmState = await this.getCapabilityValue('alarm_pump_device');

    if ((alarmState === false) || (alarmState === null)) {

      if (filterState === true) {
        await this.unsetWarning();
      }

      await this.setCapabilityValue2('alarm_pump_device', true);
      await this.setWarning(this.homey.__('warnings.alarm'));
    }

    if (alarms.length > 0) {
      if (!this.hasCapability('alarm_nilan.id1')) {
        await this.addCapability('alarm_nilan.id1');
      }
      await this.setCapabilityValue2('alarm_nilan.id1', alarms[0].toString());
    } else if ((alarms.length < 1) && (this.hasCapability('alarm_nilan.id1'))) {
      await this.removeCapability('alarm_nilan.id1');
    }

    if (alarms.length > 1) { 
      if (!this.hasCapability('alarm_nilan.id2')) {    
        await this.addCapability('alarm_nilan.id2');
      } 
      await this.setCapabilityValue2('alarm_nilan.id2', alarms[1].toString());
    } else if ((alarms.length < 2) && (this.hasCapability('alarm_nilan.id2'))) {
      await this.removeCapability('alarm_nilan.id2');
    }

    if (alarms.length > 2) {
      if (!this.hasCapability('alarm_nilan.id3')) {
        await this.addCapability('alarm_nilan.id3');
      }
      await this.setCapabilityValue2('alarm_nilan.id3', alarms[2].toString());
    } else if ((alarms.length < 3) && (this.hasCapability('alarm_nilan.id3'))) {
      await this.removeCapability('alarm_nilan.id3');
    }

    await this.setCapabilityValue2('hidden_number.alarm_count', alarms.length);
  }

  async unsetAlarms(): Promise<void> {

    const filterState = await this.getCapabilityValue('alarm_generic.filter');
    const alarmState = await this.getCapabilityValue('alarm_pump_device');

    if (this.hasCapability('alarm_nilan.id3')) {
      await this.removeCapability('alarm_nilan.id3');
    }

    if (this.hasCapability('alarm_nilan.id2')) {
      await this.removeCapability('alarm_nilan.id2');
    }

    if (this.hasCapability('alarm_nilan.id1')) {
      await this.removeCapability('alarm_nilan.id1');
    }

    if ((alarmState === true) || (alarmState === null)) {

      await this.setCapabilityValue2('alarm_pump_device', false);
      await this.unsetWarning();

      if (filterState === true) {
        await this.setWarning(this.homey.__('warnings.filter_change'));
      }

      await this.setCapabilityValue2('hidden_number.alarm_count', 0);
    }
  }

  async setFilterAlarm(): Promise<void> {
  
    const filterState = await this.getCapabilityValue('alarm_generic.filter');
    const alarmState = await this.getCapabilityValue('alarm_pump_device');

    if ((filterState === false || (filterState === null))) {
      await this.setCapabilityValue2('alarm_generic.filter', true);
      if (alarmState !== true) {
        await this.setWarning(this.homey.__('warnings.filter_change'));
      }
    }
  }

  async unsetFilterAlarm(): Promise<void> {

    const filterState = await this.getCapabilityValue('alarm_generic.filter');
    const alarmState = await this.getCapabilityValue('alarm_pump_device');

    if ((filterState === true) || (filterState === null)) {
      await this.setCapabilityValue2('alarm_generic.filter', false);
      if ((filterState === true) && (alarmState !== true)) {
        await this.unsetWarning();
      }
    }
  }

  async resetAlarms(): Promise<void> {

    const filterState = await this.getCapabilityValue('alarm_generic.filter');
    const alarmState = await this.getCapabilityValue('alarm_pump_device');
    const warningState = ((filterState === true) || (alarmState === true)) ? true : false;

    if ((alarmState === null) || (alarmState === 'null') || (alarmState === true))
      await this.setCapabilityValue2('alarm_pump_device', false);

    if ((filterState === null) || (filterState === 'null') || (filterState === true))
      await this.setCapabilityValue2('alarm_generic.filter', false);

    if (warningState === true) {
      await this.unsetWarning();
    }

    if (this.hasCapability('alarm_nilan.id1')) {
      await this.removeCapability('alarm_nilan.id1');
    }

    if (this.hasCapability('alarm_nilan.id2')) {
      await this.removeCapability('alarm_nilan.id2');
    }

    if (this.hasCapability('alarm_nilan.id3')) {
      await this.removeCapability('alarm_nilan.id3');
    }

    await this.setCapabilityValue2('hidden_number.alarm_count', 0);
    await this.setCapabilityValue2('alarm_pump_device', false);
  }

  async previousAlarmCode(idx: number): Promise<number> {

    if ((idx === 1) && (this.hasCapability('alarm_nilan.id1'))) {
      return parseInt(await this.getCapabilityValue('alarm_nilan.id1'));
    } else if ((idx === 2) && (this.hasCapability('alarm_nilan.id2'))) {
      return parseInt(await this.getCapabilityValue('alarm_nilan.id2'));
    } else if ((idx === 3) && (this.hasCapability('alarm_nilan.id3'))) {
      return parseInt(await this.getCapabilityValue('alarm_nilan.id3'));
    }

    return 0;
  }

  parseFilter(status: number, id1: number, id2: number, id3: number, filt: number): Boolean {

    if (filt !== 0)
      return true;

    const cnt = status & 0x03;

    if ((cnt > 0) && (id1 == 19)) {
      return true;
    } else if ((cnt > 1) && (id2 == 19)) {
      return true;
    } else if ((cnt > 2) && (id3 == 19)) {
      return true;
    }

    return false;
  }

  parseAlarms(status: number, id1: number, id2: number, id3: number, filt: number): Array<number> {

    const arr = new Array<number>();
    const cnt = status & 0x03;

    if ( cnt > 0 ) {

      if ((id1 !== 19) && (id1 !== 0)) {
        arr.push(id1);
      }

      if ((cnt > 1) && (id2 !== 19) && (id2 !== 0)) {
        arr.push(id2);
      }

      if ((cnt > 2) && (id3 !== 19) && (id3 !== 0)) {
        arr.push(id3);
      }      
    }

    return arr;
  }

  async parsePreviousAlarms(): Promise<Array<number>> {

    const arr = new Array<number>();
    const prevCount = await this.getCapabilityValue('hidden_number.alarm_count');
    const id1 = this.hasCapability('alarm_nilan.id1') ? parseInt(await this.getCapabilityValue('alarm_nilan.id1')) : 0;
    const id2 = this.hasCapability('alarm_nilan.id2') ? parseInt(await this.getCapabilityValue('alarm_nilan.id2')) : 0;
    const id3 = this.hasCapability('alarm_nilan.id3') ? parseInt(await this.getCapabilityValue('alarm_nilan.id3')) : 0;

    if ((prevCount > 0) && (id1 !== 0) && (id1 !== 19)) {
      arr.push(id1);
    }

    if ((prevCount > 1) && (id2 !== 0) && (id2 !== 19)) {
      arr.push(id2);
    }

    if ((prevCount > 2) && (id3 !== 0) && (id3 !== 19)) {
      arr.push(id3);
    }

    return arr;
  }

  alarmsChanged(prev: Array<number>, current: Array<number>): Boolean {

    if (prev.length !== current.length) {
      return true;
    } else if (( prev.length === current.length) && (prev.length === 0)) {
      return false;
    }

    if ((prev.length > 0) && (prev[0] !== current[0])) {
      return true;
    } else if ((prev.length > 1) && (prev[1] !== current[1])) {
      return true;
    } else if ((prev.length > 2) && (prev[2] !== current[2])) {
      return true;
    }

    return false;
  }

  async updateAlarms(status: number, id1: number, id2: number, id3: number, filt: number): Promise<void> {

    try {

      const prevFilterState = await this.getCapabilityValue('alarm_generic.filter');
      const prevAlarms = await this.parsePreviousAlarms();
      const newAlarms = this.parseAlarms(status, id1, id2, id3, filt);
      const newFilterState = this.parseFilter(status, id1, id2, id3, filt);

      if ((prevFilterState !== newFilterState) && (newFilterState)) {
        await this.setFilterAlarm();
      } else if ((prevFilterState !== newFilterState) && (!newFilterState)) {
        await this.unsetFilterAlarm();
      }

      if (!this.alarmsChanged(prevAlarms, newAlarms)) {
        return;
      }

      if (newAlarms.length === 0) {
        await this.unsetAlarms();
        return;
      }

      await this.setAlarms(newAlarms);

    } catch (err) {
      this.log('Update alarms error:', err);
    }
  }

  async updateValue(key: string, value: number, opts:any): Promise<void> {

    if (!this.getAvailable() || !this.updates.has(key))
      return;

    try {

      this.clearFetchTimeout();

      this.updates.get(key)!.timeout = this.homey.setTimeout(() => {
        this.updates.get(key)!.timeout = undefined;
      }, 5000);

      const toValue = value * (this.updates.get(key)!.factor == undefined ? 1 : this.updates.get(key)!.factor!);
      await this._api.write(this.updates.get(key)!.id, this.updates.get(key)!.queries, toValue);

      if ( this.updates.get(key)!.capability !== undefined && this.hasCapability(this.updates.get(key)!.capability!))
          await this.setCapabilityValue2(this.updates.get(key)!.capability!, value);

    } finally {
      this.addFetchTimeout();
    }
  }

}
