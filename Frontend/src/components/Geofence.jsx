//quando uso gli oggetti OL questi iniettano, dentro al contenitore target che gli passo, i canvas e altri tag html e scaricano le immagini e i dati da inserirci dal server (in questo caso OpenStreetMap) e inoltre hanno bisogno del file .css di OL per visualizzare bene quello che viene iniettato
import React, { useEffect, useRef, useState } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import initialGeojson from "../assets/Geojson.json"

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
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
    const isDrawingRef = useRef(false);

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
                }),

                // draw temporaneo
                new VectorLayer({
                    source: drawSourceRef.current,
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

        drawSourceRef.current.clear(); // 👈 SOLO layer draw

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

    return (
        <div>
            <h3>Mappa Interattiva</h3>

            <div
                ref={mapElement}
                style={{
                    height: '500px',
                    width: '100%',
                    border: '1px solid #ccc'
                }}
            />

            <div className="mt-2 d-flex justify-content-center">
                <ButtonGroup className="gap-2">

                    <Button
                        variant="dark"
                        onClick={() => setIsDrawing(true)}
                    >
                        Aggiungi Geofence
                    </Button>

                    <Button
                        variant="dark"
                        onClick={saveGeofence}
                    >
                        Salva Geofence
                    </Button>

                    <Button
                        variant="danger"
                        onClick={deleteGeofence}
                    >
                        Cancella Geofence
                    </Button>

                </ButtonGroup>
            </div>

        </div>
    );
};

export default Geofence;