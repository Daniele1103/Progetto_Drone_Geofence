import express from 'express';
import { createGeofence, getGeofences, deleteGeofence } from '../controllers/geofenceController.js';

const router = express.Router();

router.post('/', createGeofence);
router.get('/', getGeofences);
router.delete('/:id', deleteGeofence);

export default router;