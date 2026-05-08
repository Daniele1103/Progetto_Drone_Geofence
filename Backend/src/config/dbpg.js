import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect()
    .then(client => {
        console.log("Connesso a PostGIS");
        client.release();
    })
    .catch(err => {
        console.error("Errore connessione DB:", err.message);
    });
/*
    pool.query() usa automaticamente una connessione dal pool, esegue la query e la rilascia subito dopo.

    pool.connect() invece ti dà una connessione manuale che devi rilasciare con release() quando hai finito di usarla.

    uso connect solo per verificare connessione, poi userò solo il pool con query
*/
export default pool;