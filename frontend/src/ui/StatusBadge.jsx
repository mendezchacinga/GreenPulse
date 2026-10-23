const labels = { pending: "Pendiente", approved: "Aprobado", corrected: "Corregido", rejected: "Rechazado" };
export default function StatusBadge({ status }) { return <span className={`gp-status gp-status--${status}`}>{labels[status] || status}</span>; }
