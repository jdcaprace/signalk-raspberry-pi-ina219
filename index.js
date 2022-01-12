/*
 * Copyright 2022 Jean-David Caprace <jd.caprace@gmail.com>
 *
 * Add the MIT license
 */

const ina219A = require('ina219-async');

module.exports = function (app) {
  let timer = null
  let plugin = {}

  plugin.id = 'signalk-raspberry-pi-ina219'
  plugin.name = 'Raspberry-Pi ina219'
  plugin.description = 'ina219 i2c current/voltage/power sensor on Raspberry-Pi'

  plugin.schema = {
    type: 'object',
    properties: {
      rate: {
        title: "Sample Rate (in seconds)",
        type: 'number',
        default: 5
      },
      pathvoltage: {
        type: 'string',
        title: 'SignalK Path of voltage',
        description: 'This is used to build the path in Signal K for the voltage sensor data',
        default: '.electrical.batteries.battery01.voltage' //Units: V (Volt)
		    //https://signalk.org/specification/1.5.0/doc/vesselsBranch.html
      },
      reportcurrent: {
        type: 'boolean',
        title: 'Also send the current data to Signalk',
        default: true
      },
      pathcurrent: {
        type: 'string',
        title: 'SignalK Path of current',
        description: 'This is used to build the path in Signal K for the current sensor data',
        default: '.electrical.batteries.battery01.current' //Units: A (Ampere)
		    //https://signalk.org/specification/1.5.0/doc/vesselsBranch.html
      },
      i2c_bus: {
        type: 'integer',
        title: 'I2C bus number',
        default: 1,
      },
      i2c_address: {
        type: 'string',
        title: 'I2C address',
        default: '0x40',
      },
    }
  }

  plugin.start = function (options) {

    function createDeltaMessage (voltage, current) {
      var values = [
        {
          'path': options.pathvoltage,
          'value': voltage
        }
      ];
    
    // Report current if desired
    if (options.reportcurrent == true) {
      values.push(
        {
          'path': options.pathcurrent,
          'value': current
        });
      }
      

      return {
        'context': 'vessels.' + app.selfId,
        'updates': [
          {
            'source': {
              'label': plugin.id
            },
            'timestamp': (new Date()).toISOString(),
            'values': values
          }
        ]
      }
    }

    // The ina219 constructor options are optional.
    //
    const bmpoptions = {
        bus : options.i2c_bus || 1, // defaults to 1
      	address : Number(options.i2c_address || '0x40'), // defaults to 0x40
	  };

	  // Read ina219 sensor data
    async function readina219() {
		  const sensor = await ina219(bmpoptions);
      await sensor.calibrate32V2A();

		  const busvoltage = await sensor.getBusVoltage_V();
      console.log("Bus voltage (V): " + busvoltage);
      const shuntvoltage = await sensor.getShuntVoltage_mV();
      console.log("Shunt voltage (mV): " + shuntvoltage);
      const shuntcurrent = await sensor.getCurrent_mA();
      console.log("Current (mA): " + shuntcurrent);

        //console.log(`data = ${JSON.stringify(data, null, 2)}`);
		    //console.log(data)
        
        // create message
        var delta = createDeltaMessage(shuntvoltage, shuntcurrent)
        
        // send data
        app.handleMessage(plugin.id, delta)		
	
        //close sensor
        //await sensor.close()

        .catch((err) => {
      console.log(`ina219 read error: ${err}`);
      });
    }

    //readina219();
    
    timer = setInterval(readina219, options.rate * 1000);
  }

  plugin.stop = function () {
    if(timer){
      clearInterval(timer);
      timeout = null;
    }
  }

  return plugin
}


