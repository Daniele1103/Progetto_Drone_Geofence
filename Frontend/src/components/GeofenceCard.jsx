import './GeofenceCard.css';
const GeofenceCard = ({ geofence, onSelect, onDelete, iSselected }) => {
    return (
        <div
            className={`
                card
                bg-dark
                text-light
                border
                mb-2
                geofence-card
                ${iSselected ? 'selected-card border-primary' : 'border-secondary'}
            `}
            style={{ cursor: 'pointer' }}
            onClick={onSelect}
        >
            <div className="card-body p-2 d-flex justify-content-between align-items-center">

                <strong>{geofence.name}</strong>

                <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={(e) => {
                        e.stopPropagation();                // impedisce che il click sul bottone attivi anche onSelect
                        onDelete();
                    }}
                >
                    ✕
                </button>

            </div>
        </div>
    );
};

export default GeofenceCard;