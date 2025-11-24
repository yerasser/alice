import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import RoomPage from './pages/RoomPage';

ReactDOM.createRoot(document.getElementById('root')).render(
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/room/:roomId" element={<RoomPage />} />
            </Routes>
        </BrowserRouter>
);
