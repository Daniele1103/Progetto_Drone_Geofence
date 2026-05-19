import express from 'express';

import {
    getGpsHistory,
    getTemperatureHistory,
    getHumidityHistory
} from '../controllers/sensorController.js';

const router = express.Router();

router.get('/gps', getGpsHistory);
router.get('/temperature', getTemperatureHistory);
router.get('/humidity', getHumidityHistory);

export default router;