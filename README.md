### homey-nilan-app

With this app you can get support for many Nilan heatpumps running with CTS602 board
or with CTS700 board - to Homey.

Connection to Nilan must be made through TCP Modbus device/bridge.
There are numerous one's available from many vendors, such as waveshare.

Personally I can recommend very reasonable priced Elfin EW11 for this,
it is available on AliExpress for pretty cheap
I do not get anything for this recommendation, it is just my personal opinion;
device runs on various voltages, including +12V provided by Nilan's heatpumps.

TCP Modbus device is wired to RS485 bus on either CTS602, or if you have 8 pin port
at top of the device (with printer USB port), then it is wired to there. 

The app exposes the controls supported by each detected CTS602 model, including room,
hot-water and central-heating setpoints, humidity, operating modes and ventilation.
Available Flow actions include:

- Set ventilation step (1–4), suitable for radon, CO₂ and humidity automation
- Set room, hot-water and central-heating temperature
- Set target humidity
- Set power, operating mode, air-exchange mode and power-saving mode

The ventilation step can also be changed directly from the device UI. Capabilities and
controls vary by Nilan model and installed options. CTS700 support currently focuses on
monitoring the Modbus values exposed by that controller.

Ventilation-only units get a ventilation profile: they are added as an air treatment
device, and compressor, hot-water, central-heating (EK) and air-exchange-mode
capabilities and Flow actions are left out. The registers for those functions are not
polled on these units. This applies to:

- **CTS602 Light** controllers, such as the Nilan Comfort CT series (e.g. CT500). Light
  firmware is detected during pairing from its Modbus protocol version (Bus.Version 20 or
  newer) and the missing compressor register, because Light reuses the CTS602 type codes
  with a different meaning (a CT500 reports the code of "VPL 15"). Light devices only get
  the sensors the Light register map provides (T0, T3, T4, T7, T8, humidity and optional
  CO₂) plus a bypass damper state and the ventilation state (normal, humidity, CO₂ or
  temperature controlled). Devices paired before Light detection existed must be removed
  and paired again.
- Full CTS602 Comfort units (type codes COMFORT, COMFORT2, COMFORTi and Comfort N).
  Existing Comfort devices drop the unused capabilities on the next app start.

Connection settings can be changed from the device settings. Polling and temperature
report intervals are in seconds; avoid unnecessarily short intervals to keep Modbus
traffic moderate.

For CTS602, the pairing view asks whether a CO₂ sensor and an external heat source are
actually installed. These are manual installation choices because the relevant Modbus
information is not reliable enough for automatic detection across devices and firmware
versions. They determine the Homey capabilities when the device is created; changing
the physical installation later requires adding the Homey device again.

The optional central-heating return-water (`T13`) capability is added only after three
consecutive plausible, non-zero readings. Controllers without that sensor normally
report zero, so they no longer receive a permanently empty return-temperature tile.
Once detected, the capability is retained to avoid breaking Flows or Insights history.
The optional compressor-capacity capability behaves similarly: it is only added after
CTS602 reports a valid value above zero. Most units report zero because they use the
standard compressor and do not expose this optional capacity value.

CTS602 devices also expose **Estimated power** (`measure_power`) and accumulated
**Estimated energy** (`meter_power`). These are calculated estimates, not electricity
meter readings. The calculation combines the CTS602 output states with configurable
nominal powers for the compressor, fan steps, hot-water heater, central-heating
elements, circulation pump and optional external heat source. The three CTS602
central-heating relay bits are decoded as a binary heater level from 0 to 7. Because
the physical elements have equal power, the central-heating estimate is the configured
power of one element multiplied by the active level. This works across models with
different numbers of elements without separate per-element settings. Enter the actual
nameplate or measured input powers in device settings for a useful estimate. The external source
is 0 W by default because CTS602 reports only a heat request and the connected source
may not consume electricity. The accumulated estimate is retained across restarts but
can differ from a real meter due to cycling, variable loads and polling intervals.

### Credits

This app/driver is based on already existing SystemAir app, which you can find
from https://github.com/balmli/com.systemair.
So, thank you for balmli and tesharp for their work.
