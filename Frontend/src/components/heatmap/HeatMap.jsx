import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import chroma from "chroma-js";

import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import HeatmapLayer from "ol/layer/Heatmap";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat } from "ol/proj";

import GradientLegend from "../analytics/GradientLegend";

const GPS_SCALE = chroma.scale(['#00007f', '#0000ff', '#0080ff', '#00ffff', '#00ff80', '#00ff00', '#80ff00', '#ffff00', '#ff8000', '#ff0000', '#7f0000']);

const toLocalDatetimeLocal = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const HeatMap = () => {

    const mapRef = useRef(null);
    const mapElement = useRef();
    const gpsSource = useRef(new VectorSource());
    const gpsLayer = useRef(null);

    const [start, setStart] = useState("1970-01-01T00:00");
    const [end, setEnd] = useState(toLocalDatetimeLocal(new Date()));
    const [gpsCount, setGpsCount] = useState(0);
    const [showGps, setShowGps] = useState(true);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        gpsLayer.current = new HeatmapLayer({
            source: gpsSource.current,
            blur: 20,
            radius: 12,
            gradient: GPS_SCALE.colors(11),
            visible: true,
        });

        mapRef.current = new Map({
            target: mapElement.current,
            layers: [
                new TileLayer({ source: new OSM() }),
                gpsLayer.current,
            ],
            view: new View({
                center: fromLonLat([10.8354, 44.3335]),
                zoom: 16,
            }),
        });

        return () => mapRef.current?.setTarget(null);
    }, []);

    useEffect(() => { gpsLayer.current?.setVisible(showGps); }, [showGps]);

    const fetchData = () => {
        if (!start || !end) {
            setError("Seleziona un intervallo di date prima di procedere.");
            return;
        }

        setError("");
        setLoading(true);

        const params = {
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
        };

        axios.get("http://localhost:3000/sensors/gps", { params })
            .then(res => {
                gpsSource.current.clear();
                res.data.forEach(p => {
                    gpsSource.current.addFeature(
                        new Feature({ geometry: new Point(fromLonLat([p.lng, p.lat])) })
                    );
                });
                setGpsCount(res.data.length);
            })
            .catch(err => {
                console.error("Errore fetch storico:", err);
                setError("Errore nel caricamento dei dati.");
            })
            .finally(() => setLoading(false));
    };

    const showAll = () => {
        setStart("1970-01-01T00:00");
        setEnd(toLocalDatetimeLocal(new Date()));
    };

    return (
        <div className="d-flex bg-dark text-light" style={{ height: "calc(100vh - 57px)" }}>

            <div
                className="p-3 border-end border-secondary d-flex flex-column"
                style={{ width: 300, overflowY: "auto", background: "#111" }}
            >
                <h5 className="mb-3">Seleziona Data</h5>

                <div
                    className="mb-3 rounded"
                    style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", overflow: "hidden" }}
                >
                    <div style={{ padding: "10px 12px", borderBottom: "1px solid #2a2a2a" }}>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                            <span style={{ fontSize: "0.7rem", color: "#6b7280", letterSpacing: 1, textTransform: "uppercase" }}>Da</span>
                        </div>
                        <input
                            type="datetime-local"
                            value={start}
                            onChange={e => setStart(e.target.value)}
                            style={{
                                background: "transparent", border: "none", outline: "none",
                                color: "#f3f4f6", fontSize: "0.9rem", width: "100%", colorScheme: "dark",
                            }}
                        />
                    </div>
                    <div style={{ padding: "10px 12px" }}>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
                            <span style={{ fontSize: "0.7rem", color: "#6b7280", letterSpacing: 1, textTransform: "uppercase" }}>A</span>
                        </div>
                        <input
                            type="datetime-local"
                            value={end}
                            onChange={e => setEnd(e.target.value)}
                            style={{
                                background: "transparent", border: "none", outline: "none",
                                color: "#f3f4f6", fontSize: "0.9rem", width: "100%", colorScheme: "dark",
                            }}
                        />
                    </div>
                </div>

                {error && (
                    <div className="alert alert-danger py-1 px-2 mb-2" style={{ fontSize: "0.85rem" }}>
                        {error}
                    </div>
                )}

                <button
                    className="btn btn-outline-light w-100 mb-2"
                    onClick={fetchData}
                    disabled={loading}
                >
                    {loading
                        ? <><span className="spinner-border spinner-border-sm me-2" />Caricamento...</>
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

                <div className="d-flex flex-column gap-2 mb-3">
                    <button
                        className={`btn w-100 d-flex align-items-center gap-2 ${showGps ? "btn-primary" : "btn-outline-primary"}`}
                        onClick={() => setShowGps(v => !v)}
                    >
                        <span style={{
                            width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                            background: "linear-gradient(135deg, #0000ff, #ff0000)"
                        }} />
                        GPS
                        <span className="ms-auto badge bg-primary bg-opacity-50">{gpsCount}</span>
                    </button>
                </div>

                <hr className="border-secondary" />

                <GradientLegend
                    gradient={GPS_SCALE.colors(11)}
                    min="bassa" max="alta"
                    unit="" label="Densità GPS"
                />

            </div>

            <div className="flex-grow-1 p-2 d-flex flex-column">
                <h4 className="mb-2">HeatMap GPS</h4>
                <div
                    ref={mapElement}
                    className="border border-secondary rounded flex-grow-1"
                />
            </div>

        </div>
    );
};

export default HeatMap;