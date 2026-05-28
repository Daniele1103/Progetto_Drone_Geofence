import React from 'react';
import './TripCard.css'

const formatDuration = (startISO, endISO) => {
    const ms = new Date(endISO) - new Date(startISO);
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const formatTime = (iso) => {
    return new Date(iso).toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

const TripCard = ({ trip, isActive, onClick }) => {
    return (
        <div
            onClick={onClick}
            className={`trip-card p-3 m-1 border-bottom border-secondary ${isActive ? 'selected-card' : ''}`}
        >
            <div className="fw-bold mb-1">
                {trip.name}
            </div>

            <div className="text-secondary small">
                {formatDate(trip.date)}
            </div>

            <div className="text-secondary small">
                {formatTime(trip.start)} → {formatTime(trip.end)}
            </div>

            <div className="text-secondary small">
                {formatDuration(trip.start, trip.end)}
            </div>

            <div className="text-secondary small">
                {trip.totalPoints} punti
            </div>
        </div>
    );
};

export default TripCard;