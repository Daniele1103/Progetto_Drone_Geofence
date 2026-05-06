//quando uso gli oggetti OL questi iniettano, dentro al contenitore target che gli passo, i canvas e altri tag html e scaricano le immagini e i dati da inserirci dal server (in questo caso OpenStreetMap) e inoltre hanno bisogno del file .css di OL per visualizzare bene quello che viene iniettato
import React, { useEffect, useRef, useState } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import initialGeojson from "../assets/Geojson.json"
import axios from "axios";
import GeofenceCard from "./GeofenceCard"
import './Geofence.css'

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
    const selectRef = useRef(null);     // diventerà l'oggetto select

    const [geofenceVisible, setGeofenceVisible] = useState(true);
    const [rightPanelOpen, setRightPanelOpen] = useState(false);
    const [geofenceName, setGeofenceName] = useState('');
    const [showNameInput, setShowNameInput] = useState(false);

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

        const select = new Select({
            layers: [map.getLayers().getArray()[1]], // solo layer geofence
            multi: true,
            style: selectStyle
        });

        // Si attiva quando seleziono un geofence oppure lo deseleziono quando clicco altro
        select.on('select', (e) => {
            const feature = e.selected[0];

            if (!feature) return;

            const extent = feature.getGeometry().getExtent();

            mapRef.current.getView().fit(extent, {
                duration: 800,
                padding: [80, 80, 80, 80],
                maxZoom: 17
            });
            console.log("Selezionate:", e.selected);

        });

        map.addInteraction(select);

        selectRef.current = select;     // mi serve per usare il select quando clicco la card geofence e settare il select 

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

                // reset UI
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
                    // rimuovi dalla mappa
                    savedSourceRef.current.removeFeature(feature);

                    // rimuovi dallo stato React
                    setGeofences(prev => prev.filter(g => g.id !== featureId));

                    console.log(res.data.message);
                })
                .catch(err => {
                    console.error("Errore delete geofence:", err);
                });
        });

        // deseleziono le feature selezionate
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

        // 2. aggiorni OpenLayers
        // selectRef è l’istanza di Select di OpenLayers (l’interazione che gestisce la selezione sulla mappa)
        //
        // Internamente Select mantiene una "collection" di feature selezionate (getFeatures()).
        // Quando l’utente clicca sulla mappa, OpenLayers fa hit detection (trova le feature sotto il click)
        // e aggiorna automaticamente questa collection (aggiungendo o sostituendo le feature selezionate),
        // attivando anche l’evento "select".
        //
        // Quando invece faccio:
        // selectRef.current.getFeatures().push(feature)
        //
        // sto forzando manualmente la selezione della feature, simulando il comportamento del click,
        // cioè aggiungendola alla lista delle feature selezionate e facendo scattare lo style di selezione.

        const collection = selectRef.current.getFeatures();         // ottengo tutte le feature selezionate, collection è una lista di oggetti Feature

        collection.clear();        // deseleziona altri
        collection.push(feature);  // seleziona questo

        // 3. zoom (più “largo”, simile alla vista iniziale)
        const extent = feature.getGeometry().getExtent();

        // espande l'extent per zoom meno ravvicinato
        const buffer = 200; // metri circa (dipende dal CRS della mappa)
        const expandedExtent = [
            extent[0] - buffer,
            extent[1] - buffer,
            extent[2] + buffer,
            extent[3] + buffer,
        ];

        mapRef.current.getView().fit(expandedExtent, {
            duration: 800,
            padding: [80, 80, 80, 80],
            maxZoom: 17 // evita zoom troppo vicino
        });

        console.log("Selezionate: ", collection.getArray())
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

                <Button variant="outline-light" className="w-100 mb-2">
                    Visualizza Temperatura
                </Button>

                <Button variant="outline-light" className="w-100 mb-2">
                    Visualizza Umidità
                </Button>
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
                    overflowY: 'auto',   // <-- aggiunto
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
                        />
                    ))}
                </div>
            </div>

        </div>
    );
};

export default Geofence;