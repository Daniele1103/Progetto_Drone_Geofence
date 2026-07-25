import { InfluxDBClient } from "@influxdata/influxdb3-client";

import dotenv from "dotenv";
import path from "path";

dotenv.config({
    path: path.resolve(process.cwd(), "../.env")
});

export const client = new InfluxDBClient({
    host: process.env.INFLUX_URL,
    token: process.env.INFLUX_TOKEN,
    database: process.env.INFLUX_DB
});

client.getServerVersion()
    .then((version) => {
        console.log(`Connesso a InfluxDB (versione ${version})`);
    })
    .catch((err) => {
        console.error("Errore connessione InfluxDB:", err.message);
    });
    
// il primo elemento è la measurement, dopo il primo separato con la virgola ci sono i tag, dopo si metto per forza uno spazio e iniziano i value/campi (posso anche non mettere i tag)
export function saveGps(data) {
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
            //console.log("GPS salvato " + line);
        })
        .catch((err) => {
            console.error(
                "Errore GPS:",
                err.message
            );
        });
}

export function saveTemperature(data) {

    const line =
        `temperature,device=drone1 ` +
        `value=${data.value},` +
        `lat=${data.lat},` +
        `lng=${data.lng},` +
        `alt=${data.alt}`;

    return client.write(
        line,
        process.env.INFLUX_DB
    )
        .then(() => {
            //console.log("Temperatura salvata: " + line);
        })
        .catch((err) => {
            console.error(
                "Errore temperatura:",
                err.message
            );
        });
}

export function saveHumidity(data) {

    const line =
        `humidity,device=drone1 ` +
        `value=${data.value},` +
        `lat=${data.lat},` +
        `lng=${data.lng},` +
        `alt=${data.alt}`;

    return client.write(
        line,
        process.env.INFLUX_DB
    )
        .then(() => {
            //console.log("Umidità salvata " + line);
        })
        .catch((err) => {
            console.error(
                "Errore umidità:",
                err.message
            );
        });
}