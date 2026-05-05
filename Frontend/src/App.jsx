import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Geofence from './components/Geofence';
import { Container } from 'react-bootstrap';
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
      <Container fluid className="p-3 text-center">
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/map" element={<Geofence />} />
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