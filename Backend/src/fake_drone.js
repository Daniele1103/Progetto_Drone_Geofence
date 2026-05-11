import mqtt from "mqtt";

const client = mqtt.connect("mqtt://localhost:1883");

client.on("connect", () => {

    console.log("Fake drone connesso");

    let lat;
    let lng;

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

        // MOVIMENTO GPS (drone realistico lento attorno al punto base)
        const centerLat = 44.340974;
        const centerLng = 10.829357;

        // ~200 metri in gradi (1° lat ≈ 111km, 1° lng ≈ 111km * cos(lat))
        const radiusLat = 200 / 111000;
        const radiusLng = 200 / (111000 * Math.cos(centerLat * Math.PI / 180));

        // inizializzazione posizione e angolo
        if (typeof globalThis.angle === "undefined") {
            globalThis.angle = Math.random() * Math.PI * 2;
            lat = centerLat;
            lng = centerLng;
        }

        // piccolo cambiamento direzione graduale
        globalThis.angle += (Math.random() - 0.5) * 0.15;

        const speed = 0.0002; // più lento e realistico

        let newLat = lat + Math.cos(globalThis.angle) * speed;
        let newLng = lng + Math.sin(globalThis.angle) * speed;

        // distanza normalizzata dal centro (tiene conto della forma ellittica)
        const dLat = (newLat - centerLat) / radiusLat;
        const dLng = (newLng - centerLng) / radiusLng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);

        // se esce dal raggio, rimbalza verso l'interno rispecchiando l'angolo
        if (dist > 1) {
            globalThis.angle += Math.PI * (0.5 + Math.random() * 0.5); // svolta decisa
            newLat = lat;
            newLng = lng;
        }

        lat = newLat;
        lng = newLng;

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

    }, 1000);
});
