import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AppLayout from "./AppLayout";
import { Card, formatMoney, formatPercent, formatWeight } from "./OperatorUI";
import { LINES, WASTE_COLORS } from "./operationConstants";
import "./supervisor-review.css";

const day = (offset = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
};
const defaults = () => ({ from: day(-29), to: day(0), line: "" });
async function api(path) {
    const response = await fetch(`/api/operations${path}`, { credentials: "include" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.message || "No se pudo cargar el tablero");
    return data;
}
const formatChange = (value) => {
    if (value == null || Number.isNaN(Number(value))) return "Sin comparación";
    const amount = Number(value);
    const text = `${amount > 0 ? "+" : ""}${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(amount)} % vs. período anterior`;
    return text;
};
function ChangeLine({ value }) {
    const amount = Number(value);
    const tone = !Number.isFinite(amount) || amount === 0 ? "flat" : amount > 0 ? "up" : "down";
    const Icon = tone === "up" ? ArrowUpRight : tone === "down" ? ArrowDownRight : Minus;
    return <small className={`hssa-change ${tone}`}><Icon size={14} aria-hidden="true" />{formatChange(value)}</small>;
}

export default function HssaDashboard() {
    const [filters, setFilters] = useState(defaults);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const query = useMemo(() => {
        const params = new URLSearchParams({ from: filters.from, to: filters.to });
        if (filters.line) params.set("line", filters.line);
        return params.toString();
    }, [filters]);
    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError("");
        api(`/hssa/dashboard?${query}`).then((payload) => { if (alive) setData(payload); }).catch((reason) => { if (alive) setError(reason.message); }).finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [query]);
    const set = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
    const kpis = data?.kpis;
    const charts = data?.charts || { byLine: [], byWasteType: [], byWeek: [], byDestination: [] };
    const empty = !loading && (data?.empty || (!charts.byLine.length && !charts.byDestination.some((item) => item.weight > 0)));
    return <AppLayout role="hssa" active="Tablero" title="Tablero de indicadores" subtitle="Seguimiento de mermas, residuos y cumplimiento ambiental">
        <div className="supervisor-page">
            <Card className="supervisor-filters">
                <div className="filter-field"><label htmlFor="hssa-from">Desde</label><input id="hssa-from" type="date" value={filters.from} onChange={(event) => set("from", event.target.value)} /></div>
                <div className="filter-field"><label htmlFor="hssa-to">Hasta</label><input id="hssa-to" type="date" value={filters.to} onChange={(event) => set("to", event.target.value)} /></div>
                <div className="filter-field"><label htmlFor="hssa-line">Línea</label><select id="hssa-line" value={filters.line} onChange={(event) => set("line", event.target.value)}><option value="">Todas</option>{LINES.map((line) => <option key={line}>{line}</option>)}</select></div>
                <button className="supervisor-clear" type="button" onClick={() => setFilters(defaults())}>Limpiar filtros</button>
            </Card>
            <p className="hssa-note">Incluye registros aprobados y corregidos</p>
            {error && <p className="supervisor-error" role="alert">{error}</p>}
            {loading ? <div className="supervisor-summary hssa-kpi-grid">{[1, 2, 3, 4, 5].map((item) => <Card className="supervisor-metric hssa-skeleton" key={item}><span /><b /></Card>)}</div> : <>
                <div className="supervisor-summary hssa-kpi-grid">
                    <Card className="supervisor-metric"><span>Merma total</span><b>{formatWeight(kpis?.totalLossKg)}</b><ChangeLine value={kpis?.totalLossChange} /></Card>
                    <Card className="supervisor-metric"><span>Merma por unidad producida</span><b>{kpis?.lossPerUnit == null ? "Sin datos de producción" : `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(kpis.lossPerUnit)} kg`}</b>{kpis?.lossPerUnit != null && <ChangeLine value={kpis.lossPerUnitChange} />}</Card>
                    <Card className="supervisor-metric"><span>Costo de disposición</span><b>{formatMoney(kpis?.disposalCost)}</b><ChangeLine value={kpis?.disposalCostChange} /></Card>
                    <Card className="supervisor-metric"><span>Material aprovechado</span><b>{formatPercent(kpis?.recoveredPct)}</b><ChangeLine value={kpis?.recoveredChange} /></Card>
                    <Card className="supervisor-metric"><span>Registros pendientes de validación</span><b>{kpis?.pendingValidation ?? 0}</b></Card>
                </div>
                {empty ? <Card><p className="supervisor-empty">No hay datos en el período seleccionado</p></Card> : <>
                    <div className="hssa-charts">
                        <Card>
                            <h2>Merma por línea</h2>
                            <p className="hssa-chart-alt">Resumen: {charts.byLine.map((item) => `${item.name} ${formatWeight(item.weight)}`).join("; ") || "Sin datos"}</p>
                            <div className="hssa-chart-box" role="img" aria-label="Gráfico de barras de merma por línea">
                                <ResponsiveContainer width="100%" height={260}><BarChart data={charts.byLine}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" label={{ value: "Línea", position: "insideBottom", offset: -2 }} /><YAxis label={{ value: "kg", angle: -90, position: "insideLeft" }} /><Tooltip formatter={(value) => formatWeight(value)} /><Legend /><Bar dataKey="weight" name="Merma kg" fill="#0F6B38" /></BarChart></ResponsiveContainer>
                            </div>
                        </Card>
                        <Card>
                            <h2>Merma por tipo de residuo</h2>
                            <p className="hssa-chart-alt">Resumen: {charts.byWasteType.map((item) => `${item.name} ${formatWeight(item.weight)}`).join("; ") || "Sin datos"}</p>
                            <div className="hssa-chart-box" role="img" aria-label="Gráfico de barras horizontales de merma por tipo de residuo">
                                <ResponsiveContainer width="100%" height={260}><BarChart data={charts.byWasteType} layout="vertical" margin={{ left: 24 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" label={{ value: "kg", position: "insideBottom", offset: -2 }} /><YAxis type="category" dataKey="name" width={110} /><Tooltip formatter={(value) => formatWeight(value)} /><Legend /><Bar dataKey="weight" name="Merma kg">{charts.byWasteType.map((item) => <Cell key={item.name} fill={WASTE_COLORS[item.name] || "#6B796F"} />)}</Bar></BarChart></ResponsiveContainer>
                            </div>
                        </Card>
                        <Card>
                            <h2>Tendencia semanal de mermas</h2>
                            <p className="hssa-chart-alt">Resumen: {charts.byWeek.map((item) => `semana ${item.week} ${formatWeight(item.weight)}`).join("; ") || "Sin datos"}</p>
                            <div className="hssa-chart-box" role="img" aria-label="Gráfico de línea de tendencia semanal de mermas">
                                <ResponsiveContainer width="100%" height={260}><LineChart data={charts.byWeek}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" label={{ value: "Semana", position: "insideBottom", offset: -2 }} /><YAxis label={{ value: "kg", angle: -90, position: "insideLeft" }} /><Tooltip formatter={(value) => formatWeight(value)} /><Legend /><Line type="monotone" dataKey="weight" name="Merma kg" stroke="#2D863B" strokeWidth={2} dot /></LineChart></ResponsiveContainer>
                            </div>
                        </Card>
                        <Card>
                            <h2>Destino de los residuos</h2>
                            <p className="hssa-chart-alt">Resumen: {charts.byDestination.map((item) => `${item.name} ${formatWeight(item.weight)}`).join("; ") || "Sin datos"}</p>
                            <div className="hssa-chart-box" role="img" aria-label="Gráfico de dona de destino de los residuos">
                                <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={charts.byDestination} dataKey="weight" nameKey="name" innerRadius={55} outerRadius={90} label={(entry) => `${entry.name}: ${formatWeight(entry.weight)}`}>{charts.byDestination.map((item, index) => <Cell key={item.name} fill={["#0F6B38", "#A64232", "#2D863B", "#4E6F82"][index % 4]} />)}</Pie><Tooltip formatter={(value) => formatWeight(value)} /><Legend /></PieChart></ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                    <Card>
                        <h2>Alertas</h2>
                        {data?.alerts?.length ? <div className="supervisor-table"><div className="supervisor-table-head hssa-alert-head"><span>Línea</span><span>Merma</span><span>Diferencia</span></div>{data.alerts.map((alert) => <article className="hssa-alert-row" key={alert.line}><span>{alert.line}</span><strong>{formatWeight(alert.weight)}</strong><span>{formatPercent(alert.differencePct)} por encima del promedio</span></article>)}</div> : <p className="supervisor-empty">Sin alertas en este período</p>}
                    </Card>
                </>}
            </>}
        </div>
    </AppLayout>;
}
