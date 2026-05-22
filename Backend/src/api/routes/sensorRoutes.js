import express from 'express';

import {
    getGpsHistory,
    getTemperatureHistory,
    getHumidityHistory,
    getGpsTrips
} from '../controllers/sensorController.js';

const router = express.Router();

router.get('/gps', getGpsHistory);
router.get('/temperature', getTemperatureHistory);
router.get('/humidity', getHumidityHistory);
router.get('/trips', getGpsTrips);

export default router;