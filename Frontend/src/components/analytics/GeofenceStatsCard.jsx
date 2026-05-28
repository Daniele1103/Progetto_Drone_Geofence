import React from "react";
import "./GeofenceStatsCard.css";

const avg = (arr) =>
    arr.length === 0 ? null : arr.reduce((s, p) => s + p.value, 0) / arr.length;

const GeofenceStatsCard = ({ geofence, isSelected, onClick }) => {
    const totalPoints = geofence.temperature.length + geofence.humidity.length;
    const avgTemp = avg(geofence.temperature);
    const avgHum = avg(geofence.humidity);

    return (
        <div
            onClick={onClick}
            className={`geofence-stats-card p-3 border border-secondary ${isSelected ? "selected-card" : ""}`}
        >
            <div className="d-flex align-items-center justify-content-between">
                <span className="fw-bold" style={{ color: isSelected ? "#00c2ff" : "#eee", fontSize: "0.85rem" }}>
                    {geofence.name}
                </span>
                <span className="geofence-stats-badge badge">
                    {totalPoints} pt
                </span>
            </div>

            <div className="d-flex gap-3 mt-2" style={{ fontSize: "0.72rem", color: "#6b7280" }}>
                <span> {geofence.temperature.length} temp</span>
                <span> {geofence.humidity.length} hum</span>
            </div>

            {isSelected && (
                <div className="mt-3 pt-2 border-top border-secondary">
                    <div className="d-flex justify-content-between mb-1" style={{ fontSize: "0.78rem" }}>
                        <span className="text-secondary">Temp. media</span>
                        <span style={{ color: "#ff7300", fontWeight: 600 }}>
                            {avgTemp !== null ? `${avgTemp.toFixed(1)} °C` : "—"}
                        </span>
                    </div>
                    <div className="d-flex justify-content-between" style={{ fontSize: "0.78rem" }}>
                        <span className="text-secondary">Umidità media</span>
                        <span style={{ color: "#00c2ff", fontWeight: 600 }}>
                            {avgHum !== null ? `${avgHum.toFixed(1)} %` : "—"}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GeofenceStatsCard;