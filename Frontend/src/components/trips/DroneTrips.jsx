import React, { useEffect, useRef, useState } from 'react';
import { Button, Badge } from 'react-bootstrap';
import axios from 'axios';
import TripCard from './TripCard';

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import { fromLonLat } from 'ol/proj';

const DroneTrips = () => {

    const mapElement = useRef(null);
    const mapRef = useRef(null);
    const droneSourceRef = useRef(new VectorSource());
    const pathSourceRef = useRef(new VectorSource());
    const droneFeatureRef = useRef(null);
    const pathFeatureRef = useRef(null);

    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedTrip, setSelectedTrip] = useState(null);

    const [playing, setPlaying] = useState(false);
    const [speedIdx, setSpeedIdx] = useState(2);
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef(null);

    useEffect(() => {
        axios.get('http://localhost:3000/sensors/trips')
            .then(res => {
                setTrips(res.data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    useEffect(() => {

        if (mapRef.current) return;

        mapRef.current = new Map({
            target: mapElement.current,
            layers: [
                new TileLayer({
                    source: new OSM()
                }),
                new VectorLayer({
                    source: pathSourceRef.current
                }),
                new VectorLayer({
                    source: droneSourceRef.current
                }),
            ],
            view: new View({
                center: fromLonLat([10.8354, 44.3335]),
                zoom: 15,
            }),
        });

        return () => {
            mapRef.current?.setTarget(null);
            mapRef.current = null;
        };

    }, []);

    // posiziono tutti i dati iniziali del trip nella mappa
    useEffect(() => {
        if (!selectedTrip) return;

        droneSourceRef.current.clear();
        pathSourceRef.current.clear();
        droneFeatureRef.current = null;
        pathFeatureRef.current = null;

        const allCoords = selectedTrip.points.map(p =>
            fromLonLat([p.lng, p.lat])
        );

        const ghostLine = new Feature({
            geometry: new LineString(allCoords)
        });

        const ghostStyle = new Style({
            stroke: new Stroke({
                color: 'rgba(0,194,255,0.18)',
                width: 2,
                lineDash: [6, 6]
            })
        });

        ghostLine.setStyle(ghostStyle);
        pathSourceRef.current.addFeature(ghostLine);

        const pathFeature = new Feature({
            geometry: new LineString([allCoords[0]])
        });

        pathFeature.setStyle(new Style({
            stroke: new Stroke({
                color: '#00c2ff',
                width: 2.5
            })
        }));

        pathSourceRef.current.addFeature(pathFeature);
        pathFeatureRef.current = pathFeature;

        const droneFeature = new Feature({
            geometry: new Point(allCoords[0])
        });

        droneFeature.setStyle(new Style({
            image: new CircleStyle({
                radius: 7,
                fill: new Fill({ color: '#dc3545' }),
                stroke: new Stroke({ color: '#fff', width: 2 })
            })
        }));

        droneSourceRef.current.addFeature(droneFeature);
        droneFeatureRef.current = droneFeature;

        const extent = ghostLine.getGeometry().getExtent();
        mapRef.current.getView().fit(extent, {
            padding: [40, 40, 40, 40],
            duration: 800
        });

        setProgress(0);
        setPlaying(false);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

    }, [selectedTrip]);

    // per muovere il punto drone e il path dietro di lui percorso
    useEffect(() => {

        if (!selectedTrip || !droneFeatureRef.current || !pathFeatureRef.current) return;

        const pts = selectedTrip.points;
        const coord = fromLonLat([
            pts[progress].lng,
            pts[progress].lat
        ]);

        droneFeatureRef.current.getGeometry().setCoordinates(coord);

        const traversed = pts
            .slice(0, progress + 1)
            .map(p => fromLonLat([p.lng, p.lat]));

        pathFeatureRef.current.getGeometry().setCoordinates(traversed);
    }, [progress, selectedTrip]);

    // per mandare avanti il tempo e modificare progress ad ogni intervallo
    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (!playing || !selectedTrip) return;
        const total = selectedTrip.points.length;
        const ms = SPEED_LEVELS[speedIdx].ms;
        intervalRef.current = setInterval(() => {

            setProgress(prev => {

                if (prev >= total - 1) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                    setPlaying(false);
                    return prev;
                }

                return prev + 1;
            });
        }, ms);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [playing, speedIdx, selectedTrip]);

    const handlePlayPause = () => {

        if (!selectedTrip) return;

        if (progress >= selectedTrip.points.length - 1) {
            setProgress(0);
            setPlaying(true);
        } else {
            setPlaying(p => !p);
        }
    };

    const handleStop = () => {
        setPlaying(false);
        setProgress(0);
    };

    const handleSelectTrip = (trip) => {
        // questo blocco serve per eliminare l'intervallo attivo, tanto per ricrearlo allo start dopo la pause mi basta avere salvato il progress e riavviarlo
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setSelectedTrip(trip);
    };

    const progressPct = selectedTrip
        ? Math.round((progress / (selectedTrip.points.length - 1)) * 100)
        : 0;

    const SPEED_LEVELS = [
        { label: '0.25×', ms: 400 },
        { label: '0.5×', ms: 200 },
        { label: '1×', ms: 100 },
        { label: '2×', ms: 50 },
        { label: '4×', ms: 25 },
        { label: '8×', ms: 12 },
    ];

    return (
        <div
            className="bg-dark text-light"
            style={{
                height: 'calc(100vh - 57px)',
                display: 'flex',
                flexDirection: 'column'
            }}
        >

            <div
                className="border-bottom border-secondary px-4 py-3 d-flex align-items-center gap-3"
                style={{ background: '#0d0d0d', flexShrink: 0 }}
            >
                <h4 className="mb-0">
                    STORICO VIAGGI
                </h4>

                {loading && (
                    <span className="spinner-border spinner-border-sm text-secondary ms-2" />
                )}

                {error && (
                    <span className="text-danger small">{error}</span>
                )}

                {!loading && !error && (
                    <Badge bg="secondary">
                        {trips.length} viaggi
                    </Badge>
                )}
            </div>

            <div className="d-flex flex-grow-1" style={{ minHeight: 0 }}>

                <div
                    className="border-end border-secondary d-flex flex-column"
                    style={{
                        width: 280,
                        background: '#111',
                        overflowY: 'auto'
                    }}
                >
                    {trips.map((trip, idx) => {
                        const isActive =
                            selectedTrip?.name === trip.name &&
                            selectedTrip?.start === trip.start;

                        return (
                            <TripCard
                                key={idx}
                                trip={trip}
                                isActive={isActive}
                                onClick={() => handleSelectTrip(trip)}
                            />
                        );
                    })}
                </div>

                <div className="flex-grow-1 d-flex flex-column p-3 gap-3">

                    <div
                        className="border border-secondary rounded overflow-hidden flex-grow-1"
                        style={{ minHeight: 0 }}
                    >
                        <div
                            ref={mapElement}
                            style={{ height: '100%', width: '100%' }}
                        />
                    </div>

                    {selectedTrip && (
                        <div
                            className="border border-secondary rounded p-3"
                            style={{ background: '#111' }}
                        >

                            <div className="d-flex justify-content-between mb-2">
                                <span className="fw-bold" style={{ color: '#00c2ff' }}>
                                    {selectedTrip.name}
                                </span>

                                <span className="text-secondary small">
                                    {progress + 1} / {selectedTrip.points.length}
                                </span>
                            </div>

                            <div
                                style={{
                                    height: 6,
                                    background: '#2a2a2a',
                                    borderRadius: 4,
                                    marginBottom: 12,
                                    cursor: 'pointer'
                                }}
                                onClick={e => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const pct = (e.clientX - rect.left) / rect.width;
                                    const newIdx = Math.round(
                                        pct * (selectedTrip.points.length - 1)
                                    );

                                    setProgress(
                                        Math.max(
                                            0,
                                            Math.min(newIdx, selectedTrip.points.length - 1)
                                        )
                                    );
                                }}
                            >
                                <div
                                    style={{
                                        width: `${progressPct}%`,
                                        height: '100%',
                                        background: '#00c2ff',
                                        borderRadius: 4
                                    }}
                                />
                            </div>

                            <div className="d-flex gap-2 flex-wrap">

                                <Button
                                    variant={playing ? 'warning' : 'success'}
                                    size="sm"
                                    onClick={handlePlayPause}
                                >
                                    {playing ? '⏸ PAUSA' : '▶ PLAY'}
                                </Button>

                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleStop}
                                >
                                    ■ STOP
                                </Button>

                                <div className="ms-auto d-flex align-items-center gap-2">

                                    <Button
                                        size="sm"
                                        variant="outline-secondary"
                                        onClick={() =>
                                            setSpeedIdx(i => Math.max(0, i - 1))
                                        }
                                        disabled={speedIdx === 0}
                                    >
                                        −
                                    </Button>

                                    <span style={{ color: '#00c2ff' }}>
                                        {SPEED_LEVELS[speedIdx].label}
                                    </span>

                                    <Button
                                        size="sm"
                                        variant="outline-secondary"
                                        onClick={() =>
                                            setSpeedIdx(i =>
                                                Math.min(SPEED_LEVELS.length - 1, i + 1)
                                            )
                                        }
                                        disabled={
                                            speedIdx === SPEED_LEVELS.length - 1
                                        }
                                    >
                                        +
                                    </Button>

                                </div>

                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DroneTrips;