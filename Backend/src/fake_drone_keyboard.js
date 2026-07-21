import mqtt from "mqtt";
import readline from "readline";
import { computeDestinationPoint } from "geolib";

const client = mqtt.connect("mqtt://localhost:1883");

let pitch = 0;
let roll = 0;
const MAX_ANGLE = 30; 

let lat = 44.340974;
let lng = 10.829357;
const alt = 120;

client.on("connect", () => {
    console.clear();
    console.log("Fake drone connesso a Mosquitto\n");
    console.log("Frecce SU/GIU  -> pitch (avanti/indietro)");
    console.log("Frecce SX/DX   -> roll (sinistra/destra)");
    console.log("Combina le frecce: es. SU poi DESTRA = pitch e roll insieme");
    console.log("SPAZIO         -> centra pitch/roll");
    console.log("c        -> scollega il drone\n");
    console.log("a        -> esci\n");

    client.publish("drone/status", JSON.stringify({ online: true }), { retain: true });
    client.publish("drone/gps_status", JSON.stringify({ value: 1 }), { retain: true });


    printState();

    setInterval(() => {
        client.publish("drone/commands", JSON.stringify({
            thrust: 6000,
            roll,
            pitch,
            yaw: 0
        }));
    }, 200);

    setInterval(() => {
        const deadzone = 2;

        const angleOk = Math.abs(pitch) >= deadzone || Math.abs(roll) >= deadzone;

        if (angleOk) {
            // stessa fisica del firmware: la spinta orizzontale è
            // proporzionale a tan(angolo di inclinazione), non all'angolo grezzo
            const forwardComponent = -Math.tan(pitch * Math.PI / 180);   // avanti = nord
            const rightComponent = Math.tan(roll * Math.PI / 180);         // destra = est

            // calcolo il bearing (direzione in gradi, 0=nord) dai componenti nord/est
            const bearingRad = Math.atan2(rightComponent, forwardComponent);
            let bearingDeg = bearingRad * 180 / Math.PI;
            if (bearingDeg < 0) bearingDeg += 360;

            const speedMetriPerTick = 3;

            const nuovoPunto = computeDestinationPoint(
                { latitude: lat, longitude: lng },
                speedMetriPerTick,
                bearingDeg
            );

            lat = nuovoPunto.latitude;
            lng = nuovoPunto.longitude;
        }

        client.publish("drone/gps", JSON.stringify({
            lat,
            lng,
            alt,
            sat: 8,
            hdop: 1.2
        }));
    }, 1000);
});

function printState() {
    readline.cursorTo(process.stdout, 0, 8);
    readline.clearLine(process.stdout, 0);
    process.stdout.write(
        `pitch: ${pitch.toString().padStart(4)}   roll: ${roll.toString().padStart(4)}   ` +
        `lat: ${lat.toFixed(6)}   lng: ${lng.toFixed(6)}`
    );
}

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
}

process.stdin.on("keypress", (str, key) => {
    if (key.name === "c") {
        client.publish("drone/status", JSON.stringify({ online: false }), { retain: true });
        return;
    }
    if (key.name === "a") {
        process.exit();

        return;
    }


    switch (key.name) {
        case "up":
            pitch = -MAX_ANGLE;
            break;
        case "down":
            pitch = MAX_ANGLE;
            break;
        case "left":
            roll = -MAX_ANGLE;
            break;
        case "right":
            roll = MAX_ANGLE;
            break;
        case "space":
            pitch = 0;
            roll = 0;
            break;
        default:
            return;
    }

    printState();
});