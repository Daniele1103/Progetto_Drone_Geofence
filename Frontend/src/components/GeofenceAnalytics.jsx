import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import Style from "ol/style/Style";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import CircleStyle from "ol/style/Circle";
import { fromLonLat } from "ol/proj";
import SlotCard from "./SlotCard";
import GeofenceStatsCard from "./GeofenceStatsCard";

const geofenceStyle = new Style({
    stroke: new Stroke({ color: "rgba(0,123,255,0.9)", width: 2 }),
    fill: new Fill({ color: "rgba(0,123,255,0.1)" }),
});

const geofenceSelectedStyle = new Style({
    stroke: new Stroke({ color: "rgba(0,194,255,1)", width: 2.5 }),
    fill: new Fill({ color: "rgba(0,194,255,0.15)" }),
});

const makeTempPointStyle = () => new Style({
    image: new CircleStyle({
        radius: 5,
        fill: new Fill({ color: "rgba(255,115,0,0.85)" }),
        stroke: new Stroke({ color: "#fff", width: 1 }),
    }),
});

const makeHumPointStyle = () => new Style({
    image: new CircleStyle({
        radius: 5,
        fill: new Fill({ color: "rgba(0,194,255,0.85)" }),
        stroke: new Stroke({ color: "#fff", width: 1 }),
    }),
});

const GeofenceAnalytics = () => {

    const mapElement = useRef();
    const mapRef = useRef(null);
    const geofenceSource = useRef(new VectorSource());
    const pointsSource = useRef(new VectorSource());

    const [slots, setSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [geofenceData, setGeofenceData] = useState([]);
    const [allGeofences, setAllGeofences] = useState([]);
    const [selectedGfId, setSelectedGfId] = useState(null);

    const [loadingSlots, setLoadingSlots] = useState(true);
    const [loadingData, setLoadingData] = useState(false);

    useEffect(() => {
        mapRef.current = new Map({
            target: mapElement.current,
            layers: [
                new TileLayer({ source: new OSM() }),
                new VectorLayer({ source: geofenceSource.current, style: geofenceStyle }),
                new VectorLayer({ source: pointsSource.current }),
            ],
            view: new View({
                center: fromLonLat([10.8354, 44.3335]),
                zoom: 16,
            }),
        });
        setTimeout(() => mapRef.current?.updateSize(), 200);
        return () => mapRef.current?.setTarget(null);
    }, []);

    useEffect(() => {
        axios.get("http://localhost:3000/sensors/tripsDate")
            .then((res) => {
                setSlots(res.data)
            })
            .catch((err) => {
                console.error("Errore:", err)
            })
            .finally(() => {
                setLoadingSlots(false)
            });
    }, []);

    useEffect(() => {
        axios.get("http://localhost:3000/geofences")
            .then((res) => {
                const data = res.data;
                setAllGeofences(data);
                geofenceSource.current.clear();
                data.forEach(addFeatureToMap);
            })
            .catch((err) => {
                console.error("Errore:", err)
            });
    }, []);

    const addFeatureToMap = (item) => {
        const geometry = JSON.parse(item.geometry);

        const coords = geometry.coordinates[0].map(c => fromLonLat(c));

        const polygon = new Polygon([coords]);

        const feature = new Feature({
            geometry: polygon,
        });

        feature.set('id', item.id);

        geofenceSource.current.addFeature(feature);
    };

    const handleSlotClick = (slot) => {
        if (selectedSlot === slot) return;
        setSelectedSlot(slot);
        setSelectedGfId(null);
        pointsSource.current.clear();
        resetGeofenceStyles();
        setLoadingData(true);

        axios.get("http://localhost:3000/sensors/dateByGeofence", {
            params: {
                start: new Date(slot.start).toISOString(),
                end: new Date(slot.end).toISOString(),
            }
        })
            .then((res) => {
                setGeofenceData(res.data)
            })
            .catch((err) => {
                console.error("Errore:", err)
            })
            .finally(() => {
                setLoadingData(false)
            });
    };

    const handleGeofenceClick = (gfId) => {
        if (selectedGfId === gfId) {
            // deseleziona
            setSelectedGfId(null);
            pointsSource.current.clear();
            resetGeofenceStyles();
            return;
        }

        setSelectedGfId(gfId);

        // evidenzia il poligono selezionato
        geofenceSource.current.getFeatures().forEach(f => {
            f.setStyle(f.get("id") === gfId ? geofenceSelectedStyle : geofenceStyle);
        });

        // zoom sul geofence selezionato
        const feature = geofenceSource.current.getFeatures().find(f => f.get("id") === gfId);
        if (feature && mapRef.current) {
            const extent = feature.getGeometry().getExtent();
            mapRef.current.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 700, maxZoom: 18 });
        }

        // disegna i punti del geofence selezionato
        pointsSource.current.clear();
        const gfEntry = geofenceData.find(g => g.id === gfId);
        if (!gfEntry) return;

        gfEntry.temperature.forEach(p => {
            const f = new Feature({ geometry: new Point(fromLonLat([p.lng, p.lat])) });
            f.setStyle(makeTempPointStyle());
            pointsSource.current.addFeature(f);
        });

        gfEntry.humidity.forEach(p => {
            const f = new Feature({ geometry: new Point(fromLonLat([p.lng, p.lat])) });
            f.setStyle(makeHumPointStyle());
            pointsSource.current.addFeature(f);
        });
    };

    const resetGeofenceStyles = () => {
        geofenceSource.current.getFeatures().forEach(f => f.setStyle(geofenceStyle));
    };

    return (
        <div
            className="d-flex bg-dark text-light"
            style={{ height: "calc(100vh - 57px)", overflow: "hidden" }}
        >

            {/* ── COLONNA SINISTRA: fasce orarie ───────────────────────────── */}
            <div
                className="border-end border-secondary d-flex flex-column"
                style={{ width: 260, background: "#111", flexShrink: 0 }}
            >
                <div className="p-3 border-bottom border-secondary">
                    <h5 className="mb-0">Fasce orarie</h5>
                </div>

                <div style={{ overflowY: "auto", flex: 1 }}>
                    {loadingSlots && (
                        <div className="p-3 text-secondary small">
                            <span className="spinner-border spinner-border-sm me-2" />
                            Caricamento...
                        </div>
                    )}

                    {!loadingSlots && slots.length === 0 && (
                        <div className="p-3 text-secondary small">Nessuna fascia disponibile.</div>
                    )}

                    {slots.map((slot, i) => (
                        <SlotCard
                            key={i}
                            slot={slot}
                            isActive={selectedSlot === slot}
                            onClick={() => handleSlotClick(slot)}
                        />
                    ))}
                </div>
            </div>

            {/* ── CENTRO: mappa ────────────────────────────────────────────── */}
            <div className="flex-grow-1 p-3 d-flex flex-column" style={{ minWidth: 0 }}>
                <h4 className="mb-2">Mappa Interattiva</h4>
                <div
                    ref={mapElement}
                    className="border border-secondary rounded flex-grow-1"
                    style={{ minHeight: 0 }}
                />

                {/* legenda punti */}
                {selectedGfId && (
                    <div className="d-flex gap-3 mt-2" style={{ fontSize: "0.75rem" }}>
                        <span>
                            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "rgba(255,115,0,0.85)", marginRight: 4 }} />
                            Temperatura
                        </span>
                        <span>
                            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "rgba(0,194,255,0.85)", marginRight: 4 }} />
                            Umidità
                        </span>
                    </div>
                )}
            </div>

            {/* ── COLONNA DESTRA: geofence ─────────────────────────────────── */}
            <div
                className="border-start border-secondary d-flex flex-column"
                style={{ width: 280, background: "#111", flexShrink: 0 }}
            >
                <div className="p-3 border-bottom border-secondary">
                    <h5 className="mb-0">Geofence</h5>
                    {loadingData && <span className="spinner-border spinner-border-sm ms-2" />}
                </div>

                <div style={{ overflowY: "auto", flex: 1 }}>

                    {!selectedSlot && (
                        <div className="p-3 text-secondary small">
                            Seleziona una fascia oraria.
                        </div>
                    )}

                    {selectedSlot && !loadingData && geofenceData.length === 0 && (
                        <div className="p-3 text-secondary small">
                            Nessun dato per questa fascia.
                        </div>
                    )}

                    {geofenceData.map(gf => (
                        <GeofenceStatsCard
                            key={gf.id}
                            geofence={gf}
                            isSelected={selectedGfId === gf.id}
                            onClick={() => handleGeofenceClick(gf.id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GeofenceAnalytics;
