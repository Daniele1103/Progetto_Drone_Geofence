import express from 'express';
import { createGeofence, getGeofences } from '../controllers/geofenceController.js';

const router = express.Router();

router.post('/', createGeofence);
router.get('/', getGeofences);

export default router;