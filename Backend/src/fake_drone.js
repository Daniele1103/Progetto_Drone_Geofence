import mqtt from "mqtt";

const client = mqtt.connect("mqtt://localhost:1883");

client.on("connect", () => {

    console.log("Fake drone connesso");

    let lat = 44.6983;
    let lng = 10.6312;

    let battery = 100;

    // Stato drone (ON/OFF)
    let droneOnline = true;

    setInterval(() => {

        // DRONE STATUS (ON/OFF)
        const statusData = {
            online: droneOnline,
            timestamp: new Date().toISOString()
        };

        // DRONE OFF → non inviare dati
        if (!droneOnline) {
            client.publish("drone/status", JSON.stringify(statusData));
            return;
        }

        // BATTERY
        battery -= Math.random() * 0.2;
        if (battery < 0) battery = 0;

        // MOVIMENTO GPS
        lat += (Math.random() - 0.5) * 0.0005;
        lng += (Math.random() - 0.5) * 0.0005;

        // GPS
        const gpsData = {
            lat,
            lng,
            alt: 120,
            timestamp: new Date().toISOString()
        };

        // TEMPERATURE
        const tempData = {
            value: 20 + Math.random() * 10,
            timestamp: new Date().toISOString()
        };

        // HUMIDITY
        const humData = {
            value: 50 + Math.random() * 20,
            timestamp: new Date().toISOString()
        };

        // BATTERY
        const batteryData = {
            value: Math.round(battery),
            timestamp: new Date().toISOString()
        };

        // PUBLISH
        client.publish("drone/gps", JSON.stringify(gpsData));
        client.publish("drone/temp", JSON.stringify(tempData));
        client.publish("drone/hum", JSON.stringify(humData));
        client.publish("drone/battery", JSON.stringify(batteryData));
        client.publish("drone/status", JSON.stringify(statusData));

    }, 10000);
});