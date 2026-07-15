import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import axios from "axios";

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';

import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';

import { fromLonLat } from 'ol/proj';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';

const DroneDashboard = () => {

    const mapElement = useRef(null);
    const mapRef = useRef(null);
    const firstGpsRef = useRef(true);

    const [geofences, setGeofences] = useState([]);
    const geofenceSourceRef = useRef(new VectorSource());

    const droneSourceRef = useRef(new VectorSource());
    const droneFeatureRef = useRef(null);

    const wsRef = useRef(null);

    const [serverConnected, setServerConnected] = useState(false);
    const [droneConnected, setDroneConnected] = useState(false);

    const [battery, setBattery] = useState(0);

    const [temperatureData, setTemperatureData] = useState([]);
    const [humidityData, setHumidityData] = useState([]);

    const logContainerRef = useRef(null);
    const [logs, setLogs] = useState([]);

    // per tentitivi riconessione al server
    const [isRetrying, setIsRetrying] = useState(false);

    const [activeGeofences, setActiveGeofences] = useState([]);
    const lastGpsRef = useRef(null);

    const geofenceStyle = new Style({
        stroke: new Stroke({
            color: 'rgba(0, 123, 255, 0.5)',
            width: 1.5,
            lineDash: [6, 6]
        }),
        fill: new Fill({
            color: 'rgba(0, 123, 255, 0.07)',
        }),
    });

    // useffect per scrollare sempre l'ultimo emssaggio log
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    useEffect(() => {
        connect();
        return () => {
            disconnect();
        };
    }, []);

    useEffect(() => {
        const features = geofenceSourceRef.current.getFeatures();

        features.forEach(feature => {
            const id = feature.get("id");
            const isActive = activeGeofences.some(g => g.id === id);

            feature.setStyle(
                isActive
                    ? new Style({
                        stroke: new Stroke({
                            color: 'rgba(40, 167, 69, 0.9)',  // #28a745
                            width: 2.5,
                            lineDash: [6, 6]
                        }),
                        fill: new Fill({
                            color: 'rgba(40, 167, 69, 0.25)', // #28a745 con trasparenza
                        }),
                    })
                    : null // null = torna allo stile di default del layer
            );
        });
    }, [activeGeofences, geofences]);

    useEffect(() => {
        axios.get("http://localhost:3000/geofences")
            .then((res) => {
                const data = res.data;
                //console.log(res.data)

                setGeofences(data);
                geofenceSourceRef.current.clear();
                data.forEach(addFeatureToMap);
            })
            .catch((err) => {
                console.error("Errore fetch geofences:", err);
            });
    }, []);

    useEffect(() => {
        if (!droneConnected) return;

        // evita doppie inita
        if (mapRef.current) return;

        mapRef.current = new Map({
            target: mapElement.current,
            layers: [
                new TileLayer({
                    source: new OSM(),
                }),
                new VectorLayer({
                    source: droneSourceRef.current,
                }),
                // geofence salvati
                new VectorLayer({
                    source: geofenceSourceRef.current,
                    style: geofenceStyle
                }),
            ],
            view: new View({
                center: fromLonLat([10.8354, 44.3335]),
                zoom: 15,
            }),
        });

        setTimeout(() => {
            mapRef.current?.updateSize();
        }, 200);

        return () => {
            if (mapRef.current) {
                mapRef.current.setTarget(null);
                mapRef.current = null;
            }
        };
    }, [droneConnected]);

    const connect = () => {
        if (wsRef.current) return;

        const ws = new WebSocket("ws://localhost:3001");

        ws.onopen = () => {
            setServerConnected(true);
            setLogs(prev => [
                ...prev,
                {
                    time: new Date().toLocaleTimeString(),
                    msg: "Connessione al server riuscita"
                }
            ]);
        };

        ws.onclose = () => {
            setServerConnected(false);
            setDroneConnected(false);
            wsRef.current = null;
            setBattery(0);
            setHumidityData([]);
            setTemperatureData([]);
            setLogs([]);
            setActiveGeofences([]);
        };

        ws.onerror = () => {
            setServerConnected(false);
            setDroneConnected(false);
            setBattery(0);
            setHumidityData([]);
            setTemperatureData([]);
            setLogs([]);
            setActiveGeofences([]);
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case "server":
                    setServerConnected(data.connected);
                    setDroneConnected(data.droneOnline);
                    break;

                case "status":
                    console.log("PROVA: "+ data.online)
                    setDroneConnected(data.online);
                    setLogs(prev => [
                        ...prev,
                        {
                            time: new Date().toLocaleTimeString(),
                            msg: data.online
                                ? "Drone collegato"
                                : "Drone scollegato"
                        }
                    ].slice(-50));
                    break;

                case "gps": {
                    const coord = fromLonLat([data.lng, data.lat]);

                    lastGpsRef.current = coord;

                    // create marker
                    if (!droneFeatureRef.current) {
                        droneFeatureRef.current = new Feature({
                            geometry: new Point(coord),
                        });

                        droneFeatureRef.current.setStyle([
                            // glow esterno
                            new Style({
                                image: new CircleStyle({
                                    radius: 12,
                                    fill: new Fill({ color: 'rgba(220, 53, 69, 0.15)' }),
                                    stroke: new Stroke({
                                        color: 'rgba(220, 53, 69, 0.4)',
                                        width: 1.5
                                    })
                                })
                            }),
                            // punto drone
                            new Style({
                                image: new CircleStyle({
                                    radius: 7,
                                    fill: new Fill({ color: '#dc3545' }),
                                    stroke: new Stroke({ color: '#ffffff', width: 2 })
                                })
                            })
                        ]);

                        droneSourceRef.current.addFeature(droneFeatureRef.current);
                    } else {
                        droneFeatureRef.current.getGeometry().setCoordinates(coord);
                    }

                    // SOLO LA PRIMA VOLTA
                    if (!mapRef.current) return;
                    if (firstGpsRef.current) {
                        mapRef.current.getView().animate({
                            center: coord,
                            zoom: 17,
                            duration: 800
                        });
                        firstGpsRef.current = false;
                    }
                    break;
                }

                case "geofence_snapshot":
                    setActiveGeofences(data.zones);
                    //console.log(data.zones)
                    setLogs(prev => [
                        ...prev,
                        {
                            time: new Date().toLocaleTimeString(),
                            msg: `Snapshot geofence: dentro ${data.zones.length} zone`
                        }
                    ].slice(-50));
                    break;

                case "geofence_enter":
                    //console.log("entratoooo, ", data)
                    setLogs(prev => [
                        ...prev,
                        {
                            time: new Date().toLocaleTimeString(),
                            msg: `ENTRATO in geofence: ${data.zone.name}`
                        }
                    ].slice(-50));

                    setActiveGeofences(prev => {
                        if (prev.some(g => g.id === data.zone.id)) return prev;
                        return [...prev, data.zone];
                    });
                    break;

                case "geofence_exit":
                    //console.log("uscitoooo, ", data)
                    setLogs(prev => [
                        ...prev,
                        {
                            time: new Date().toLocaleTimeString(),
                            msg: `USCITO da geofence: ${data.zone.name}`
                        }
                    ].slice(-50));

                    setActiveGeofences(prev =>
                        prev.filter(g => g.id !== data.zone.id)
                    );
                    break;

                case "temperature":
                    setTemperatureData(prev =>
                        [
                            ...prev,
                            {
                                time: new Date().toLocaleTimeString(),
                                value: data.value
                            }
                        ].slice(-30)
                    );
                    break;

                case "humidity":
                    setHumidityData(prev =>
                        [
                            ...prev,
                            {
                                time: new Date().toLocaleTimeString(),
                                value: data.value
                            }
                        ].slice(-30)
                    );
                    break;

                case "battery":
                    setBattery(data.value);
                    break;

                default:
                    break;
            }
        };

        wsRef.current = ws;
    };

    const disconnect = () => {
        wsRef.current?.close();
        wsRef.current = null;

        setServerConnected(false);
        setDroneConnected(false);

        droneSourceRef.current.clear();
        droneFeatureRef.current = null;

        setBattery(0);
        setHumidityData([]);
        setTemperatureData([]);
        setLogs([]);
        setActiveGeofences([]);
    };

    const retryConnection = () => {
        setIsRetrying(true);
        disconnect();
        setTimeout(() => {
            connect();
            setIsRetrying(false);
        }, 500);
    };

    const centerOnDrone = () => {
        if (!mapRef.current || !lastGpsRef.current) return;

        mapRef.current.getView().animate({
            center: lastGpsRef.current,
            zoom: 17,
            duration: 600
        });
    };

    const addFeatureToMap = (item) => {
        const geometry = JSON.parse(item.geometry);
        const coords = geometry.coordinates[0].map(c => fromLonLat(c));
        const polygon = new Polygon([coords]);
        const feature = new Feature({ geometry: polygon });

        feature.set("id", item.id);
        feature.set("name", item.name);

        geofenceSourceRef.current.addFeature(feature);

        //console.log(savedSourceRef.current.getFeatures())
    };

    return (
        <div
            className="bg-dark text-light"
            style={{ height: 'calc(100vh - 57px)' }}
        >

            {/* SERVER OFFLINE */}
            {!serverConnected && (
                <div className="h-100 d-flex align-items-center justify-content-center">
                    <div className="text-center">
                        <h1 className="mb-4">DRONE DASHBOARD</h1>

                        <p className={`fs-3 ${isRetrying ? "text-warning" : "text-danger"}`}>
                            {isRetrying ? "" : "Server non connesso"}
                        </p>

                        <div className="d-flex justify-content-center">
                            <Button
                                variant="warning"
                                onClick={retryConnection}
                                disabled={isRetrying}
                                className="d-flex align-items-center gap-2"
                            >
                                {isRetrying && (
                                    <span className="spinner-border spinner-border-sm" />
                                )}
                                RIPROVA CONNESSIONE
                            </Button>
                        </div>

                        <div className="mt-3 small text-secondary">
                            {isRetrying
                                ? "Connessione in corso..."
                                : "In attesa di connessione al server"}
                        </div>
                    </div>
                </div>
            )}

            {/* SERVER ONLINE / DRONE OFFLINE */}
            {serverConnected && !droneConnected && (
                <div className="h-100 d-flex align-items-center justify-content-center">
                    <div className="text-center">
                        <h1 className="mb-4">DRONE DASHBOARD</h1>

                        <p className="fs-3 text-success">Server connesso</p>

                        <p className={`fs-5 ${isRetrying ? "text-warning" : "text-warning"}`}>
                            {isRetrying ? "" : "Attesa connessione drone..."}
                        </p>

                        <div className="d-flex justify-content-center">
                            <Button
                                variant="warning"
                                onClick={retryConnection}
                                disabled={isRetrying}
                                className="d-flex align-items-center gap-2"
                            >
                                {isRetrying && (
                                    <span className="spinner-border spinner-border-sm" />
                                )}
                                RIPROVA CONNESSIONE
                            </Button>
                        </div>

                        <div className="mt-3 small text-secondary">
                            {isRetrying
                                ? "Riconnessione in corso..."
                                : "Il drone non è ancora raggiungibile"}
                        </div>
                    </div>
                </div>
            )}

            {/* DRONE ONLINE */}
            {serverConnected && droneConnected && (
                <div className="d-flex h-100">

                    <div
                        className="border-end border-secondary p-3"
                        style={{ width: 260, background: '#111' }}
                    >
                        <h4 className="mb-4">DRONE STATUS</h4>

                        <div
                            className="border border-secondary rounded p-3"
                            style={{ background: '#1a1a1a' }}
                        >
                            <div className="text-secondary small mb-2">Batteria</div>

                            <div className="fw-bold mb-3" style={{ fontSize: 42 }}>
                                {battery}%
                            </div>

                            <div style={{ height: 12, background: '#333', borderRadius: 10, overflow: 'hidden' }}>
                                <div
                                    style={{
                                        width: `${battery}%`,
                                        height: '100%',
                                        background:
                                            battery > 60
                                                ? '#28a745'
                                                : battery > 30
                                                    ? '#ffc107'
                                                    : '#dc3545',
                                        transition: '0.3s'
                                    }}
                                />
                            </div>
                        </div>

                        <Button
                            variant="primary"
                            onClick={centerOnDrone}
                            className="mt-2 w-100"
                        >
                            Centra Drone
                        </Button>

                        <div className="mt-3">
                            <div className="text-secondary small mb-2">Geofence attivi</div>

                            {activeGeofences.length === 0 ? (
                                <div className="text-secondary small">Nessuna zona attiva</div>
                            ) : (
                                activeGeofences.map(gf => (
                                    <div
                                        key={gf.id}
                                        className="d-flex align-items-center justify-content-between text-light small mb-1"
                                        style={{ background: '#222', padding: '6px 8px', borderRadius: 6 }}
                                    >
                                        <span>{gf.name}</span>
                                        <span style={{ color: '#28a745' }}>●</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex-grow-1 p-3 d-flex flex-column">

                        <div className="d-flex gap-3" style={{ height: '65%' }}>

                            <div className="flex-grow-1 border border-secondary rounded overflow-hidden">
                                <div ref={mapElement} style={{ height: '100%', width: '100%' }} />
                            </div>

                            <div className="d-flex flex-column gap-3" style={{ width: 420 }}>

                                <div
                                    className="border border-secondary rounded p-3"
                                    style={{ background: '#111', height: '50%' }}
                                >
                                    <h5>Temperatura</h5>
                                    <ResponsiveContainer width="100%" height="85%">
                                        <LineChart data={temperatureData}>
                                            <CartesianGrid stroke="#333" />
                                            <XAxis dataKey="time" tick={{ fill: '#aaa', fontSize: 10 }} />
                                            <YAxis unit="°C" tick={{ fill: '#aaa', fontSize: 10 }} />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="value" stroke="#ff7300" strokeWidth={3} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                <div
                                    className="border border-secondary rounded p-3"
                                    style={{ background: '#111', height: '50%' }}
                                >
                                    <h5>Umidità</h5>
                                    <ResponsiveContainer width="100%" height="85%">
                                        <LineChart data={humidityData}>
                                            <CartesianGrid stroke="#333" />
                                            <XAxis dataKey="time" tick={{ fill: '#aaa', fontSize: 10 }} />
                                            <YAxis unit="%" tick={{ fill: '#aaa', fontSize: 10 }} />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="value" stroke="#00c2ff" strokeWidth={3} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                            </div>

                        </div>

                        <div
                            className="border border-secondary rounded mt-3 d-flex flex-column"
                            style={{ background: '#111', height: '35%', minHeight: 0, overflow: 'hidden' }}
                        >
                            <div className="p-3 border-bottom border-secondary">
                                <h5 className="mb-0">LOG</h5>
                            </div>

                            <div
                                ref={logContainerRef}
                                className="p-3 flex-grow-1"
                                style={{ overflowY: 'auto', minHeight: 0 }}
                            >
                                {logs.map((l, i) => (
                                    <div key={i} className="small text-secondary mb-1">
                                        [{l.time}] {l.msg}
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                </div>
            )}
        </div>
    );
};

export default DroneDashboard;