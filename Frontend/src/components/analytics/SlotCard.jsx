import React from "react";
import "./SlotCard.css";

const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

const formatDuration = (start, end) => {
    const ms = new Date(end) - new Date(start);
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const SlotCard = ({ slot, isActive, onClick }) => {
    return (
        <div
            onClick={onClick}
            className={`slot-card p-3 m-1 border-bottom border-secondary ${isActive ? "selected-card" : ""}`}
        >
            <div className="fw-bold mb-1">
                {formatDate(slot.start)}
            </div>
            <div className="text-secondary small">
                {formatTime(slot.start)} → {formatTime(slot.end)}
            </div>
            <div className="text-secondary small">
                Durata: {formatDuration(slot.start, slot.end)}
            </div>
        </div>
    );
};

export default SlotCard;