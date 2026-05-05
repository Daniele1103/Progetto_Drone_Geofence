import dotenv from 'dotenv';
import express from 'express';
import pkg from 'pg';
import geofenceRoutes from './routes/geofenceRoutes.js'
import cors from "cors";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Rotta test
app.get('/', async (req, res) => {
    try {
        const dbRes = await pool.query('SELECT postgis_full_version()');
        res.json({
            status: 'Online',
            message: 'Backend connesso a PostGIS con successo!',
            postgis: dbRes.rows[0].postgis_full_version
        });
    } catch (err) {
        console.error('Errore DB:', err.message);
        res.status(500).json({ error: 'Errore di connessione al database' });
    }
});

app.use('/geofences', geofenceRoutes);

export default app;