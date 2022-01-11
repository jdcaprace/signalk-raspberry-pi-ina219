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
        default: 60
      },
      path: {
        type: 'string',
        title: 'SignalK Path',
        description: 'This is used to build the path in Signal K. It will be appended to \'environment\'',
        default: 'inside.engineroom' 
		    //https://signalk.org/specification/1.5.0/doc/vesselsBranch.html
		    //environment/inside/temperature [Units: K (Kelvin)]  and environment/inside/pressure [Units: Pa (Pascal)]
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

    function createDeltaMessage (temperature, pressure) {
      var values = [
        {
          'path': 'environment.' + options.path + '.temperature',
          'value': temperature
        }, {
          'path': 'environment.' + options.path + '.pressure',
          'value': pressure
        }
      ];
     

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
		  const sensor = await ina219(bmpoptions)
		  const data = await sensor.read()
		    // temperature_C, pressure_Pa are returned by default for bmp180.
        // The standard path for Signal K is available here:
        // https://signalk.org/specification/1.5.0/doc/vesselsBranch.html
		    // Therefore: environment/inside/temperature [Units: K (Kelvin)] and environment/inside/pressure [Units: Pa (Pascal)]
        temperature = data.temperature + 273.15;
        pressure = data.pressure;
        //console.log(`data = ${JSON.stringify(data, null, 2)}`);
		    //console.log(data)
        
        // create message
        var delta = createDeltaMessage(temperature, pressure)
        
        // send data
        app.handleMessage(plugin.id, delta)		
	
        //close sensor
        await sensor.close()

        .catch((err) => {
      console.log(`bmp180 read error: ${err}`);
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


