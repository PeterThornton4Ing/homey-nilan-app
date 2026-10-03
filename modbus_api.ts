import net from 'net';
import { Device } from 'homey';
import { ModbusTCPClient } from 'jsmodbus';
import { Register } from './types';

const {default: PQueue} = require('p-queue');

const CONNECT_TIMEOUT_MS = 10 * 1000;
// Upper bound for one queued read/write batch, so a stuck command can never block the queue for good.
const COMMAND_TIMEOUT_MS = 60 * 1000;

export interface ModbusApiOptions {
  device?: Device;
  homey: any;
  logger: any;
  onUpdateValues?: (result: Register.Results, device: any)=> Promise<void>;
}

export class ModbusApi {
  _device?: Device;
  _homey: any;
  _logger: any;
  _onUpdateValues?: (result: Register.Results, device: any) => Promise<void>;
  _commandQueue: any;
  _client?: ModbusTCPClient;
  _socket?: net.Socket;
  _socketTimeout?: NodeJS.Timeout;
  _errorCounter: number;

  constructor(options: ModbusApiOptions) {
    this._device = options.device;
    this._homey = options.homey;
    this._logger = options.logger;
    this._onUpdateValues = options.onUpdateValues;
    this._commandQueue = new PQueue({concurrency: 1, timeout: COMMAND_TIMEOUT_MS, throwOnTimeout: false});
    this._errorCounter = 0;
  }

  resetSocket(): void {
    this._onSocketTimeout();
  }

  async _connection(ipAddress?: string, port?: number, unitId?: number): Promise<ModbusTCPClient | undefined> {

    return new Promise((resolve, reject) => {
      if (this._client) {
        this._addSocketTimeout();
        resolve(this._client);
      } else {
        const self = this;
        const socket = new net.Socket();
        this._socket = socket;
        this._client = new ModbusTCPClient(socket, this._device ? Number(this._device.getSetting('device-id')) : Number(unitId), 5000);

        // The promise must always settle: a pending connection blocks the command queue and stops polling.
        let settled = false;
        const settle = (done: () => void) => {
          if (settled) return;
          settled = true;
          self._homey.clearTimeout(connectTimeout);
          done();
        };
        const connectTimeout = self._homey.setTimeout(() => {
          self._logger('Socket connect timed out');
          socket.destroy();
          settle(() => reject('connect timeout'));
        }, CONNECT_TIMEOUT_MS);

        socket.on('ready', () => {
          // self._logger('Socket ready');
          self._addSocketTimeout();
          settle(() => resolve(this._client));
        }).on('close', () => {
          // self._logger('Socket closed');
          if (self._socket === socket) {
            self._clearSocketTimeout();
            self._socket = undefined;
            self._client = undefined;
          }
          settle(() => reject('connection closed'));
        }).on('error', (error: any) => {
          self._logger('Socket error', error);
          if (error.code === "ECONNREFUSED") {
            const uri = `${error.address}:${error.port}`;
            settle(() => reject(new Error(self._homey.__('pair.connection_refused', {uri}))));
          } else if (error.code === "EHOSTUNREACH") {
            const uri = `${error.address}:${error.port}`;
            settle(() => reject(new Error(self._homey.__('pair.connection_unreachable', {uri}))));
          }
          self._socket?.end();
          settle(() => reject('connect error'));
        });
        this._socket.connect({
          host: this._device ? this._device.getSetting('device-ip') : ipAddress,
          port: this._device ? this._device.getSetting('device-port') : port,
        });
      }
    });
  }

  _disconnect() {

    this._socket?.end();
    this._clearSocketTimeout();
    this._socket = undefined;
    this._client = undefined;
  }

  _addSocketTimeout() {
    if (this._device) {
      this._clearSocketTimeout();
      this._socketTimeout = this._device.homey.setTimeout(() => this._onSocketTimeout(), 1000 * 60);
    }
  }

  _clearSocketTimeout() {
    if (this._socketTimeout && this._device) {
      this._device.homey.clearTimeout(this._socketTimeout);
      this._socketTimeout = undefined;
    }
  }

  _onSocketTimeout() {
    this._errorCounter = 0;
    this._socket?.end();
    this._socket = undefined;
    this._client = undefined;
  }

  async readSingle(name: string, params: Register.Queries) {

    const client = await this._connection();
    if (client) {
      const param = params.get(name);
      if (param !== undefined) {
        try {
          const modifier = param.modifier_read !== undefined ? param.modifier_read : this.noModifier;
          const result = param.type === Register.Type.Input ? await client.readInputRegisters(param.addr, 1) : (
            param.type === Register.Type.Holding ? await client.readHoldingRegisters(param.addr, 1) : (
              param.type === Register.Type.Coil ? await client.readCoils(param.addr, 1) : (
                param.type === Register.Type.Discrete ? await client.readDiscreteInputs(param.addr, 1) : undefined)));

          if (result !== undefined) {
            const {metrics, response} = result;
            const body = response?.body || (response as any)?._body;
            return body && body.valuesAsArray && body.valuesAsArray.length > 0 && body.valuesAsBuffer
              ? modifier(body.valuesAsBuffer.readInt16BE(0)) / (param.scale || 1) : undefined;
          }
        } catch(error) {
          this.handleSocketError('Read', error);
        }
      }
    }
    return undefined;
  }

  async read(params: Register.Queries) {
    return this._commandQueue.add(async () => {
        const client = await this._connection();
        if (client) {
          try {
            const keys = Array.from(params.keys());
            const results = await Promise.allSettled(keys.map((key: string) => {
              const param = params.get(key)!;
              if (param.type === Register.Type.Input) return client.readInputRegisters(param.addr, 1);
              else if (param.type === Register.Type.Holding) return client.readHoldingRegisters(param.addr, 1);
              else if (param.type === Register.Type.Coil) return client.readCoils(param.addr, 1);
              else if (param.type === Register.Type.Discrete) return client.readDiscreteInputs(param.addr, 1);
              else return Promise.reject(new Error(`Invalid register type for key: ${key}`));
            }));

            const matched = this.matchResults(params, results);
            if (matched.size > 0 && this._onUpdateValues && this._device) {
              await this._onUpdateValues(matched, this._device);
            }
          } catch (error) {
            this.handleSocketError('Read', error);
          }
        }
      }
    );
  }

  handleSocketError(func: string, error: any) {
    this._errorCounter++;
    this._logger(func, 'error:', error, this._errorCounter, ' times');
    if (this._errorCounter > 5)
      this.resetSocket();
  }

  noModifier = (value: number): number => {
    return value;
  }

  matchResults = (params: Register.Queries, results: PromiseSettledResult<any>[]): Register.Results => {

    const matched: Register.Results = new Map();
    const keys = Array.from(params.keys());
    let hasSocketError = false;

    keys.forEach((key, i) => {
      const param = params.get(key)!;
      const res = results[i];

      if (res.status === 'fulfilled' && res.value) {
        try {
          const {metrics, response} = res.value;
          const body = response?.body || (response as any)?._body;
          const modifier = param.modifier_read !== undefined ? param.modifier_read : this.noModifier;

          const value = body && body.valuesAsArray && body.valuesAsArray.length > 0 && body.valuesAsBuffer
            ? modifier(body.valuesAsBuffer.readInt16BE(0)) / (param.scale || 1) : undefined;

          if (metrics) {
            this._logger('Addr:', param.addr, key, '=', value, '(transfer:', metrics.transferTime,'ms, cue:', metrics.waitTime, 'ms)');
          } else {
            this._logger('Addr:', param.addr, key, '=', value);
          }

          if ( value !== undefined )
            matched.set(key, value);
        } catch (err) {
          this._logger('Error parsing register result for key:', key, err);
        }
      } else if (res.status === 'rejected') {
        const reason = res.reason;
        this._logger('Addr:', param.addr, key, 'read failed:', reason?.message || reason);
        if (reason && (reason.code === 'ECONNRESET' || reason.code === 'EPIPE' || reason.code === 'ECONNREFUSED' || (typeof reason.message === 'string' && (reason.message.includes('socket') || reason.message.includes('closed'))))) {
          hasSocketError = true;
        }
      }
    });

    if (hasSocketError) {
      this.handleSocketError('Read', 'Socket error encountered during register reads');
    }

    return matched;
  }

  async write(name: string, params: Register.Queries, value: any) {

    if (!params.has(name)) {
      this._logger('unable to write to register', name, ', entry not found from given available params');
      return;
    }

    const param = params.get(name)!;

    return this._commandQueue.add(async () => { 
        const client = await this._connection();
        if (client) {
          
              let toVal;
              if (typeof value === 'boolean') {
                toVal = value ? 1 : 0;
              } else {
                toVal = Number(value) * (param.scale || 1);
                if (param.min !== undefined && toVal < param.min)
                  toVal = param.min;
                if (param.max !== undefined && toVal > param.max)
                  toVal = param.max;
              }
              
              const modifier = param.modifier_write !== undefined ? param.modifier_write : this.noModifier;

              if (param.modifier_write !== undefined)
                this._logger('Write:', param.addr, name, '=', toVal);
              else this._logger('Write:', param.addr, name, '=', toVal, '->', modifier(toVal));

              toVal = modifier(toVal);

            try {
              const response = await client.writeMultipleRegisters(param.addr, [toVal]);
              const {metrics} = response;
              this._logger('Write OK:', param.addr, name, '(transfer:', metrics.transferTime,'ms, cue:', metrics.waitTime,'ms)');
            } catch (error) {
              this.handleSocketError('Write', error);
            }
        }
      }
    );

  }

}
