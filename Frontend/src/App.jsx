import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Navbar from './components/navbar/Navbar';
import GeofenceManager from './components/geofencemanager/GeofenceManager';
import HeatMap from './components/heatmap/HeatMap'
import DroneDashboard from './components/dronedashboard/DroneDashboard';
import DroneTrips from './components/trips/DroneTrips';
import GeofenceAnalytics from './components/analytics/GeofenceAnalytics';
import axios from "axios";

const Welcome = () => (
  <div className="welcome-container">
    <h2>Benvenuto nel Gestore Geofence</h2>
    <p>Utilizza la barra di navigazione per esplorare le funzionalità.</p>
  </div>
);

function InnerHome() {
  return (
    <>
      <Navbar />
      <Container fluid className="p-0 text-center">
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/geofencemanager" element={<GeofenceManager />} />
          <Route path="/drone" element={<DroneDashboard />} />
          <Route path="/heatmap" element={<HeatMap />} />
          <Route path="/geofenceanalytics" element={<GeofenceAnalytics />} />
          <Route path="/trips" element={<DroneTrips />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>
    </>
  );
}

const App = () => (
  <Router>
    <InnerHome />
  </Router>
);

export default App;