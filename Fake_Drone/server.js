import express from "express";
import cors from "cors";
import mqtt from "mqtt";
import { computeDestinationPoint } from "geolib";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";

const client = mqtt.connect(MQTT_URL);

const MAX_ANGLE = 30;
const THRUST_FIXED = 6000;
const COMMANDS_INTERVAL_MS = 200;
const GPS_INTERVAL_MS = 1000;
const GPS_SPEED_METERS_PER_TICK = 3;
const GPS_DEADZONE = 2;

let pitch = 0;
let roll = 0;
let lat = 44.340974;
let lng = 10.829357;
const alt = 120;

let droneOnline = false;
let commandsTimer = null;
let gpsTimer = null;

client.on("connect", () => {
    console.log("Connesso a Mosquitto:", MQTT_URL);
});

client.on("error", (err) => {
    console.error("Errore MQTT:", err);
});

function publishCommands() {
    client.publish("drone/commands", JSON.stringify({
        thrust: THRUST_FIXED,
        roll,
        pitch,
        yaw: 0
    }));
}

function stepGps() {
    const deadzone = GPS_DEADZONE;
    const angleOk = Math.abs(pitch) >= deadzone || Math.abs(roll) >= deadzone;

    if (angleOk) {

        const forwardComponent = -Math.tan(pitch * Math.PI / 180);
        const rightComponent = Math.tan(roll * Math.PI / 180);

        const bearingRad = Math.atan2(rightComponent, forwardComponent);
        let bearingDeg = bearingRad * 180 / Math.PI;
        if (bearingDeg < 0) bearingDeg += 360;

        const nuovoPunto = computeDestinationPoint(
            { latitude: lat, longitude: lng },
            GPS_SPEED_METERS_PER_TICK,
            bearingDeg
        );

        lat = nuovoPunto.latitude;
        lng = nuovoPunto.longitude;
    }

    client.publish("drone/gps", JSON.stringify({
        lat, lng, alt, sat: 8, hdop: 1.2
    }));
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

app.post("/api/joystick", (req, res) => {
    const { pitch: p, roll: r } = req.body;

    pitch = clamp(Number(p) || 0, -MAX_ANGLE, MAX_ANGLE);
    roll = clamp(Number(r) || 0, -MAX_ANGLE, MAX_ANGLE);

    res.json({ pitch, roll });
});

app.post("/api/connect", (req, res) => {
    if (droneOnline) return res.json({ ok: true, alreadyOnline: true });

    droneOnline = true;

    client.publish("drone/status", JSON.stringify({ online: true }), { retain: true });
    client.publish("drone/gps_status", JSON.stringify({ value: 1 }), { retain: true });

    commandsTimer = setInterval(publishCommands, COMMANDS_INTERVAL_MS);
    gpsTimer = setInterval(stepGps, GPS_INTERVAL_MS);

    res.json({ ok: true });
});

app.post("/api/disconnect", (req, res) => {
    droneOnline = false;
    pitch = 0;
    roll = 0;

    client.publish("drone/status", JSON.stringify({ online: false }), { retain: true });

    clearInterval(commandsTimer);
    clearInterval(gpsTimer);

    res.json({ ok: true });
});

app.get("/api/state", (req, res) => {
    res.json({ pitch, roll, lat, lng, thrust: THRUST_FIXED, droneOnline });
});

app.listen(PORT, () => {
    console.log(`Fake drone HTTP server in ascolto su http://localhost:${PORT}`);
});