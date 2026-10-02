import Homey from 'homey';
import PairSession from 'homey/lib/PairSession';
import net from 'net';
import {ID_REGISTERS, DEVICE_IDENTIFICATION_REGISTER, MachineTypes} from './constants';
import {REGISTERS} from './registers';
import {Register} from '../../types';
import {ModbusApi} from '../../modbus_api';

// CTS602 Light protocol starts at Bus.Version 20 (Light firmware 1.1.19).
const LIGHT_MIN_BUS_VERSION = 20;

module.exports = class CTS602Driver extends Homey.Driver {

  async onInit() {
    this.log('Nilan CTS602 driver has been initialized');
  }

  async _getMachineType(api: ModbusApi): Promise<number | undefined> {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const machineType = await api.readSingle(DEVICE_IDENTIFICATION_REGISTER, ID_REGISTERS);
          if (machineType === undefined )
            reject(this.homey.__('errors.device_type_read_error'));
          if (!MachineTypes.has((machineType as unknown) as number)) {
            this.log('Unsupported machine type code ', (machineType as unknown) as number);
            reject(this.homey.__('errors.device_unsupported', {machineType}));
          } else if (MachineTypes.get((machineType as unknown) as number) === '?') {
            this.log('Unsupported machine type code ', (machineType as unknown) as number, ' - value is reserved for future uses');
            reject(this.homey.__('errors.device_unsupported', {machineType}));
          }
          resolve((machineType as unknown) as number);
        } catch(err) {
          this.log(err);
        }
        reject(this.homey.__('errors.identification_failed'));
      })();
    });
  }

  /* CTS602 Light (e.g. Comfort CT series) reuses Control.Type codes with a different meaning, so it
     is recognised by its protocol version and the missing compressor output register instead. */
  async _isLight(api: ModbusApi): Promise<boolean> {
    const busVersion = await api.readSingle('Bus.Version', ID_REGISTERS);
    if (busVersion === undefined || busVersion < LIGHT_MIN_BUS_VERSION)
      return false;

    const compressor = await api.readSingle('Output.Compressor', REGISTERS);
    this.log('Bus version', busVersion, 'compressor register', compressor === undefined ? 'not available' : 'available');
    return compressor === undefined;
  }

  onPair(session: PairSession): void {

    let devices: any[] = [];

    session.setHandler('connection_details_entered', async (data) => {
      this.log('onPair: connection_details_entered:', data);
      if (!net.isIP(data.ipaddress)) {
        throw new Error(this.homey.__('pair.valid_ip_address'));
      }

      const port = Number(data.port);
      const unitId = Number(data.unitid);
      if (!Number.isInteger(port) || port < 1 || port > 65535)
        throw new Error('Port must be an integer between 1 and 65535.');
      if (!Number.isInteger(unitId) || unitId < 1 || unitId > 254)
        throw new Error('Modbus unit ID must be an integer between 1 and 254.');

      const api = new ModbusApi({
        homey: this.homey,
        logger: this.log,
      });

      let machineType: number | undefined;
      let light = false;
      try {
        await api._connection(data.ipaddress, port, unitId);
        light = await this._isLight(api);
        machineType = light
          ? await api.readSingle(DEVICE_IDENTIFICATION_REGISTER, ID_REGISTERS)
          : await this._getMachineType(api);
      } finally {
        await api._disconnect();
      }

      if (machineType === undefined)
        throw new Error(this.homey.__('errors.identification_failed'));

      if (light)
        this.log('CTS602 Light with type code', machineType, 'found');
      else
        this.log('Machine type', MachineTypes.get(machineType), 'with type code', machineType, 'found');

      const machineId = `${data.ipaddress}.${port}.${unitId}`;
      this.log('device id:', machineId);

      const hasExternalHeater = data.externalheater === true;
      const hasCo2Sensor = data.co2sensor === true;

      devices = [{
        name: light ? 'Nilan CTS602 Light' : MachineTypes.get(machineType),
        data: {
          id: machineId,
          model: machineType,
          ...(light ? { profile: 'light' } : {}),
          externalHeater: hasExternalHeater,
          co2Sensor: hasCo2Sensor
        },
        settings: {
          'device-ip': data.ipaddress,
          'device-port': port,
          'device-id': unitId
        }
      }];

      // @ts-ignore
      await session.showView('list_devices');
    });

    session.setHandler('list_devices', async () => {
      return devices;
    });

  }

};
