import pool from '../../config/dbpg.js';

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