// ---------------- CONFIG ----------------
const MAX_ANGLE = 30;          // gradi massimi pitch/roll (come nel firmware)
const JOYSTICK_POST_INTERVAL_MS = 150;  // frequenza invio pitch/roll al server
const STATE_POLL_INTERVAL_MS = 1000;    // frequenza lettura telemetria dal server

// stato corrente pitch/roll, aggiornato dal joystick
let pitch = 0;
let roll = 0;

let serverUrl = "http://localhost:4000";
let connected = false;
let joystickTimer = null;
let statePollTimer = null;

// ---------------- CANVAS JOYSTICK ----------------
const canvas = document.getElementById("pad");
const ctx = canvas.getContext("2d");

const CENTER = { x: canvas.width / 2, y: canvas.height / 2 };
const PAD_RADIUS = 110;
const KNOB_RADIUS = 22;

let knob = { x: CENTER.x, y: CENTER.y };
let dragging = false;

function drawPad() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, PAD_RADIUS + 8, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a1a";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, PAD_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(CENTER.x - PAD_RADIUS, CENTER.y);
    ctx.lineTo(CENTER.x + PAD_RADIUS, CENTER.y);
    ctx.moveTo(CENTER.x, CENTER.y - PAD_RADIUS);
    ctx.lineTo(CENTER.x, CENTER.y + PAD_RADIUS);
    ctx.strokeStyle = "#222";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(CENTER.x, CENTER.y);
    ctx.lineTo(knob.x, knob.y);
    ctx.strokeStyle = "rgba(255, 193, 7, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const isCentered = knob.x === CENTER.x && knob.y === CENTER.y;
    ctx.beginPath();
    ctx.arc(knob.x, knob.y, KNOB_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = isCentered ? "#dc3545" : "#ffc107";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
}

function setKnobFromPointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    let x = clientX - rect.left;
    let y = clientY - rect.top;

    const dx = x - CENTER.x;
    const dy = y - CENTER.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > PAD_RADIUS) {
        const ratio = PAD_RADIUS / dist;
        x = CENTER.x + dx * ratio;
        y = CENTER.y + dy * ratio;
    }

    knob.x = x;
    knob.y = y;

    updatePitchRollFromKnob();
    drawPad();
    updateTelemetryDisplay();
}

function resetKnob() {
    knob.x = CENTER.x;
    knob.y = CENTER.y;
    pitch = 0;
    roll = 0;
    drawPad();
    updateTelemetryDisplay();
}

function updatePitchRollFromKnob() {
    const dx = knob.x - CENTER.x;
    const dy = knob.y - CENTER.y;

    roll = (dx / PAD_RADIUS) * MAX_ANGLE;
    pitch = (dy / PAD_RADIUS) * MAX_ANGLE;

    roll = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, roll));
    pitch = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, pitch));
}

canvas.addEventListener("mousedown", (e) => {
    dragging = true;
    setKnobFromPointer(e.clientX, e.clientY);
});

window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    setKnobFromPointer(e.clientX, e.clientY);
});

window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    resetKnob(); // rilascio -> torna subito a 0
});

drawPad();

// ---------------- TELEMETRIA UI ----------------
let lastLat = null;
let lastLng = null;

function updateTelemetryDisplay() {
    document.getElementById("valPitch").textContent = pitch.toFixed(1) + "°";
    document.getElementById("valRoll").textContent = roll.toFixed(1) + "°";
    document.getElementById("valThrust").textContent = "6000";
    document.getElementById("valLat").textContent = lastLat !== null ? lastLat.toFixed(6) : "-";
    document.getElementById("valLng").textContent = lastLng !== null ? lastLng.toFixed(6) : "-";
}

// ---------------- HTTP verso il server Node ----------------
async function sendJoystick() {
    if (!connected) return;
    try {
        await axios.post(`${serverUrl}/api/joystick`, { pitch, roll });
    } catch (err) {
        console.error("Errore invio joystick:", err.message);
    }
}

async function pollState() {
    if (!connected) return;
    try {
        const res = await axios.get(`${serverUrl}/api/state`);
        lastLat = res.data.lat;
        lastLng = res.data.lng;
        updateTelemetryDisplay();
    } catch (err) {
        console.error("Errore lettura stato:", err.message);
    }
}

// ---------------- UI: bottoni connessione ----------------
const btnConnect = document.getElementById("btnConnect");
const btnOffline = document.getElementById("btnOffline");
const dotBroker = document.getElementById("dotBroker");
const brokerLabel = document.getElementById("brokerLabel");
const dotDrone = document.getElementById("dotDrone");
const droneLabel = document.getElementById("droneLabel");
const serverUrlInput = document.getElementById("serverUrl");

function setServerStatus(ok) {
    dotBroker.classList.toggle("on", ok);
    brokerLabel.textContent = ok ? "Server connesso" : "Server disconnesso";
}

function setDroneStatus(online) {
    dotDrone.classList.toggle("on", online);
    droneLabel.textContent = online ? "Drone online" : "Drone offline";
    btnOffline.disabled = !online;
}

btnConnect.addEventListener("click", async () => {
    serverUrl = serverUrlInput.value.trim();

    btnConnect.disabled = true;
    btnConnect.textContent = "Connessione...";

    try {
        await axios.post(`${serverUrl}/api/connect`);

        connected = true;
        setServerStatus(true);
        setDroneStatus(true);
        btnConnect.textContent = "Connesso";
        serverUrlInput.disabled = true;

        joystickTimer = setInterval(sendJoystick, JOYSTICK_POST_INTERVAL_MS);
        statePollTimer = setInterval(pollState, STATE_POLL_INTERVAL_MS);
    } catch (err) {
        console.error("Errore connessione al server:", err.message);
        setServerStatus(false);
        btnConnect.disabled = false;
        btnConnect.textContent = "Connetti";
    }
});

btnOffline.addEventListener("click", async () => {
    if (!connected) return;

    try {
        await axios.post(`${serverUrl}/api/disconnect`);
    } catch (err) {
        console.error("Errore disconnessione:", err.message);
    }

    connected = false;
    setDroneStatus(false);
    clearInterval(joystickTimer);
    clearInterval(statePollTimer);
});

updateTelemetryDisplay();
