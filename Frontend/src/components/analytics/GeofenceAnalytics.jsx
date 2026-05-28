import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import chroma from "chroma-js";

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
import Select from 'ol/interaction/Select';

import SlotCard from "./SlotCard";
import GeofenceStatsCard from "./GeofenceStatsCard";
import GradientLegend from "./GradientLegend";

const geofenceStyle = new Style({
    stroke: new Stroke({ color: "rgba(0,123,255,0.9)", width: 2 }),
    fill: new Fill({ color: "rgba(0,123,255,0.1)" }),
});

const geofenceSelectedStyle = new Style({
    stroke: new Stroke({ color: "rgba(0,194,255,1)", width: 2.5 }),
    fill: new Fill({ color: "rgba(0,194,255,0.15)" }),
});

const tempScale = chroma.scale(["blue", "cyan", "green", "yellow", "red"]).domain([-10, 50]);
const humScale = chroma.scale(["green", "blue"]).domain([0, 100]);


const makeTempPointStyle = (value) => new Style({
    image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: tempScale(value).css() }),
        stroke: new Stroke({ color: "rgba(255,255,255,0.6)", width: 1 }),
    }),
});

const makeHumPointStyle = (value) => new Style({
    image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: humScale(value).css() }),
        stroke: new Stroke({ color: "rgba(255,255,255,0.6)", width: 1 }),
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
    const geofenceDataRef = useRef(null);

    const [selectedGfId, setSelectedGfId] = useState(null);
    const selectRef = useRef(null);

    const [loadingSlots, setLoadingSlots] = useState(true);
    const [loadingData, setLoadingData] = useState(false);

    const [activeLayer, setActiveLayer] = useState("temperature");
    const activeLayerRef = useRef("temperature");

    useEffect(() => {
        mapRef.current = new Map({
            target: mapElement.current,
            layers: [
                new TileLayer({
                    source: new OSM()
                }),
                new VectorLayer({
                    source: geofenceSource.current, style: geofenceStyle
                }),
                new VectorLayer({
                    source: pointsSource.current
                }),
            ],
            view: new View({
                center: fromLonLat([10.8354, 44.3335]),
                zoom: 16,
            }),
        });

        const select = new Select({
            layers: [mapRef.current.getLayers().getArray()[1]],
            multi: true,
            style: geofenceSelectedStyle,
        });

        select.on('select', () => {
            pointsSource.current.clear();
            setSelectedGfId(null);

            const feature = select.getFeatures().getArray()[0];
            if (!feature) return;

            const id = feature.get('id');

            setSelectedGfId(id);

            zoomGeofenceSelected(id);
            drawPoints(id);
        });

        mapRef.current.addInteraction(select);

        selectRef.current = select;

        setTimeout(() => mapRef.current?.updateSize(), 200);
        return () => mapRef.current?.setTarget(null);
    }, []);

    useEffect(() => {
        if (selectRef.current) {
            if (selectedSlot) {
                selectRef.current.setActive(true);
            } else {
                selectRef.current.setActive(false);
            }
        }
    }, [selectedSlot]);

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
                geofenceSource.current.clear();
                res.data.forEach(addFeatureToMap);
            })
            .catch((err) => {
                console.error("Errore:", err)
            });
    }, []);

    const addFeatureToMap = (item) => {
        const geometry = JSON.parse(item.geometry);

        const coords = geometry.coordinates[0].map(c => fromLonLat(c));

        const feature = new Feature({ geometry: new Polygon([coords]) });

        feature.set('id', item.id);
        geofenceSource.current.addFeature(feature);
    };

    const handleSlotClick = (slot) => {
        if (selectedSlot === slot) return;
        setSelectedSlot(slot);
        setSelectedGfId(null);
        pointsSource.current.clear();
        selectRef.current.getFeatures().clear();
        setLoadingData(true);

        axios.get("http://localhost:3000/sensors/dateByGeofence", {
            params: {
                start: new Date(slot.start).toISOString(),
                end: new Date(slot.end).toISOString(),
            }
        })
            .then((res) => {
                setGeofenceData(res.data);
                geofenceDataRef.current = res.data;
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
            setSelectedGfId(null);
            pointsSource.current.clear();
            selectRef.current.getFeatures().clear();
            return;
        }

        selectGeofenceById(gfId);

        zoomGeofenceSelected(gfId);

        pointsSource.current.clear();
        drawPoints(gfId);
    };

    const handleLayerToggle = (layer) => {
        if (activeLayerRef.current === layer) return;
        activeLayerRef.current = layer;
        setActiveLayer(layer);

        if (selectedGfId) {
            pointsSource.current.clear();
            drawPoints(selectedGfId);
        }
    };

    // Mi serve solo per il metodo quando clicco la card, non per l'evento sulla mappa
    const selectGeofenceById = (gfId) => {
        if (!selectRef.current || !mapRef.current) return;

        const feature = geofenceSource.current.getFeatures().find(f => f.get("id") === gfId);
        if (!feature) return;

        setSelectedGfId(gfId);
        selectRef.current.getFeatures().clear();
        selectRef.current.getFeatures().push(feature);
    };

    const zoomGeofenceSelected = (gfId) => {
        const feature = geofenceSource.current.getFeatures().find(f => f.get("id") === gfId);
        if (!feature) return;

        mapRef.current.getView().fit(feature.getGeometry().getExtent(), {
            padding: [60, 60, 60, 60],
            duration: 700,
            maxZoom: 18,
        });
    };

    const drawPoints = (gfId) => {
        const gfEntry = geofenceDataRef.current.find(g => g.id === gfId);
        if (!gfEntry) return;

        const layer = activeLayerRef.current;

        if (layer === "temperature") {
            gfEntry.temperature.forEach(p => {
                const f = new Feature({ geometry: new Point(fromLonLat([p.lng, p.lat])) });
                f.setStyle(makeTempPointStyle(p.value));
                pointsSource.current.addFeature(f);
            });
        } else {
            gfEntry.humidity.forEach(p => {
                const f = new Feature({ geometry: new Point(fromLonLat([p.lng, p.lat])) });
                f.setStyle(makeHumPointStyle(p.value));
                pointsSource.current.addFeature(f);
            });
        }
    };

    return (
        <div
            className="d-flex bg-dark text-light"
            style={{ height: "calc(100vh - 57px)", overflow: "hidden" }}
        >
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

            <div className="flex-grow-1 p-3 d-flex flex-column" style={{ minWidth: 0 }}>
                <h4 className="mb-2">Mappa Interattiva</h4>
                <div
                    ref={mapElement}
                    className="border border-secondary rounded flex-grow-1"
                    style={{ minHeight: 0 }}
                />

                <div className="d-flex align-items-center gap-3 mt-2 flex-wrap">
                    <div className="btn-group btn-group-sm" role="group" aria-label="Seleziona layer">
                        <button
                            type="button"
                            className={`btn ${activeLayer === "temperature" ? "btn-warning" : "btn-outline-secondary"}`}
                            onClick={() => handleLayerToggle("temperature")}
                        >
                            Temperatura
                        </button>
                        <button
                            type="button"
                            className={`btn ${activeLayer === "humidity" ? "btn-info" : "btn-outline-secondary"}`}
                            onClick={() => handleLayerToggle("humidity")}
                        >
                            Umidità
                        </button>
                    </div>

                    <div style={{ width: "30%" }}>
                        <GradientLegend
                            gradient={activeLayer === "temperature" ? tempScale.colors(20) : humScale.colors(20)}
                            min={activeLayer === "temperature" ? -10 : 0}
                            max={activeLayer === "temperature" ? 50 : 100}
                            unit={activeLayer === "temperature" ? "°C" : "%"}
                            label={activeLayer === "temperature" ? "Temperatura" : "Umidità"}
                        />
                    </div>
                </div>

            </div>

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