CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE geofences (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    geom GEOMETRY(POLYGON, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX geofences_geom_idx
ON geofences
USING GIST (geom);

Con indice
usa una struttura tipo “albero spaziale”
scarta subito le zone lontane
controlla solo quelle rilevanti

Senza indice
Quando fai:
SELECT *
FROM geofences
WHERE ST_Contains(...);

Postgres:
controlla tutte le righe una per una
lentissimo con molti dati

