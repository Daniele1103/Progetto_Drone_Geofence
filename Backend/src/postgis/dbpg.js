import pkg from 'pg';
import dotenv from 'dotenv';
import path from "path";

dotenv.config({
    path: path.resolve(process.cwd(), "../.env")
});

const { Pool } = pkg;

//pool.query() usa automaticamente una connessione dal pool, esegue la query e la rilascia subito dopo.
const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
});

//connessione manuale che va rilasciare con release(), solo per verifica connesione
pool.connect()
    .then(client => {
        console.log("Connesso a PostGIS");
        client.release();
    })
    .catch(err => {
        console.error("Errore connessione DB:", err.message);
    });

export default pool;