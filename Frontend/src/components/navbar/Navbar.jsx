import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar as RBNavbar, Nav, Container } from 'react-bootstrap';

const Navbar = () => {
    return (
        
            <RBNavbar
                bg="dark"
                variant="dark"
                className=" border-bottom rounded"
            >
                <Container>
                    <RBNavbar.Brand as={Link} to="/">GeoManager</RBNavbar.Brand>
                
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/">Home</Nav.Link>
                        <Nav.Link as={Link} to="/geofencemanager">GeofenceManager</Nav.Link>
                        <Nav.Link as={Link} to="/drone">Drone</Nav.Link>
                        <Nav.Link as={Link} to="/heatmap">HeatMap</Nav.Link>
                        <Nav.Link as={Link} to="/geofenceanalytics">GeofenceAnalytics</Nav.Link>
                        <Nav.Link as={Link} to="/trips">Viaggi</Nav.Link>
                    </Nav>
                </Container>
            </RBNavbar>
        
    );
};

export default Navbar;