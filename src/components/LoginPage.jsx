import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from 'react-bootstrap/Navbar';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Image from 'react-bootstrap/Image';
import logo from '../../public/heybooster-image.png';

function Login() {
    const [showModal, setShowModal] = useState(false);
    const modalRef = useRef(null);
    const navigate = useNavigate();

    const handleLoginClick = (e) => {
        e.preventDefault();
        setShowModal(true);
    };

    const handleCloseClick = () => {
        setShowModal(false);
    };

    const handleClickOutside = (event) => {
        if (modalRef.current && !modalRef.current.contains(event.target)) {
            setShowModal(false);
        }
    };

    useEffect(() => {
        if (showModal) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showModal]);

    return (
        <div>
            <Navbar className="bg-body-tertiary d-flex justify-content-between border">
                <Navbar.Brand>
                    <Image className="ml-3" src={logo} alt="Logo" style={{ width: '48px', height: '48px' }} />
                </Navbar.Brand>
                <Navbar.Brand>
                    <p className="text-xl font-semibold ml-2 text-custom-blue justify-center items-center">
                        heybooster Test App
                    </p>
                </Navbar.Brand>
                <Form inline>
                    <Row>
                        <Col xs="auto">
                            <Button className="mr-2" type="submit" onClick={handleLoginClick}>Login</Button>
                        </Col>
                    </Row>
                </Form>
            </Navbar>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div ref={modalRef} className="bg-white rounded-lg p-6 w-96 animate-fadeIn">
                        <BasicExample onClose={handleCloseClick} navigate={navigate} />
                    </div>
                </div>
            )}
        </div>
    );
}

function BasicExample({ onClose, navigate }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        if (email === 'YOUR MAİL' && password === 'YOUR PASSWORD') {
            localStorage.setItem('isAuthenticated', 'true');
            navigate('/app');
        } else {
            alert('Invalid email or password');
        }
    };

    return (
        <Form onSubmit={handleLogin}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Sign In</h2>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                    &times;
                </button>
            </div>
            <Form.Group className="mb-4" controlId="formBasicEmail">
                <Form.Label className="block text-gray-700 font-medium mb-2">Email address</Form.Label>
                <Form.Control
                    type="email"
                    placeholder="Enter email"
                    className="block w-full border border-gray-300 rounded-md p-2 focus:shadow-none focus:no-underline"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
            </Form.Group>
            <Form.Group className="mb-4" controlId="formBasicPassword">
                <Form.Label className="block text-gray-700 font-medium mb-2">Password</Form.Label>
                <Form.Control
                    type="password"
                    placeholder="Password"
                    className="block w-full border border-gray-300 rounded-md p-2 focus:shadow-none focus:no-underline"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </Form.Group>
            <Button className="w-full bg-blue-500 text-white rounded-md py-2" type="submit">
                Login
            </Button>
        </Form>
    );
}

export default Login;
