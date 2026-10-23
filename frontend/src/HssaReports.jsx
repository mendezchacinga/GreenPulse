import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "./AppLayout";
import { Card, formatDate, formatMoney, formatWeight } from "./OperatorUI";
import { DESTINATIONS, LINES, WASTE_TYPES } from "./operationConstants";
import "./supervisor-review.css";

const day = (offset = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
};
const reportTypes = [
    ["losses", "Reporte de mermas"],
    ["movements", "Reporte de movimiento de residuos"],
    ["effluents", "Reporte de efluentes"]
];
async function api(path) {
    const response = await fetch(`/api/operations${path}`, { credentials: "include" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.message || "No se pudo cargar el reporte");
    return data;
}
function downloadCsv(filename, rows) {
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

export default function HssaReports() {
    const [type, setType] = useState("losses");
    const [filters, setFilters] = useState({ from: day(-29), to: day(0), line: "", wasteType: "", destination: "", point: "", result: "" });
    const [data, setData] = useState({ rows: [], totals: {}, empty: true });
    const [profile, setProfile] = useState(null);
    const [points, setPoints] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const query = useMemo(() => {
        const params = new URLSearchParams({ type, from: filters.from, to: filters.to });
        if (type === "losses") {
            if (filters.line) params.set("line", filters.line);
            if (filters.wasteType) params.set("wasteType", filters.wasteType);
        }
        if (type === "movements") {
            if (filters.wasteType) params.set("wasteType", filters.wasteType);
            if (filters.destination) params.set("destination", filters.destination);
        }
        if (type === "effluents") {
            if (filters.point) params.set("point", filters.point);
            if (filters.result) params.set("result", filters.result);
        }
        return params.toString();
    }, [type, filters]);
    useEffect(() => {
        fetch("/api/operations/profile", { credentials: "include" }).then((response) => response.ok ? response.json() : null).then(setProfile).catch(() => {});
        api("/effluent-catalog").then((catalog) => setPoints(catalog.points || [])).catch(() => {});
    }, []);
    useEffect(() => {
        let alive = true;
        setLoading(true); setError("");
        api(`/reports/preview?${query}`).then((payload) => { if (alive) setData(payload); }).catch((reason) => { if (alive) setError(reason.message); }).finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [query]);
    const set = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
    const title = reportTypes.find(([value]) => value === type)?.[1] || "Reporte";
    function exportCsv() {
        if (type === "losses") {
            const lines = ["Fecha,Línea,Turno,Residuo,Peso kg,Causa,Estado", ...data.rows.map((row) => [row.date, row.line, row.shift, row.wasteType, row.weight, row.cause, row.status].map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))];
            return downloadCsv("reporte-mermas.csv", lines);
        }
        if (type === "movements") {
            const lines = ["Fecha,Zona,Residuo,Peso kg,Destino,Costo", ...data.rows.map((row) => [row.date, row.zone, row.wasteType, row.weight, row.destination, row.cost].map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))];
            return downloadCsv("reporte-movimientos.csv", lines);
        }
        const lines = ["Fecha,Punto,Parámetro,Valor,Unidad,Límite,Resultado,Responsable", ...data.rows.map((row) => [row.date, row.point, row.parameter, row.value, row.unit, row.limit, row.result, row.responsible].map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))];
        downloadCsv("reporte-efluentes.csv", lines);
    }
    return <AppLayout role="hssa" active="Reportes" title="Reportes" subtitle="Genera reportes para auditorías y seguimiento">
        <div className="supervisor-page">
            <div className="hssa-report-types hssa-no-print" role="group" aria-label="Tipo de reporte">
                {reportTypes.map(([value, label]) => <button key={value} type="button" className={type === value ? "active" : ""} onClick={() => setType(value)}>{label}</button>)}
            </div>
            <Card className="supervisor-filters hssa-no-print">
                <div className="filter-field"><label htmlFor="rep-from">Desde</label><input id="rep-from" type="date" value={filters.from} onChange={(event) => set("from", event.target.value)} /></div>
                <div className="filter-field"><label htmlFor="rep-to">Hasta</label><input id="rep-to" type="date" value={filters.to} onChange={(event) => set("to", event.target.value)} /></div>
                {type === "losses" && <>
                    <div className="filter-field"><label htmlFor="rep-line">Línea</label><select id="rep-line" value={filters.line} onChange={(event) => set("line", event.target.value)}><option value="">Todas</option>{LINES.map((line) => <option key={line}>{line}</option>)}</select></div>
                    <div className="filter-field"><label htmlFor="rep-waste">Tipo de residuo</label><select id="rep-waste" value={filters.wasteType} onChange={(event) => set("wasteType", event.target.value)}><option value="">Todos</option>{WASTE_TYPES.map((item) => <option key={item}>{item}</option>)}</select></div>
                </>}
                {type === "movements" && <>
                    <div className="filter-field"><label htmlFor="rep-waste-m">Tipo de residuo</label><select id="rep-waste-m" value={filters.wasteType} onChange={(event) => set("wasteType", event.target.value)}><option value="">Todos</option>{WASTE_TYPES.map((item) => <option key={item}>{item}</option>)}</select></div>
                    <div className="filter-field"><label htmlFor="rep-dest">Destino</label><select id="rep-dest" value={filters.destination} onChange={(event) => set("destination", event.target.value)}><option value="">Todos</option>{DESTINATIONS.map((item) => <option key={item}>{item}</option>)}</select></div>
                </>}
                {type === "effluents" && <>
                    <div className="filter-field"><label htmlFor="rep-point">Punto de descarga</label><select id="rep-point" value={filters.point} onChange={(event) => set("point", event.target.value)}><option value="">Todos</option>{points.map((item) => <option key={item.name}>{item.name}</option>)}</select></div>
                    <div className="filter-field"><label htmlFor="rep-result">Resultado</label><select id="rep-result" value={filters.result} onChange={(event) => set("result", event.target.value)}><option value="">Todos</option><option value="cumple">Cumple</option><option value="no_cumple">No cumple</option></select></div>
                </>}
            </Card>
            <div className="hssa-no-print" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button className="supervisor-primary" type="button" onClick={exportCsv} disabled={data.empty}>Exportar a Excel</button>
                <button className="supervisor-approve" type="button" onClick={() => window.print()} disabled={data.empty}>Exportar a PDF</button>
            </div>
            {error && <p className="supervisor-error" role="alert"><AlertCircle size={17} />{error}</p>}
            <Card>
                <div className="hssa-print-only">
                    <h2>GreenPulse · Lácteos Los Andes</h2>
                    <p>{title}</p>
                    <p>Rango: {filters.from} a {filters.to}</p>
                    <p>Generado: {new Date().toLocaleString("es-CO")} · {profile?.name || profile?.email}</p>
                </div>
                {loading ? <p className="supervisor-empty">Cargando vista previa</p> : data.empty ? <p className="supervisor-empty">No hay datos para los filtros seleccionados</p> : <>
                    {type === "losses" && <div className="supervisor-table"><div className="supervisor-table-head hssa-loss-head"><span>Fecha</span><span>Línea</span><span>Turno</span><span>Residuo</span><span>Peso</span><span>Causa</span><span>Estado</span></div>{data.rows.map((row, index) => <article className="hssa-loss-row" key={index}><time>{formatDate(row.date)}</time><span>{row.line}</span><span>{row.shift}</span><span>{row.wasteType}</span><strong>{formatWeight(row.weight)}</strong><span>{row.cause}</span><span>{row.status}</span></article>)}<article className="hssa-loss-row hssa-loss-total"><span>Totales</span><span /><span /><span /><strong>{formatWeight(data.totals.weight)}</strong><span>{data.totals.excluded || 0} fuera (pendientes o rechazados)</span><span /></article></div>}
                    {type === "movements" && <div className="supervisor-table"><div className="supervisor-table-head hssa-move-head"><span>Fecha</span><span>Zona</span><span>Residuo</span><span>Peso</span><span>Destino</span><span>Costo</span></div>{data.rows.map((row, index) => <article className="hssa-move-row" key={index}><time>{formatDate(row.date)}</time><span>{row.zone}</span><span>{row.wasteType}</span><strong>{formatWeight(row.weight)}</strong><span>{row.destination}</span><span>{formatMoney(row.cost)}</span></article>)}<article className="hssa-move-row"><span>Totales</span><span /><span /><strong>{formatWeight(data.totals.weight)}</strong><span /><span>{formatMoney(data.totals.cost)}</span></article></div>}
                    {type === "effluents" && <div className="supervisor-table"><div className="supervisor-table-head hssa-effluent-head"><span>Fecha</span><span>Punto</span><span>Parámetro</span><span>Valor</span><span>Límite</span><span>Resultado</span><span>Responsable</span><span /></div>{data.rows.map((row, index) => <article className={`hssa-effluent-row ${row.result === "no_cumple" ? "hssa-fail-row" : ""}`} key={index}><time>{formatDate(row.date)}</time><span>{row.point}</span><span>{row.parameter}</span><strong>{row.value} {row.unit}</strong><span>{row.limit == null ? "—" : row.limit}</span><span>{row.result === "cumple" ? "Cumple" : "No cumple"}</span><span>{row.responsible}</span><span /></article>)}<article className="hssa-effluent-row"><span>Totales</span><span>{data.totals.count} mediciones</span><span /><span /><span /><span>{data.totals.fail} no cumplen</span><span /><span /></article></div>}
                </>}
            </Card>
        </div>
    </AppLayout>;
}
