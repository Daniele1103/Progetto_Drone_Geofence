import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar as RBNavbar, Nav, Container } from 'react-bootstrap';

const Navbar = () => {
    return (
        <RBNavbar bg="dark" variant="dark" className="mb-4">
            <Container>
                {/* Il Brand è il titolo cliccabile che porta alla Home */}
                <RBNavbar.Brand as={Link} to="/">GeoManager</RBNavbar.Brand>

                {/* I link di navigazione */}
                <Nav className="me-auto">
                    <Nav.Link as={Link} to="/">Home</Nav.Link>
                    <Nav.Link as={Link} to="/map">Mappa</Nav.Link>
                </Nav>
            </Container>
        </RBNavbar>
    );
};

export default Navbar;