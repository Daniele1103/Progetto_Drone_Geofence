import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Geofence from './components/Geofence';
import HeatMap from './components/HeatMap'
import { Container } from 'react-bootstrap';
import axios from "axios";
import DroneDashboard from './components/DroneDashboard';
import DroneTrips from './components/DroneTrips';
import GeofenceAnalytics from './components/GeofenceAnalytics';

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
          <Route path="/map" element={<Geofence />} />
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