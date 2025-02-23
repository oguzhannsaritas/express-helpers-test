import React from 'react';
import './main.css';


import LoginPage from "./components/LoginPage.jsx";
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import TestPanel from "./components/TestPanel.jsx";
import 'bootstrap/dist/css/bootstrap.min.css';
import ReactDOM from 'react-dom/client'; // createRoot burada import edilir





const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement); // createRoot kullanımı

root.render(
    <React.StrictMode>
        <Router>
            <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route path="/app" element={<TestPanel />} />
            </Routes>
        </Router>
    </React.StrictMode>
);
