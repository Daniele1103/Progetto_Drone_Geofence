import dotenv from 'dotenv';
import express from 'express';
import pkg from 'pg';
import geofenceRoutes from './api/routes/geofenceRoutes.js'
import cors from "cors";
import "./mqtt/mqttClient.js";
import pool from "./config/dbpg.js";
import path from "path";

dotenv.config({
    path: path.resolve(process.cwd(), "../.env")
});

const app = express();

// Middleware
app.use(express.json());
app.use(cors());


app.use('/geofences', geofenceRoutes);

export default app;