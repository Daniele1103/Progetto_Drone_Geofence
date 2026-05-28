import React from "react";

const GradientLegend = ({ gradient, min, max, unit, label }) => {
    const bg = `linear-gradient(to right, ${gradient.join(", ")})`;
    return (
        <div className="mb-3">
            <div className="text-secondary small mb-1">{label}</div>
            <div style={{ height: 10, borderRadius: 4, background: bg, border: "1px solid rgba(255,255,255,0.1)" }} />
            <div className="d-flex justify-content-between mt-1" style={{ fontSize: "0.7rem", color: "#9ca3af" }}>
                <span>{min}{unit}</span>
                <span>{max}{unit}</span>
            </div>
        </div>
    );
};

export default GradientLegend;