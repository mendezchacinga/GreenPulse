import "./operator-ui.css";
const labels = { pending: "Pendiente", approved: "Aprobado", corrected: "Corregido", rejected: "Rechazado" };
export function Card({ children, className = "" }) { return <section className={`operator-card ${className}`}>{children}</section>; }
export function StatusBadge({ status }) { return <span className={`operator-status ${status}`}><i/>{labels[status] || status}</span>; }
export const formatWeight = (value) => `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))} kg`;
export const formatDate = (value) => new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
export const formatTime = (value) => new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
export const formatShift = (value) => ({ "Turno 1": "Mañana", "Turno 2": "Tarde" }[value] || value || "Sin turno");
export const formatMoney = (value) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value || 0));
export const formatPercent = (value) => `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value || 0))} %`;
