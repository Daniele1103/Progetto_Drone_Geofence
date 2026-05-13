import mqtt from "mqtt";
import {
    saveGps,
    saveTemperature,
    saveHumidity
} from "../influx/influxClient.js";
import {checkGeofences} from '../postgis/dbpg.js';
import { broadcast } from "../ws/wsServer.js";

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";

const client = mqtt.connect(MQTT_URL);       // apre una connessione persistente (socket TCP).    

const TOPICS = [
    "drone/gps",                    // mi sottoscrivo ai topic che voglio (nond evono essere registrati), semplicemente riceverò soloq aundo qualcuno pubblicherà su uno di quei topic
    "drone/temp",
    "drone/hum",
    "drone/battery",
    "drone/status"
];

let droneGeofenceState = [];
export let lastGps = null;

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

        handleMessage(topic, data);

    } catch (err) {
        console.error("Errore parsing MQTT message:", err.message);
    }
});

function handleMessage(topic, data) {

    switch (topic) {
        case "drone/status":
            console.log("status: ", data.online)
            broadcast({
                type: "status",
                online: data.online
            });
            if(!data.online){
                lastGps=null;
            }
            break;

        case "drone/gps":
            lastGps = data;
            checkGeofences(data.lng, data.lat)
                .then((geofences) => {

                    const currentIds = geofences.map(g => g.id);

                    // ENTER
                    for (const gf of geofences) {
                        const alreadyInside = droneGeofenceState.find(g => g.id === gf.id);

                        if (!alreadyInside) {
                            console.log("ENTER GEOFENCE:", gf.id, gf.name);

                            broadcast({
                                type: "geofence_enter",
                                zone: gf
                            });
                        }
                    }

                    // EXIT
                    for (const prev of droneGeofenceState) {
                        if (!currentIds.includes(prev.id)) {
                            console.log("EXIT GEOFENCE:", prev.id, prev.name);

                            broadcast({
                                type: "geofence_exit",
                                zone: prev
                            });
                        }
                    }
                    // stato attuale
                    console.log("CURRENT INSIDE GEOFENCES:", geofences);

                    // aggiorna stato
                    droneGeofenceState = geofences;
                })
                .catch((err) => {
                    console.error("Errore geofence:", err.message);
                });

            saveGps(data)
                .then(() => {
                    //console.log("gps drone:", data);
                })
                .catch(err => {
                    console.error("Errore GPS:", err.message);
                });

            broadcast({
                type: "gps",
                ...data
            });

            break;

        case "drone/temp":

            saveTemperature(data)
                .then(() => {
                    //console.log("temperatura:", data);
                })
                .catch(err => {
                    console.error("Errore temperatura:", err.message);
                });

            broadcast({
                type: "temperature",
                value: data.value
            });

            break;

        case "drone/hum":

            saveHumidity(data)
                .then(() => {
                    //console.log("umidità:", data);
                })
                .catch(err => {
                    console.error("Errore umidità:", err.message);
                });

            broadcast({
                type: "humidity",
                value: data.value
            });

            break;

        case "drone/battery":

            broadcast({
                type: "battery",
                value: data.value
            });

            break;

        default:
            console.log("Topic non gestito:", topic);
    }
}

export default client;