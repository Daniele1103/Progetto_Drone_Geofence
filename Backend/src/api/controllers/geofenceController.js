import pool from '../../postgis/dbpg.js';

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