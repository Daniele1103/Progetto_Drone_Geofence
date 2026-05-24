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
// per ora non mi servono, li lascio che non si sa mai
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

// per ora non mi servono, li lascio che non si sa mai
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


export async function getGpsTrips(req, res) {
    //console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
    try {

        // Gap massimo tra due punti consecutivi
        // oltre il quale parte un nuovo viaggio
        const MAX_GAP_MS = 60 * 60 * 1000; // 1 ora

        const query = `
            SELECT *
            FROM gps
            ORDER BY time ASC
        `;

        const result = await client.query(query, process.env.INFLUX_DB);

        const rows = [];

        for await (const row of result) {
            rows.push(row);
        }

        const gpsPoints = rows.map(r => ({
            timestamp: r.time,
            lat: r.lat,
            lng: r.lng,
            alt: r.alt
        }));

        // Nessun dato
        if (gpsPoints.length === 0) {
            return res.json([]);
        }

        const trips = [];

        let tripIndex = 1;

        let currentTrip = {
            name: `Viaggio ${tripIndex}`,
            start: gpsPoints[0].timestamp,
            end: gpsPoints[0].timestamp,
            date: gpsPoints[0].timestamp,
            points: [gpsPoints[0]]
        };

        for (let i = 1; i < gpsPoints.length; i++) {

            const prev = gpsPoints[i - 1];
            const current = gpsPoints[i];

            const prevTime = new Date(prev.timestamp).getTime();
            const currentTime = new Date(current.timestamp).getTime();

            const diff = currentTime - prevTime;

            // Se il gap supera 1 ora => nuovo viaggio
            if (diff > MAX_GAP_MS) {

                trips.push({
                    ...currentTrip,
                    totalPoints: currentTrip.points.length
                });

                tripIndex++;

                currentTrip = {
                    name: `Viaggio ${tripIndex}`,
                    start: current.timestamp,
                    end: current.timestamp,
                    date: current.timestamp,
                    points: [current]
                };

            } else {

                currentTrip.points.push(current);
                currentTrip.end = current.timestamp;
            }
        }

        // Ultimo viaggio perchè non entrerà mai nell'else l'ultimo perchè nona vrà viaggi dopo, quindi nonf arò mai il push se no
        trips.push({
            ...currentTrip,
            totalPoints: currentTrip.points.length
        });

        res.json(trips);

    } catch (err) {

        console.error("GPS Trips error:", err.message);

        res.status(500).json({
            error: err.message
        });
    }
}