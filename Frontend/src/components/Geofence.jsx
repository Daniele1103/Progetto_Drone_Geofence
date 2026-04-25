//quando uso gli oggetti OL questi iniettano, dentro al contenitore target che gli passo, i canvas e altri tag html e scaricano le immagini e i dati da inserirci dal server (in questo caso OpenStreetMap) e inoltre hanno bisogno del file .css di OL per visualizzare bene quello che viene iniettato
import React, { useEffect, useRef, useState } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import initialGeojson from "../assets/Geojson.json"

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

    const [geojson, setGeojson] = useState([]);

    const [drawingPoints, setDrawingPoints] = useState([]); // solo per disegno attivo
    const [isDrawing, setIsDrawing] = useState(false);
    const isDrawingRef = useRef(false);     // Ne ho bisogno per evitare che non si modifichi lo stato interno al on.map a casua del useEffect che parte solo all'inizio

    useEffect(() => {
        savedSourceRef.current.clear();     // Per evitare che react monti e smonti il componente all'inizio più volte e che duplichi i geofence disegnati
        initialGeojson.forEach(addFeatureToMap);
        setGeojson(initialGeojson);
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
        const coords = item.geometry.coordinates[0].map(c => fromLonLat(c));

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

        const olCoords = polygonCoords.map(c => fromLonLat(c));

        const polygon = new Polygon([olCoords]);

        const feature = new Feature({
            geometry: polygon,
        });

        // aggiungi al layer persistente
        savedSourceRef.current.addFeature(feature);

        setGeojson(prev => [...prev, {
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: [polygonCoords],
            },
        }]);

        setDrawingPoints([]);
        setIsDrawing(false);

        // pulisci SOLO draw layer
        drawSourceRef.current.clear();

        // debug
        console.log(drawSourceRef.current.getFeatures())
        console.log(savedSourceRef.current.getFeatures())
    };

    const deleteGeofence = () => {
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
        <div className={`p-3 min-vh-100 m-2 rounded ${isDrawing ? 'bg-dark border border-3 border-warning' : 'bg-dark border border-3 border-primary'}`}>

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
                        : 'MODALITÀ: VISUALIZZAZIONE'}
                </span>
            </div>

            {/* MAPPA */}
            <div
                ref={mapElement}
                className="border border-secondary rounded shadow-sm mb-3"
                style={{
                    height: '500px',
                    width: '100%',
                }}
            />

            {/* BOTTONI */}
            <div className="d-flex justify-content-center">
                <ButtonGroup className="gap-2">

                    {/* ATTIVA SOLO SE NON STO DISEGNANDO */}
                    {!isDrawing && (
                        <Button
                            variant={"outline-primary"}
                            className="shadow-sm hover-shadow"
                            onClick={() => setIsDrawing(true)}
                        >
                            Aggiungi Geofence
                        </Button>
                    )}

                    {/* CANCELLA SEMPRE DISPONIBILE SOLO IN VIEW MODE */}
                    {!isDrawing && (
                        <Button
                            variant="outline-danger"
                            className="shadow-sm hover-shadow"
                            onClick={deleteGeofence}
                        >
                            Cancella Geofence
                        </Button>
                    )}

                    {/* MODALITÀ DRAW */}
                    {isDrawing && (
                        <>
                            <Button
                                variant="outline-warning"
                                className="shadow-sm hover-shadow"
                                onClick={saveGeofence}
                            >
                                Salva Geofence
                            </Button>

                            <Button
                                variant="outline-danger"
                                className="shadow-sm hover-shadow"
                                onClick={deleteGeofence}
                            >
                                Cancella
                            </Button>

                            <Button
                                variant="outline-light"
                                className="shadow-sm hover-fill"
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

                </ButtonGroup>
            </div>
        </div>
    );
};

export default Geofence;