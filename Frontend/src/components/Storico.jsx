import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";

import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Style, Circle as CircleStyle, Fill, Stroke, RegularShape, Icon } from "ol/style";

import Feature from "ol/Feature";
import Point from "ol/geom/Point";

import { fromLonLat } from "ol/proj";

const gpsStyle = new Style({
    image: new CircleStyle({
        radius: 4,
        fill: new Fill({ color: "#3b82f6" }),
        stroke: new Stroke({ color: "#1d4ed8", width: 1 })
    })
});

const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
};

const lerpColor = (stops, t) => {
    // stops: array di { at: 0..1, color: "#rrggbb" }
    t = Math.max(0, Math.min(1, t));
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1].at) i++;
    const a = stops[i];
    const b = stops[i + 1];
    const localT = (t - a.at) / (b.at - a.at);
    const [r1, g1, b1] = hexToRgb(a.color);
    const [r2, g2, b2] = hexToRgb(b.color);
    const r = Math.round(r1 + (r2 - r1) * localT);
    const g = Math.round(g1 + (g2 - g1) * localT);
    const bl = Math.round(b1 + (b2 - b1) * localT);
    return `rgb(${r},${g},${bl})`;
};

// ─── scala temperatura: 15°C (blu) → 25°C (verde) → 35°C (giallo) → 45°C (rosso) ──

const TEMP_MIN = 15;
const TEMP_MAX = 45;

const TEMP_STOPS = [
    { at: 0.0, color: "#3b82f6" }, // blu freddo
    { at: 0.33, color: "#22c55e" }, // verde
    { at: 0.66, color: "#eab308" }, // giallo
    { at: 1.0, color: "#ef4444" }  // rosso caldo
];

// ─── scala umidità: 30% (giallo secco) → 60% (azzurro) → 100% (blu saturo) ──

const HUM_MIN = 30;
const HUM_MAX = 100;

const HUM_STOPS = [
    { at: 0.0, color: "#fbbf24" }, // giallo secco
    { at: 0.5, color: "#06b6d4" }, // azzurro
    { at: 1.0, color: "#1d4ed8" }  // blu saturo
];

// ─── canvas per disegnare cerchio con glow (temperatura) ─────────────────────

const makeTempCanvas = (color) => {
    const size = 28;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    const cx = size / 2;

    // alone esterno
    const gradient = ctx.createRadialGradient(cx, cx, 2, cx, cx, cx);
    gradient.addColorStop(0, color.replace("rgb", "rgba").replace(")", ",0.5)"));
    gradient.addColorStop(1, color.replace("rgb", "rgba").replace(")", ",0)"));
    ctx.beginPath();
    ctx.arc(cx, cx, cx, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // cerchio centrale
    ctx.beginPath();
    ctx.arc(cx, cx, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    return c;
};

// ─── canvas per disegnare goccia (umidità) ───────────────────────────────────

const makeHumCanvas = (color) => {
    const w = 18;
    const h = 24;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    const cx = w / 2;

    ctx.beginPath();
    ctx.moveTo(cx, 2);                          // punta in alto
    ctx.bezierCurveTo(cx + 9, 10, cx + 9, 18, cx, 22); // destra
    ctx.bezierCurveTo(cx - 9, 18, cx - 9, 10, cx, 2);  // sinistra
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // riflesso
    ctx.beginPath();
    ctx.ellipse(cx - 2, 10, 2, 4, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fill();

    return c;
};

const makeTempStyle = (value) => {
    const t = (value - TEMP_MIN) / (TEMP_MAX - TEMP_MIN);
    const color = lerpColor(TEMP_STOPS, t);
    const canvas = makeTempCanvas(color);
    return new Style({
        image: new Icon({ img: canvas, size: [canvas.width, canvas.height] })
    });
};

const makeHumStyle = (value) => {
    const t = (value - HUM_MIN) / (HUM_MAX - HUM_MIN);
    const color = lerpColor(HUM_STOPS, t);
    const canvas = makeHumCanvas(color);
    return new Style({
        image: new Icon({ img: canvas, size: [canvas.width, canvas.height] })
    });
};

const toLocalDatetimeLocal = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const getDefaultRange = () => ({
    start: "1970-01-01T00:00",
    end: toLocalDatetimeLocal(new Date())
});

const GradientLegend = ({ stops, min, max, unit, label }) => {
    const gradient = `linear-gradient(to right, ${stops.map(s => `${s.color} ${s.at * 100}%`).join(", ")})`;
    return (
        <div className="mb-3">
            <div className="text-secondary small mb-1">{label}</div>
            <div style={{ height: 10, borderRadius: 4, background: gradient, border: "1px solid rgba(255,255,255,0.1)" }} />
            <div className="d-flex justify-content-between mt-1" style={{ fontSize: "0.7rem", color: "#9ca3af" }}>
                <span>{min}{unit}</span>
                <span>{Math.round((min + max) / 2)}{unit}</span>
                <span>{max}{unit}</span>
            </div>
        </div>
    );
};

const Storico = () => {
    const mapRef = useRef(null);
    const mapElement = useRef();

    const gpsSource = useRef(new VectorSource());
    const tempSource = useRef(new VectorSource());
    const humSource = useRef(new VectorSource());

    const [start, setStart] = useState("1970-01-01T00:00");
    const [end, setEnd] = useState(toLocalDatetimeLocal(new Date()));

    const [gpsData, setGpsData] = useState([]);
    const [tempData, setTempData] = useState([]);
    const [humData, setHumData] = useState([]);

    const [showGps, setShowGps] = useState(true);
    const [showTemp, setShowTemp] = useState(false);
    const [showHum, setShowHum] = useState(false);

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);


    useEffect(() => {

        const map = new Map({
            target: mapElement.current,
            layers: [
                new TileLayer({ source: new OSM() }),
                new VectorLayer({
                    source: gpsSource.current, style: gpsStyle
                }),
                new VectorLayer({
                    source: tempSource.current
                }),
                new VectorLayer({
                    source: humSource.current
                })
            ],
            view: new View({
                center: fromLonLat([10.8354, 44.3335]),
                zoom: 16
            })
        });

        mapRef.current = map;
        //fetchData();
        return () => mapRef.current.setTarget(null);

    }, []);


    const fetchData = () => {
        if (!start || !end) {
            setError("Seleziona un intervallo di date prima di procedere.");
            return;
        }

        setError("");
        setLoading(true);

        const params = {
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString()
        };

        Promise.all([
            axios.get("http://localhost:3000/sensors/gps", { params }),
            axios.get("http://localhost:3000/sensors/temperature", { params }),
            axios.get("http://localhost:3000/sensors/humidity", { params })
        ])
            .then(([gps, temp, hum]) => {
                setGpsData(gps.data);
                setTempData(temp.data);
                setHumData(hum.data);
            })
            .catch((err) => {
                console.error("Errore fetch storico:", err);
                setError("Errore nel caricamento dei dati.");
            })
            .finally(() => setLoading(false));
    };


    useEffect(() => {

        gpsSource.current.clear();
        tempSource.current.clear();
        humSource.current.clear();

        gpsData.forEach(p => {
            gpsSource.current.addFeature(
                new Feature({ geometry: new Point(fromLonLat([p.lng, p.lat])) })
            );
        });

        tempData.forEach(p => {
            const f = new Feature({ geometry: new Point(fromLonLat([p.lng, p.lat])) });
            f.setStyle(makeTempStyle(p.value));
            tempSource.current.addFeature(f);
        });

        humData.forEach(p => {
            const f = new Feature({ geometry: new Point(fromLonLat([p.lng, p.lat])) });
            f.setStyle(makeHumStyle(p.value));
            humSource.current.addFeature(f);
        });

    }, [gpsData, tempData, humData]);


    useEffect(() => {

        if (!mapRef.current) return;

        const layers = mapRef.current.getLayers().getArray();

        layers[1].setVisible(showGps);
        layers[2].setVisible(showTemp);
        layers[3].setVisible(showHum);

    }, [showGps, showTemp, showHum]);


    const showAll = () => {
        const allStart = "1970-01-01T00:00";
        const allEnd = toLocalDatetimeLocal(new Date());
        setStart(allStart);
        setEnd(allEnd);
    };


    return (
        <div className="d-flex bg-dark text-light" style={{ height: "100vh" }}>

            {/* SIDEBAR */}
            <div className="p-3 border-end border-secondary d-flex flex-column" style={{ width: 300, overflowY: "auto" }}>

                <h5 className="mb-3">STORICO</h5>

                <label className="text-secondary small">Start</label>
                <input
                    type="datetime-local"
                    className="form-control mb-2 bg-dark text-light"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                />

                <label className="text-secondary small">End</label>
                <input
                    type="datetime-local"
                    className="form-control mb-3 bg-dark text-light"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                />

                {error && (
                    <div className="alert alert-danger py-1 px-2 mb-2" style={{ fontSize: "0.85rem" }}>
                        {error}
                    </div>
                )}

                <button
                    className="btn btn-outline-light w-100 mb-2"
                    onClick={() => fetchData()}
                    disabled={loading}
                >
                    {loading
                        ? <><span className="spinner-border spinner-border-sm me-2" role="status" />Caricamento...</>
                        : "Applica"
                    }
                </button>

                <button
                    className="btn btn-outline-warning w-100 mb-3"
                    onClick={showAll}
                    disabled={loading}
                >
                    Mostra tutto lo storico
                </button>

                <hr className="border-secondary" />

                {/* TOGGLE LAYER */}
                <div className="d-flex flex-column gap-2 mb-3">

                    <button
                        className={`btn w-100 d-flex align-items-center gap-2 ${showGps ? "btn-primary" : "btn-outline-primary"}`}
                        onClick={() => setShowGps(v => !v)}
                    >
                        <span style={{
                            display: "inline-block", width: 10, height: 10,
                            borderRadius: "50%", background: "#3b82f6",
                            border: "2px solid #1d4ed8", flexShrink: 0
                        }} />
                        GPS
                        <span className="ms-auto badge bg-primary bg-opacity-50">{gpsData.length}</span>
                    </button>

                    <button
                        className={`btn w-100 d-flex align-items-center gap-2 ${showTemp ? "btn-warning" : "btn-outline-warning"}`}
                        onClick={() => setShowTemp(v => !v)}
                    >
                        <span style={{
                            display: "inline-block", width: 12, height: 12,
                            borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #ef4444)",
                            flexShrink: 0
                        }} />
                        Temperatura
                        <span className="ms-auto badge bg-warning bg-opacity-50 text-dark">{tempData.length}</span>
                    </button>

                    <button
                        className={`btn w-100 d-flex align-items-center gap-2 ${showHum ? "btn-info" : "btn-outline-info"}`}
                        onClick={() => setShowHum(v => !v)}
                    >
                        <span style={{
                            display: "inline-block", width: 10, height: 13,
                            background: "linear-gradient(to bottom, #fbbf24, #1d4ed8)",
                            clipPath: "polygon(50% 0%, 100% 60%, 80% 100%, 20% 100%, 0% 60%)",
                            flexShrink: 0
                        }} />
                        Umidità
                        <span className="ms-auto badge bg-info bg-opacity-50 text-dark">{humData.length}</span>
                    </button>

                </div>

                <hr className="border-secondary" />

                {/* LEGENDA SCALE */}
                <GradientLegend
                    stops={TEMP_STOPS}
                    min={TEMP_MIN}
                    max={TEMP_MAX}
                    unit="°C"
                    label="Scala temperatura"
                />

                <GradientLegend
                    stops={HUM_STOPS}
                    min={HUM_MIN}
                    max={HUM_MAX}
                    unit="%"
                    label="Scala umidità"
                />

            </div>

            {/* MAPPA */}
            <div className="flex-grow-1 p-2 d-flex flex-column">
                <h4 className="mb-2">Storico Drone</h4>

                <div
                    ref={mapElement}
                    className="border border-secondary rounded flex-grow-1"
                />
            </div>

        </div>
    );
};

export default Storico;