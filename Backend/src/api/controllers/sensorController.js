import { client } from "../../influx/influxClient.js";

import dotenv from "dotenv";
import path from "path";

dotenv.config({
    path: path.resolve(process.cwd(), "../.env")
});

function parseRange(req, res) {

    const { start, end } = req.query;

    if (!start || !end) {
        res.status(400).json({ error: "Parametri 'start' e 'end' obbligatori" });
        return null;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate) || isNaN(endDate)) {
        res.status(400).json({ error: "Formato data non valido" });
        return null;
    }

    if (startDate >= endDate) {
        res.status(400).json({ error: "'start' deve essere precedente a 'end'" });
        return null;
    }

    return {
        start: startDate.toISOString(),
        end: endDate.toISOString()
    };
}

export async function getGpsHistory(req, res) {

    try {

        const range = parseRange(req, res);
        if (!range) return;

        const query = `
            SELECT *
            FROM gps
            WHERE time >= '${range.start}'
            AND time <= '${range.end}'
            ORDER BY time ASC
        `;

        const result = await client.query(query, process.env.INFLUX_DB);

        const rows = [];
        for await (const row of result) rows.push(row);

        const data = rows.map(r => ({
            timestamp: r.time,
            lat: r.lat,
            lng: r.lng,
            alt: r.alt
        }));

        res.json(data);

    } catch (err) {
        console.error("GPS error:", err.message);
        res.status(500).json({ error: err.message });
    }
}

export async function getTemperatureHistory(req, res) {

    try {

        const range = parseRange(req, res);
        if (!range) return;

        const query = `
            SELECT *
            FROM temperature
            WHERE time >= '${range.start}'
            AND time <= '${range.end}'
            ORDER BY time ASC
        `;

        const result = await client.query(query, process.env.INFLUX_DB);

        const rows = [];
        for await (const row of result) rows.push(row);

        const data = rows.map(r => ({
            timestamp: r.time,
            value: r.value,
            lat: r.lat,
            lng: r.lng,
            alt: r.alt
        }));

        res.json(data);

    } catch (err) {
        console.error("Temperature error:", err.message);
        res.status(500).json({ error: err.message });
    }
}

export async function getHumidityHistory(req, res) {

    try {

        const range = parseRange(req, res);
        if (!range) return;

        const query = `
            SELECT *
            FROM humidity
            WHERE time >= '${range.start}'
            AND time <= '${range.end}'
            ORDER BY time ASC
        `;

        const result = await client.query(query, process.env.INFLUX_DB);

        const rows = [];
        for await (const row of result) rows.push(row);

        const data = rows.map(r => ({
            timestamp: r.time,
            value: r.value,
            lat: r.lat,
            lng: r.lng,
            alt: r.alt
        }));

        res.json(data);

    } catch (err) {
        console.error("Humidity error:", err.message);
        res.status(500).json({ error: err.message });
    }
}