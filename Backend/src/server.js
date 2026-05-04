import 'dotenv/config';
import express from 'express';
import pkg from 'pg';

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3000;

// Configurazione del Pool di connessione a PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Middleware per leggere i body JSON
app.use(express.json());

// Rotta di test: Verifica connessione e versione PostGIS
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

app.listen(PORT, () => {
    console.log(`Server in ascolto su http://localhost:${PORT}`);
    console.log(`Connesso al DB sulla porta ${process.env.DB_PORT}`);
});