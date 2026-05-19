import mqtt from "mqtt";

const client = mqtt.connect("mqtt://localhost:1883");

client.on("connect", () => {

    console.log("Fake drone connesso");

    let lat;
    let lng;

    let battery = 100;

    let droneOnline = true;

    setInterval(() => {

        const statusData = {
            online: droneOnline,
            timestamp: new Date().toISOString()
        };

        if (!droneOnline) {
            client.publish("drone/status", JSON.stringify(statusData));
            return;
        }

        battery -= Math.random() * 0.2;
        if (battery < 0) battery = 0;

        const centerLat = 44.340974;
        const centerLng = 10.829357;

        const radiusLat = 200 / 111000;
        const radiusLng = 200 / (111000 * Math.cos(centerLat * Math.PI / 180));

        if (typeof globalThis.angle === "undefined") {
            globalThis.angle = Math.random() * Math.PI * 2;
            lat = centerLat;
            lng = centerLng;
        }

        globalThis.angle += (Math.random() - 0.5) * 0.15;

        const speed = 0.0002;

        let newLat = lat + Math.cos(globalThis.angle) * speed;
        let newLng = lng + Math.sin(globalThis.angle) * speed;

        const dLat = (newLat - centerLat) / radiusLat;
        const dLng = (newLng - centerLng) / radiusLng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);

        if (dist > 1) {
            globalThis.angle += Math.PI * (0.5 + Math.random() * 0.5);
            newLat = lat;
            newLng = lng;
        }

        lat = newLat;
        lng = newLng;

        const alt = 120;

        const gpsData = {
            lat,
            lng,
            alt,
            timestamp: new Date().toISOString()
        };

        // lat, lng, alt già disponibili — stessa posizione GPS di questo ciclo
        const tempData = {
            value: 20 + Math.random() * 10,
            lat,
            lng,
            alt,
            timestamp: new Date().toISOString()
        };

        const humData = {
            value: 50 + Math.random() * 20,
            lat,
            lng,
            alt,
            timestamp: new Date().toISOString()
        };

        const batteryData = {
            value: Math.round(battery),
            timestamp: new Date().toISOString()
        };

        client.publish("drone/gps", JSON.stringify(gpsData));
        client.publish("drone/temp", JSON.stringify(tempData));
        client.publish("drone/hum", JSON.stringify(humData));
        client.publish("drone/battery", JSON.stringify(batteryData));
        client.publish("drone/status", JSON.stringify(statusData));

    }, 1000);
});