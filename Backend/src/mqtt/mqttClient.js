import mqtt from "mqtt";
import {
    saveGps,
    saveTemperature,
    saveHumidity
} from "../influx/influxClient.js";
import { checkGeofences, computePredictedPoints } from '../api/controllers/geofenceController.js';
import { broadcast } from "../ws/wsServer.js";

const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";

const client = mqtt.connect(MQTT_URL);       // apre una connessione persistente (socket TCP).    

const TOPICS = [
    "drone/gps",                    // mi sottoscrivo ai topic che voglio (nond evono essere registrati), semplicemente riceverò soloq aundo qualcuno pubblicherà su uno di quei topic
    "drone/temp",
    "drone/hum",
    "drone/battery",
    "drone/status",
    "drone/gps_status",
    "drone/commands"
];

let droneGeofenceState = [];
export let lastGps = null;

const batteryTable = [3.00, 3.78, 3.83, 3.87, 3.89, 3.92, 3.96, 4.00, 4.04, 4.10];  // fornita dal espdrone

function voltageToPercent(voltage) {
    if (voltage <= batteryTable[0]) return 0;
    if (voltage >= batteryTable[9]) return 100;

    for (let i = 0; i < 9; i++) {
        if (voltage >= batteryTable[i] && voltage <= batteryTable[i + 1]) {
            const fraction = (voltage - batteryTable[i]) / (batteryTable[i + 1] - batteryTable[i]);
            return (i + fraction) * 10;
        }
    }
    return 0;
}
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
            if (!data.online) {
                lastGps = null;
            }
            break;

        case "drone/gps":
            checkGeofences(data.lng, data.lat)
                .then((geofences) => {
                    if (!lastGps) {
                        broadcast({
                            type: "geofence_snapshot",
                            zones: geofences
                        });

                    }

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
                    lastGps = data;

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

            const batteryPercent = Math.round(voltageToPercent(data.value));

            //console.log("Batteria perc: " + batteryPercent+ " voltage: "+ data.value)
            broadcast({
                type: "battery",
                value: batteryPercent
            });

            break;

        case "drone/gps_status":

            const gps_status = data.value;

            //console.log("Valore GPS: "+gps_status);
            broadcast({
                type: "gps_status",
                value: gps_status
            });

            break;
        case "drone/commands":
            //console.log("Comandi: ", data)

            const points = computePredictedPoints(lastGps, data);
            broadcast({ type: "predicted_path", points });
            //console.log("punti previsti: ", points)
            break;

        default:
            console.log("Topic non gestito:", topic);
    }
}


export default client;