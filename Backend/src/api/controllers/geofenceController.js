import pool from '../../postgis/dbpg.js';
import { computeDestinationPoint } from "geolib";

export const createGeofence = async (req, res) => {
    try {
        const feature = req.body;

        const name = feature.properties?.name || 'senza nome';
        const geometry = feature.geometry;

        const query = `
            INSERT INTO geofences (name, geom)
            VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))
            RETURNING id, name, ST_AsGeoJSON(geom) as geometry;
        `;

        const result = await pool.query(query, [
            name,
            JSON.stringify(geometry)
        ]);

        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore creazione geofence' });
    }
};

export const getGeofences = async (req, res) => {
    try {
        const query = `
            SELECT id, name, ST_AsGeoJSON(geom) as geometry
            FROM geofences;
        `;

        const result = await pool.query(query);

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore recupero geofence' });
    }
};

export const deleteGeofence = async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            DELETE FROM geofences
            WHERE id = $1
            RETURNING id;
        `;

        const result = await pool.query(query, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Geofence non trovato' });
        }

        res.json({
            message: 'Geofence eliminato con successo',
            id: result.rows[0].id
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Errore eliminazione geofence' });
    }
};

export async function checkGeofences(lng, lat) {
    const result = await pool.query(
        `
        SELECT id, name
        FROM geofences
        WHERE ST_Contains(
            geom,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)
        )
        `,
        [lng, lat]
    );

    return result.rows;
}


export async function checkGeofencesBulk(points) {

    if (points.length === 0) return [];

    const values = points
        .map((p, i) => `(${i}, ${p.lng}, ${p.lat})`)
        .join(", ");

    const result = await pool.query(`
        SELECT v.idx, g.id, g.name
        FROM (VALUES ${values}) AS v(idx, lng, lat)
        JOIN geofences g
        ON ST_Contains(
            g.geom,
            ST_SetSRID(ST_MakePoint(v.lng::float, v.lat::float), 4326)
        )
    `);

    return result.rows;
}

export function computePredictedPoints(gps, commands) {
    const isZeroCommand = commands.roll === 0 && commands.pitch === 0;
    if (!gps || !commands || isZeroCommand) return [];

    const pitch = commands.pitch;
    const roll = commands.roll;

    const deadzone = 2;
    if (Math.abs(pitch) < deadzone && Math.abs(roll) < deadzone) {
        return [];
    }
    const forwardComponent = -Math.tan(pitch * Math.PI / 180);
    const rightComponent = Math.tan(roll * Math.PI / 180);

    const bearingRad = Math.atan2(rightComponent, forwardComponent);
    let bearingDeg = bearingRad * 180 / Math.PI;
    if (bearingDeg < 0) bearingDeg += 360;

    const STEP_METERS = 10;   // distanza fissa tra un punto e il successivo

    const points = [];
    let current = { latitude: gps.lat, longitude: gps.lng };

    for (let i = 1; i <= 3; i++) {
        current = computeDestinationPoint(current, STEP_METERS, bearingDeg);
        points.push({ lat: current.latitude, lng: current.longitude });
    }

    return points;
}