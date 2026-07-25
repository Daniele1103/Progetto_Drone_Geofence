import { WebSocketServer } from "ws";
import { lastGps } from "../mqtt/mqttClient.js";
import {checkGeofences} from '../api/controllers/geofenceController.js';

const wss = new WebSocketServer({ port: 3001 });

console.log("WebSocket server avviato su ws://localhost:3001");

const clients = new Set();

let droneOnline = false;

wss.on("connection", (ws) => {

    console.log("Client connesso alla web socket");

    clients.add(ws);

    if (lastGps) {
        checkGeofences(lastGps.lng, lastGps.lat)
            .then((geofences) => {

                ws.send(JSON.stringify({
                    type: "geofence_snapshot",
                    zones: geofences
                }));

            })
            .catch(console.error);
    }

    // stato server iniziale
    ws.send(JSON.stringify({
        type: "server",
        connected: true,
        droneOnline         // per passare il primo dato, perchè se il drone fosse spento sul topic non ci sarebbe scritto nulla nè on nè off
    }));

    ws.on("close", () => {
        clients.delete(ws);
        console.log("CLient disconnesso dalla web socket");
    });
});

export function broadcast(data) {

    const message = JSON.stringify(data);

    if (data.type === "status") {
        droneOnline = data.online;
        //console.log("ciao")

        if (!droneOnline) {
            const offlineMsg = JSON.stringify({
                type: "status",
                online: false
            });

            for (const client of clients) {
                if (client.readyState === 1) {
                    client.send(offlineMsg);
                }
            }
            return;
        }
    }

    if (!droneOnline) return;       


    for (const client of clients) {
        if (client.readyState === 1) {
            client.send(message);
            //console.log(message)
        }
    }
}

export default wss;