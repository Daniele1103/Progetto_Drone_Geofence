import mqtt from "mqtt";

const client = mqtt.connect("mqtt://localhost:1883");

client.on("connect", () => {

    console.log("Fake drone connesso");

    let lat = 44.6983;
    let lng = 10.6312;

    setInterval(() => {

        // Simula movimento
        lat += (Math.random() - 0.5) * 0.0005;
        lng += (Math.random() - 0.5) * 0.0005;

        // GPS
        const gpsData = {
            lat,
            lng,
            alt: 120,
            timestamp: new Date().toISOString()
        };

        // Temperatura
        const tempData = {
            value: 20 + Math.random() * 10,
            timestamp: new Date().toISOString()
        };

        // Umidità
        const humData = {
            value: 50 + Math.random() * 20,
            timestamp: new Date().toISOString()
        };

        // Publish topic GPS
        client.publish(
            "drone/gps",
            JSON.stringify(gpsData)
        );

        // Publish topic temperatura
        client.publish(
            "drone/temp",
            JSON.stringify(tempData)
        );

        // Publish topic umidità
        client.publish(
            "drone/hum",
            JSON.stringify(humData)
        );

        console.log("Dati inviati");

    }, 10000);
});