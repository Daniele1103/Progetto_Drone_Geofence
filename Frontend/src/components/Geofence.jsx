//quando uso gli oggetti OL questi iniettano, dentro al contenitore target che gli passo, i canvas e altri tag html e scaricano le immagini e i dati da inserirci dal server (in questo caso OpenStreetMap) e inoltre hanno bisogno del file .css di OL per visualizzare bene quello che viene iniettato
import React, { useEffect, useRef, useState } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import initialGeojson from "../assets/Geojson.json"
import axios from "axios";

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import { fromLonLat, toLonLat } from 'ol/proj';

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';

const Geofence = () => {
    const mapElement = useRef();    // Il div dove carico la mappa
    const mapRef = useRef();    // è l'oggetto map vero e proprio (la mappa è pesante, meglio non triggerare ad ogni rirender)

    // Contiene tutte le geometrie wrappate in feature
    const savedSourceRef = useRef(new VectorSource());      // In questo modo divido i geofence da quelli che sto disegnando così da evitare di dover cancellare ogni volta che diegno ilr esto per non aggiungere feature inutili al layer
    const drawSourceRef = useRef(new VectorSource());

    const [geofences, setGeofences] = useState([]);

    const [drawingPoints, setDrawingPoints] = useState([]); // solo per disegno attivo
    const [isDrawing, setIsDrawing] = useState(false);
    const isDrawingRef = useRef(false);     // Ne ho bisogno per evitare che non si modifichi lo stato interno al on.map a casua del useEffect che parte solo all'inizio


    const [geofenceVisible, setGeofenceVisible] = useState(true);

    useEffect(() => {
        axios.get("http://localhost:3000/geofences")
            .then((res) => {
                const data = res.data;
                //console.log(res.data)

                setGeofences(data);             // Setto i geofence nello stato per averli a portat di mano

                savedSourceRef.current.clear();         // Per evitare che react monti e smonti il componente all'inizio più volte e che duplichi i geofence disegnati

                data.forEach(addFeatureToMap);          // Disegno subito i geofence
            })
            .catch((err) => {
                console.error("Errore fetch geofences:", err);
            });
    }, []);

    useEffect(() => {
        isDrawingRef.current = isDrawing;
    }, [isDrawing]);

    useEffect(() => {
        //mappa con 2 layer, mappa base e layer per disegnare
        const map = new Map({
            target: mapElement.current,
            layers: [
                new TileLayer({
                    source: new OSM(),
                }),

                // geofence salvati
                new VectorLayer({
                    source: savedSourceRef.current,
                    style: savedStyle
                }),

                // draw temporaneo
                new VectorLayer({
                    source: drawSourceRef.current,
                    style: drawStyle
                })
            ],
            view: new View({
                center: fromLonLat([10.8354, 44.3335]),
                zoom: 16,
            }),
        });

        map.on('click', (evt) => {

            if (!isDrawingRef.current) return; // disegno attivo solo se premuto bottone

            const coord = toLonLat(evt.coordinate); // trasforma da metri in [lon, lat]

            setDrawingPoints(prev => {
                const updated = [...prev, coord];

                drawPolygon(updated);

                return updated;
            });
        });

        mapRef.current = map;

        return () => map.setTarget(null);
    }, []);

    // Disegna SOLO preview (non salva)
    const drawPolygon = (coords) => {

        drawSourceRef.current.clear(); // SOLO layer draw

        if (coords.length < 2) return;

        const olCoords = coords.map(c => fromLonLat(c));    // Trasforma da [lon, lat] in metri (OL li vuole in metri)

        if (coords.length > 2) {
            olCoords.push(olCoords[0]);
        }

        const polygon = new Polygon([olCoords]);

        const feature = new Feature({
            geometry: polygon,
        });

        drawSourceRef.current.addFeature(feature);      // Modifica la mappa ogni volta che modifico il layer
    };

    const addFeatureToMap = (item) => {
        const geometry = JSON.parse(item.geometry);

        const coords = geometry.coordinates[0].map(c => fromLonLat(c));

        const polygon = new Polygon([coords]);

        const feature = new Feature({
            geometry: polygon,
        });

        savedSourceRef.current.addFeature(feature);
    };

    // Salvataggio GeoJSON
    const saveGeofence = () => {

        if (drawingPoints.length < 3) {
            alert("Servono almeno 3 punti");
            return;
        }

        const polygonCoords = [...drawingPoints, drawingPoints[0]];

        const geofenceGeoJSON = {
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: [polygonCoords],
            },
            properties: {
                name: "Zona A"
            }
        };

        axios.post("http://localhost:3000/geofences", geofenceGeoJSON)
            .then((res) => {
                console.log("Salvato nel DB:", res.data);

                const data = res.data

                addFeatureToMap(data)

                setGeofences(prev => [
                    ...prev,
                    {
                        id: res.data.id,
                        name: res.data.name,
                        geometry: res.data.geometry
                    }
                ]);

                // reset UI
                setDrawingPoints([]);
                setIsDrawing(false);
                drawSourceRef.current.clear();
            })
            .catch((err) => {
                console.error("Errore salvataggio geofence:", err);
            });

        // debug
        //console.log(drawSourceRef.current.getFeatures())
        //console.log(savedSourceRef.current.getFeatures())
    };

    const deleteGeofence = () => {
        console.log("wowoow",geofences)
        setDrawingPoints([]);
        drawSourceRef.current.clear();
    };

    const savedStyle = new Style({
        stroke: new Stroke({
            color: 'rgba(0, 123, 255, 0.9)', // blu
            width: 2,
        }),
        fill: new Fill({
            color: 'rgba(0, 123, 255, 0.15)',
        }),
    });

    const drawStyle = new Style({
        stroke: new Stroke({
            color: 'rgba(255, 193, 7, 1)', // giallo/arancio
            width: 2,
            lineDash: [8, 6],
        }),
        fill: new Fill({
            color: 'rgba(255, 193, 7, 0.2)',
        }),
    });

    return (
        <div className={`d-flex min-vh-100 ${isDrawing ? 'bg-dark border border-3 border-warning' : 'bg-dark border border-3 border-primary'}`}>

            {/* SIDEBAR */}
            <div className="p-3 border-end border-secondary" style={{ width: '280px' }}>

                <h5 className="text-light mb-4">
                    STRUMENTI
                </h5>

                {/* TOGGLE LAYER GEOJSON */}
                <Button
                    variant={geofenceVisible ? "primary" : "outline-primary"}
                    className="w-100 mb-2"
                    onClick={() => {
                        const layer = mapRef.current.getLayers().getArray()[1]; // saved layer

                        const next = !geofenceVisible;

                        setGeofenceVisible(next);
                        layer.setVisible(next);
                        setDrawingPoints([]);
                        setIsDrawing(false);
                        drawSourceRef.current.clear();
                    }}
                >
                    {geofenceVisible ? "Nascondi Geofence" : "Visualizza Geofence"}
                </Button>

                {/* BOTTONI CONDIZIONALI */}
                {!isDrawing && geofenceVisible && (
                    <>
                        <Button
                            variant="outline-primary"
                            className="w-100 mb-2"
                            onClick={() => setIsDrawing(true)}
                        >
                            Aggiungi Geofence
                        </Button>

                        <Button
                            variant="outline-danger"
                            className="w-100 mb-2"
                            onClick={deleteGeofence}
                        >
                            Cancella Geofence
                        </Button>
                    </>
                )}

                {isDrawing && geofenceVisible && (
                    <>
                        <Button
                            variant="outline-warning"
                            className="w-100 mb-2"
                            onClick={saveGeofence}
                        >
                            Salva Geofence
                        </Button>

                        <Button
                            variant="outline-danger"
                            className="w-100 mb-2"
                            onClick={deleteGeofence}
                        >
                            Cancella
                        </Button>

                        <Button
                            variant="outline-light"
                            className="w-100 mb-2"
                            onClick={() => {
                                setIsDrawing(false);
                                setDrawingPoints([]);
                                drawSourceRef.current.clear();
                            }}
                        >
                            Esci
                        </Button>
                    </>
                )}

                <hr className="border-secondary" />

                {/* RADIO FUTURI */}
                <Button variant="outline-light" className="w-100 mb-2">
                    Visualizza Temperatura
                </Button>

                <Button variant="outline-light" className="w-100 mb-2">
                    Visualizza Umidità
                </Button>

            </div>

            {/* MAPPA */}
            <div className="flex-grow-1 p-2">

                <h3 className="mb-3 text-light">
                    Mappa Interattiva
                </h3>

                {/* MODALITÀ */}
                <div className="mt-2 text-center mb-3">
                    <span
                        className={`badge fs-6 px-3 py-2 ${isDrawing
                            ? 'border border-warning text-warning'
                            : 'border border-primary text-primary'
                            }`}
                    >
                        {isDrawing
                            ? 'MODALITÀ: DISEGNO GEOFENCE'
                            : geofenceVisible
                                ? 'MODALITÀ: VISUALIZZAZIONE GEOFENCE'
                                : '_'}
                    </span>
                </div>

                {/* MAPPA */}
                <div
                    ref={mapElement}
                    className="border border-secondary rounded shadow-sm"
                    style={{
                        height: '600px',
                        width: '100%',
                    }}
                />

            </div>
        </div>
    );
};

export default Geofence;