import { client } from "../../influx/influxClient.js";
import { checkGeofencesBulk } from '../controllers/geofenceController.js';
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

export async function getTripsDate(req, res) {

    try {

        const MAX_GAP_MS = 60 * 60 * 1000; // 1 ora

        const query = `
            SELECT *
            FROM gps
            ORDER BY time ASC
        `;

        const result = await client.query(query, process.env.INFLUX_DB);

        const rows = [];
        for await (const row of result) rows.push(row);

        const gpsPoints = rows.map(r => ({
            timestamp: r.time,
        }));

        if (gpsPoints.length === 0) return res.json([]);

        const trips = [];

        let currentTrip = {
            start: gpsPoints[0].timestamp,
            end: gpsPoints[0].timestamp,
        };

        for (let i = 1; i < gpsPoints.length; i++) {

            const prev = gpsPoints[i - 1];
            const current = gpsPoints[i];

            const diff = new Date(current.timestamp) - new Date(prev.timestamp);

            if (diff > MAX_GAP_MS) {
                trips.push({ ...currentTrip });
                currentTrip = {
                    start: current.timestamp,
                    end: current.timestamp,
                };
            } else {
                currentTrip.end = current.timestamp;
            }
        }

        trips.push({ ...currentTrip });

        res.json(trips);

    } catch (err) {
        console.error("TripsDate error:", err.message);
        res.status(500).json({ error: err.message });
    }
}

export async function getSensorHistoryByGeofence(req, res) {

    try {

        const range = parseRange(req, res);
        if (!range) return;

        const where = `
            WHERE time >= '${range.start}'
            AND time <= '${range.end}'
            ORDER BY time ASC
        `;

        const [tempResult, humResult] = await Promise.all([
            client.query(`SELECT * FROM temperature ${where}`, process.env.INFLUX_DB),
            client.query(`SELECT * FROM humidity    ${where}`, process.env.INFLUX_DB),
        ]);

        const tempPoints = [];
        const humPoints = [];

        for await (const row of tempResult) tempPoints.push({ timestamp: row.time, value: row.value, lat: row.lat, lng: row.lng, alt: row.alt });
        for await (const row of humResult) humPoints.push({ timestamp: row.time, value: row.value, lat: row.lat, lng: row.lng, alt: row.alt });

        const geofenceMap = new Map();

        await Promise.all([
            assignPointsToGeofences(tempPoints, "temperature", geofenceMap),
            assignPointsToGeofences(humPoints, "humidity", geofenceMap),
        ]);

        res.json(Array.from(geofenceMap.values()));

    } catch (err) {
        console.error("SensorHistoryByGeofence error:", err.message);
        res.status(500).json({ error: err.message });
    }
}

async function assignPointsToGeofences(points, type, geofenceMap) {

    if (points.length === 0) return;

    const rows = await checkGeofencesBulk(points);

    for (const row of rows) {
        const p = points[row.idx];
        const point = {
            timestamp: p.timestamp,
            lat: p.lat,
            lng: p.lng,
            alt: p.alt,
            value: p.value,
        };

        if (!geofenceMap.has(row.id)) {
            geofenceMap.set(row.id, {
                id: row.id,
                name: row.name,
                temperature: [],
                humidity: [],
            });
        }

        geofenceMap.get(row.id)[type].push(point);
    }
}