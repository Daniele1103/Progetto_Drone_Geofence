import { InfluxDBClient } from "@influxdata/influxdb3-client";

import dotenv from "dotenv";
import path from "path";

dotenv.config({
    path: path.resolve(process.cwd(), "../.env")
});

const client = new InfluxDBClient({
    host: process.env.INFLUX_URL,
    token: process.env.INFLUX_TOKEN,
    database: process.env.INFLUX_DB
});

/* =========================
   GPS
========================= */

export function saveGps(data) {
    // il primo elemento è la misurement, dopo il primo separato con la virgola ci sono i tag, dopo si metto per forza uno spazio e iniziano i value/campi (posso anche non mettere i tag)
    const line =
        `gps,device=drone1 ` +
        `lat=${data.lat},` +
        `lng=${data.lng},` +
        `alt=${data.alt}`;

    return client.write(
        line,
        process.env.INFLUX_DB
    )
        .then(() => {
            console.log("GPS salvato "+ line);
        })
        .catch((err) => {
            console.error(
                "Errore GPS:",
                err.message
            );
        });
}

/* =========================
   TEMPERATURA
========================= */

export function saveTemperature(data) {

    const line =
        `temperature,device=drone1 ` +
        `value=${data.value}`;

    return client.write(
        line,
        process.env.INFLUX_DB
    )
        .then(() => {
            console.log("Temperatura salvata: "+ line);
        })
        .catch((err) => {
            console.error(
                "Errore temperatura:",
                err.message
            );
        });
}

/* =========================
   UMIDITÀ
========================= */

export function saveHumidity(data) {

    const line =
        `humidity,device=drone1 ` +
        `value=${data.value}`;

    return client.write(
        line,
        process.env.INFLUX_DB
    )
        .then(() => {
            console.log("Umidità salvata "+ line);
        })
        .catch((err) => {
            console.error(
                "Errore umidità:",
                err.message
            );
        });
}

/* =========================
   QUERY GPS
========================= */

export function getGpsData() {

    const query = `
        SELECT *
        FROM gps
        ORDER BY time DESC
        LIMIT 10
    `;

    client.query(
        query,
        process.env.INFLUX_DB
    )
        .then(async (result) => {

            for await (const row of result) {

                console.log(row);
            }
        })
        .catch((err) => {

            console.error(
                "Errore query GPS:",
                err.message
            );
        });
}

/* =========================
   QUERY TEMPERATURA
========================= */

export function getTemperatureData() {

    const query = `
        SELECT *
        FROM temperature
        ORDER BY time DESC
        LIMIT 10
    `;

    client.query(
        query,
        process.env.INFLUX_DB
    )
        .then(async (result) => {

            for await (const row of result) {

                console.log(row);
            }
        })
        .catch((err) => {

            console.error(
                "Errore query temperatura:",
                err.message
            );
        });
}

/* =========================
   QUERY UMIDITÀ
========================= */

export function getHumidityData() {

    const query = `
        SELECT *
        FROM humidity
        ORDER BY time DESC
        LIMIT 10
    `;

    client.query(
        query,
        process.env.INFLUX_DB
    )
        .then(async (result) => {

            for await (const row of result) {

                console.log(row);
            }
        })
        .catch((err) => {

            console.error(
                "Errore query umidità:",
                err.message
            );
        });
}