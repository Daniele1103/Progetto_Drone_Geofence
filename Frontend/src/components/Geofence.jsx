import React, { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';

//quando uso gli oggetti OL questi iniettano, dentro al contenitore target che gli passo, i canvas e altri tag html e scaricano le immagini e i dati da inserirci dal server (in questo caso OpenStreetMap) e inoltre hanno bisogno del file .css di OL per visualizzare bene quello che viene iniettato

const Geofence = () => {
    // Riferimento all'elemento DOM dove verrà renderizzata la mappa
    const mapElement = useRef();
    const mapRef = useRef();

    useEffect(() => {
        // Inizializzazione della mappa
        const initialMap = new Map({
            target: mapElement.current,
            layers: [
                new TileLayer({
                    source: new OSM(), // Layer base di OpenStreetMap
                }),
            ],
            view: new View({
                center: fromLonLat([12.5674, 41.8719]), // Coordinate [Long, Lat] dell'Italia
                zoom: 6,
            }),
        });

        mapRef.current = initialMap;

        // Cleanup: distrugge la mappa quando il componente viene smontato
        return () => initialMap.setTarget(null);
    }, []);

    return (
        <div className="geofence-container">
            <h3 className="mb-3">Mappa Interattiva</h3>
            <div
                ref={mapElement}
                style={{
                    height: '500px',
                    width: '100%',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid #ccc'
                }}
            />
            <p className="text-muted mt-2">
                Trascina per spostarti, usa la rotella per lo zoom.
            </p>
        </div>
    );
};

export default Geofence;