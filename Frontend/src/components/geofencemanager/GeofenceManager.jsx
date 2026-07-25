import React, { useEffect, useRef, useState } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import initialGeojson from "../../assets/Geojson.json"
import axios from "axios";
import GeofenceCard from "./GeofenceCard"
import './GeofenceManager.css'

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Select from 'ol/interaction/Select';

import { fromLonLat, toLonLat } from 'ol/proj';

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';

const GeofenceManager = () => {
    const mapElement = useRef();    
    const mapRef = useRef();    

    const savedSourceRef = useRef(new VectorSource());      
    const drawSourceRef = useRef(new VectorSource());

    const [geofences, setGeofences] = useState([]);

    const [drawingPoints, setDrawingPoints] = useState([]); 
    const [isDrawing, setIsDrawing] = useState(false);

    const isDrawingRef = useRef(false);    
    const [selectedIds, setSelectedIds] = useState([]);

    const [geofenceVisible, setGeofenceVisible] = useState(true);
    const [rightPanelOpen, setRightPanelOpen] = useState(false);
    const [geofenceName, setGeofenceName] = useState('');
    const [showNameInput, setShowNameInput] = useState(false);

    useEffect(() => {
        axios.get("http://localhost:3000/geofences")
            .then((res) => {
                const data = res.data;
                //console.log(res.data)

                setGeofences(data);   
                savedSourceRef.current.clear();

                data.forEach(addFeatureToMap); 
            })
            .catch((err) => {
                console.error("Errore fetch geofences:", err);
            });
    }, []);

    useEffect(() => {
        isDrawingRef.current = isDrawing;
    }, [isDrawing]);

    useEffect(() => {
        const map = new Map({
            target: mapElement.current,
            layers: [
                new TileLayer({
                    source: new OSM(),
                }),
                new VectorLayer({
                    source: savedSourceRef.current,
                    style: savedStyle
                }),
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

        const select = new Select({
            layers: [map.getLayers().getArray()[1]],
            multi: true,
            style: selectStyle
        });

        // Si attiva quando seleziono un geofence oppure lo deseleziono quando clicco altro
        select.on('select', () => {

            const selectedFeatures = select
                .getFeatures()
                .getArray();

            const ids = selectedFeatures.map(f => f.get('id'));

            setSelectedIds(ids); 
            //console.log(ids)

            const feature = selectedFeatures[0];

            if (!feature) return;

            const extent = feature.getGeometry().getExtent();

            mapRef.current.getView().fit(extent, {
                duration: 800,
                padding: [80, 80, 80, 80],
                maxZoom: 17
            });
        });

        map.addInteraction(select);

        selectRef.current = select;

        map.on('click', (evt) => {

            if (!isDrawingRef.current) return; 

            const coord = toLonLat(evt.coordinate);

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

        drawSourceRef.current.clear(); 

        if (coords.length < 2) return;

        const olCoords = coords.map(c => fromLonLat(c));

        if (coords.length > 2) {
            olCoords.push(olCoords[0]);
        }

        const polygon = new Polygon([olCoords]);

        const feature = new Feature({
            geometry: polygon,
        });

        drawSourceRef.current.addFeature(feature);      
    };

    const addFeatureToMap = (item) => {
        const geometry = JSON.parse(item.geometry);

        const coords = geometry.coordinates[0].map(c => fromLonLat(c));

        const polygon = new Polygon([coords]);

        const feature = new Feature({
            geometry: polygon,
        });

        //console.log(item.id)
        feature.set('id', item.id);

        savedSourceRef.current.addFeature(feature);

        //console.log(savedSourceRef.current.getFeatures())
    };

    // Salvataggio GeoJSON
    const saveGeofence = (name = 'Zona senza nome') => {
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
                name: name
            }
        };

        axios.post("http://localhost:3000/geofences", geofenceGeoJSON)
            .then((res) => {
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

                setDrawingPoints([]);
                setIsDrawing(false);
                drawSourceRef.current.clear();

                console.log("Salvato nel DB:", res.data);

            })
            .catch((err) => {
                console.error("Errore salvataggio geofence:", err);
            });

        // debug
        //console.log(drawSourceRef.current.getFeatures())
        //console.log(savedSourceRef.current.getFeatures())
    };

    const deleteGeofence = (id = null) => {
        let featuresToDelete = [];

        console.log(id)
        if (id) {
            // caso: delete da card
            const feature = savedSourceRef.current
                .getFeatures()
                .find(f => f.get('id') === id);

            if (!feature) return;

            featuresToDelete = [feature];

        } else {
            // caso: delete da selezione mappa (OpenLayers)
            featuresToDelete = selectRef.current
                .getFeatures()
                .getArray();

            if (!featuresToDelete.length) return;
        }

        featuresToDelete.forEach((feature) => {
            const featureId = feature.get('id');

            axios.delete(`http://localhost:3000/geofences/${featureId}`)
                .then((res) => {

                    savedSourceRef.current.removeFeature(feature);

                    setGeofences(prev => prev.filter(g => g.id !== featureId));

                    setSelectedIds([])

                    console.log(res.data.message);
                })
                .catch(err => {
                    console.error("Errore delete geofence:", err);
                });
        });


        if (selectRef.current) {
            selectRef.current.getFeatures().clear();
        }
    };

    const deleteDrawGeofence = () => {
        setDrawingPoints([]);
        drawSourceRef.current.clear();

    };

    const focusGeofence = (id) => {
        const feature = savedSourceRef.current
            .getFeatures()
            .find(f => f.get('id') === id);

        if (!feature) return;

        

        const collection = selectRef.current.getFeatures();         
        collection.clear();
        collection.push(feature);

        setSelectedIds([id]);

        const extent = feature.getGeometry().getExtent();

        // espande l'extent per zoom meno ravvicinato
        const buffer = 200;
        const expandedExtent = [
            extent[0] - buffer,
            extent[1] - buffer,
            extent[2] + buffer,
            extent[3] + buffer,
        ];

        mapRef.current.getView().fit(expandedExtent, {
            duration: 800,
            padding: [80, 80, 80, 80],
            maxZoom: 17
        });

        console.log("Selezionate: ", collection.getArray())
    };

    const savedStyle = new Style({
        stroke: new Stroke({
            color: 'rgba(0, 123, 255, 0.9)',
            width: 2,
        }),
        fill: new Fill({
            color: 'rgba(0, 123, 255, 0.15)',
        }),
    });

    const drawStyle = new Style({
        stroke: new Stroke({
            color: 'rgba(255, 193, 7, 1)',
            width: 2,
            lineDash: [8, 6],
        }),
        fill: new Fill({
            color: 'rgba(255, 193, 7, 0.2)',
        }),
    });

    const selectStyle = new Style({
        stroke: new Stroke({
            color: 'red',
            width: 3,
        }),
        fill: new Fill({
            color: 'rgba(255, 0, 0, 0.2)',
        }),
    });

    return (
        <div className="d-flex bg-dark position-relative" style={{ overflow: 'hidden', height: 'calc(100vh - 57px)' }}> {/* scorciatoia per rendere il container grande come tutta la pagina contando la grandezza della navbar, così da avere tutto in una sola pagina*/}

            {/* TOGGLE SIDEBAR DESTRA */}
            {geofenceVisible && (
                <button
                    onClick={() => setRightPanelOpen(prev => !prev)}
                    className="btn btn-outline-light"
                    style={{
                        position: 'absolute',
                        right: 10,
                        top: 20,
                        zIndex: 1000,
                        marginRight: '10px'
                    }}
                >
                    ☰
                </button>
            )}

            {/* OVERLAY */}
            <div
                onClick={() => setRightPanelOpen(false)}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.3)',
                    zIndex: 998,
                    opacity: rightPanelOpen ? 1 : 0,
                    pointerEvents: rightPanelOpen ? 'auto' : 'none',
                    transition: 'opacity 0.35s ease',
                }}
            />

            {/* SIDEBAR SINISTRA */}
            <div
                className="p-3 border-end border-secondary"
                style={{ width: '280px', zIndex: 2 }}
            >
                <h5 className="text-light mb-4">STRUMENTI</h5>

                {/* TOGGLE GEOFENCE */}
                <Button
                    variant={geofenceVisible ? "primary" : "outline-primary"}
                    className="w-100 mb-2"
                    onClick={() => {
                        const layer = mapRef.current.getLayers().getArray()[1];
                        const next = !geofenceVisible;
                        setGeofenceVisible(next);
                        layer.setVisible(next);
                        setDrawingPoints([]);
                        setIsDrawing(false);
                        setShowNameInput(false);
                        setGeofenceName('');
                        drawSourceRef.current.clear();
                    }}
                >
                    {geofenceVisible ? "Nascondi Geofence" : "Visualizza Geofence"}
                </Button>

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
                            onClick={() => deleteGeofence()}
                        >
                            Cancella selezionati
                        </Button>
                    </>
                )}

                {isDrawing && geofenceVisible && (
                    <>
                        {!showNameInput ? (
                            <Button
                                variant="outline-warning"
                                className="w-100 mb-2"
                                onClick={() => {
                                    if (drawingPoints.length < 3) {
                                        alert("Servono almeno 3 punti");
                                        return;
                                    }
                                    setShowNameInput(true);
                                }}
                            >
                                Salva Geofence
                            </Button>
                        ) : (
                            <div
                                className="mb-2 p-2 rounded"
                                style={{
                                    background: 'rgba(255,193,7,0.08)',
                                    border: '1px solid rgba(255,193,7,0.4)',
                                }}
                            >
                                <label className="text-warning mb-1" style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                                    NOME GEOFENCE
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Es. Zona magazzino..."
                                    value={geofenceName}
                                    onChange={(e) => setGeofenceName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            if (!geofenceName.trim()) {
                                                alert("Inserisci un nome per il geofence");
                                                return;
                                            }
                                            saveGeofence(geofenceName.trim());
                                            setGeofenceName('');
                                            setShowNameInput(false);
                                        }
                                        if (e.key === 'Escape') {
                                            setShowNameInput(false);
                                            setGeofenceName('');
                                        }
                                    }}
                                    className="form-control form-control-sm bg-dark text-light border-0 mb-2"
                                    style={{
                                        outline: 'none',
                                        boxShadow: '0 0 0 2px rgba(255,193,7,0.5)',
                                        borderRadius: '4px',
                                    }}
                                />
                                <div className="d-flex gap-1">
                                    <Button
                                        variant="warning"
                                        size="sm"
                                        className="flex-grow-1 fw-semibold"
                                        onClick={() => {
                                            if (!geofenceName.trim()) {
                                                alert("Inserisci un nome per il geofence");
                                                return;
                                            }
                                            saveGeofence(geofenceName.trim());
                                            setGeofenceName('');
                                            setShowNameInput(false);
                                        }}
                                    >
                                        ✓ Conferma
                                    </Button>
                                    <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        onClick={() => {
                                            setShowNameInput(false);
                                            setGeofenceName('');
                                        }}
                                    >
                                        ✕
                                    </Button>
                                </div>
                            </div>
                        )}

                        <Button
                            variant="outline-danger"
                            className="w-100 mb-2"
                            onClick={() => {
                                setDrawingPoints([]);
                                drawSourceRef.current.clear();
                            }}
                        >
                            Cancella disegno
                        </Button>

                        <Button
                            variant="outline-light"
                            className="w-100 mb-2"
                            onClick={() => {
                                setIsDrawing(false);
                                setDrawingPoints([]);
                                setShowNameInput(false);
                                setGeofenceName('');
                                drawSourceRef.current.clear();
                            }}
                        >
                            Esci
                        </Button>
                    </>
                )}

                <hr className="border-secondary" />

            </div>

            {/* MAPPA */}
            <div className="flex-grow-1 p-2 position-relative">
                <h3 className="mb-3 text-light">Mappa Interattiva</h3>

                <div className="text-center mb-3">
                    <span
                        className={`badge fs-6 px-3 py-2 ${isDrawing
                            ? 'border border-warning text-warning'
                            : 'border border-primary text-primary'
                            }`}
                    >
                        {isDrawing
                            ? 'MODALITÀ: DISEGNO'
                            : geofenceVisible
                                ? 'MODALITÀ: VISUALIZZAZIONE'
                                : 'MAPPA VUOTA'}
                    </span>
                </div>

                <div
                    ref={mapElement}
                    className="border border-secondary rounded shadow-sm"
                    style={{ height: '80%', width: '100%' }}
                />
            </div>

            {/* SIDEBAR DESTRA (DRAWER) */}
            <div
                className="p-3 border-start border-secondary"
                style={{
                    width: '300px',
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    height: '100%',
                    background: '#111',
                    zIndex: 999,
                    transform: rightPanelOpen ? 'translateX(0%)' : 'translateX(100%)',
                    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                    willChange: 'transform',
                    overflowY: 'auto',
                }}
            >
                <div style={{ marginTop: '20px' }}>
                    <h5 className="text-light mb-3">Geofences</h5>

                    {geofences.length === 0 && (
                        <p className="text-secondary">Nessun geofence</p>
                    )}

                    {geofences.map((g) => (
                        <GeofenceCard
                            key={g.id}
                            geofence={g}
                            onSelect={() => focusGeofence(g.id)}
                            onDelete={() => deleteGeofence(g.id)}
                            iSselected={selectedIds.includes(g.id)}       // se la carat di quel geofnce è selezionata o no
                        />
                    ))}
                </div>
            </div>

        </div>
    );
};

export default GeofenceManager;