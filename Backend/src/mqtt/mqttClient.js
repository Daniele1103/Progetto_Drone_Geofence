import mqtt from "mqtt";
import {
    saveGps,
    saveTemperature,
    saveHumidity
} from "../influx/influxClient.js";

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";

// Connessione al broker
const client = mqtt.connect(MQTT_URL);          // apre una connessione persistente (socket TCP).

const TOPICS = [
    "drone/gps",          // mi sottoscrivo ai topic che voglio (nond evono essere registrati), semplicemente riceverò soloq aundo qualcuno pubblicherà su uno di quei topic
    "drone/temp",
    "drone/hum"
];

// connect per connettermi
client.on("connect", () => {
    console.log("Connesso a Mosquitto:", MQTT_URL);

    // sottoscrizione ai topic
    TOPICS.forEach(topic => {
        client.subscribe(topic, (err) => {
            if (err) {
                console.error("Errore subscribe:", topic, err.message);
            } else {
                console.log("Subscribed a:", topic);
            }
        });
    });
});

// evento message per ricevere
client.on("message", (topic, message) => {
    try {
        const data = JSON.parse(message.toString());

        /*
        console.log("MQTT message ricevuto");
        console.log("Topic:", topic);
        console.log("Data:", data);

        */

        handleMessage(topic, data);

    } catch (err) {
        console.error("Errore parsing MQTT message:", err.message);
    }
});

client.on("error", (err) => {
    console.error("MQTT error:", err.message);
});

client.on("reconnect", () => {
    console.log("MQTT reconnect...");
});

function handleMessage(topic, data) {

    switch (topic) {

        case "drone/gps":

            saveGps(data)
                .then(() => {
                    console.log("gps drone:", data);
                })
                .catch(err => {
                    console.error("Errore GPS:", err.message);
                });

            break;

        case "drone/temp":

            saveTemperature(data)
                .then(() => {
                    console.log("temperatura:", data);
                })
                .catch(err => {
                    console.error("Errore temperatura:", err.message);
                });

            break;

        case "drone/hum":

            saveHumidity(data)
                .then(() => {
                    console.log("umidità:", data);
                })
                .catch(err => {
                    console.error("Errore umidità:", err.message);
                });

            break;

        default:

            console.log("Topic non gestito:", topic);
    }
}

export default client;