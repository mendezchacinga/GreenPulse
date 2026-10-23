import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AppLayout from "./AppLayout";
import { Card, formatMoney, formatPercent, formatWeight } from "./OperatorUI";
import "./supervisor-review.css";

const day = (offset = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
};
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const periods = [
    ["30", "Últimos 30 días", () => ({ from: day(-29), to: day(0) })],
    ["90", "Últimos 90 días", () => ({ from: day(-89), to: day(0) })],
    ["year", "Este año", () => ({ from: yearStart(), to: day(0) })]
];
const DEST_COLORS = ["#0F6B38", "#A64232", "#2D863B", "#4E6F82"];

async function api(path) {
    const response = await fetch(`/api/operations${path}`, { credentials: "include" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.message || "No se pudo cargar el resumen");
    return data;
}

function pctText(value) {
    return new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(Number(value || 0)));
}

function ChangeSentence({ value, upLabel = "Subieron", downLabel = "Bajaron" }) {
    if (value == null || Number.isNaN(Number(value))) return <small className="hssa-change flat"><Minus size={14} aria-hidden="true" />Sin comparación con el período anterior</small>;
    const amount = Number(value);
    if (amount === 0) return <small className="hssa-change flat"><Minus size={14} aria-hidden="true" />Sin cambio respecto al período anterior</small>;
    const tone = amount > 0 ? "up" : "down";
    const Icon = amount > 0 ? ArrowUpRight : ArrowDownRight;
    const verb = amount > 0 ? upLabel : downLabel;
    return <small className={`hssa-change ${tone}`}><Icon size={14} aria-hidden="true" />{verb} {pctText(amount)} % respecto al período anterior</small>;
}

function buildInsights(data) {
    if (!data || data.empty) return [];
    const phrases = [];
    const { kpis, charts } = data;
    const change = Number(kpis.totalLossChange);
    if (Number.isFinite(change) && kpis.totalLossKg > 0) {
        const verb = change > 0 ? "subieron" : change < 0 ? "bajaron" : "se mantuvieron";
        const linePart = kpis.topLine ? `; la línea con más pérdidas fue ${kpis.topLine.name}` : "";
        if (change === 0) phrases.push(`Las mermas se mantuvieron respecto al período anterior${linePart}`);
        else phrases.push(`Las mermas ${verb} un ${pctText(change)} % respecto al período anterior${linePart}`);
    }
    if (charts.byDestination.some((item) => item.weight > 0)) {
        phrases.push(`El ${pctText(kpis.recoveredPct)} % de los residuos despachados se aprovechó`);
    }
    if (kpis.hasDisposalCost && kpis.disposalCost > 0) {
        phrases.push(`La disposición final costó ${formatMoney(kpis.disposalCost)}`);
    }
    return phrases.slice(0, 3);
}

export default function ManagementSummary() {
    const [period, setPeriod] = useState("30");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const range = useMemo(() => periods.find(([value]) => value === period)[2](), [period]);
    const query = useMemo(() => new URLSearchParams(range).toString(), [range]);
    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError("");
        api(`/gerencia/resumen?${query}`).then((payload) => { if (alive) setData(payload); }).catch((reason) => { if (alive) setError(reason.message); }).finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [query]);
    const kpis = data?.kpis;
    const charts = data?.charts || { byWeek: [], byDestination: [], weekAverage: 0 };
    const empty = !loading && data?.empty;
    const insights = useMemo(() => buildInsights(data), [data]);
    const weekData = useMemo(() => charts.byWeek.map((item) => ({ ...item, average: charts.weekAverage })), [charts]);
    return <AppLayout role="gerencia" active="Resumen" title="Resumen gerencial" subtitle="Pérdidas, costos y aprovechamiento de los residuos de la planta">
        <div className="supervisor-page">
            <Card className="hssa-no-print">
                <div className="hssa-report-types" role="group" aria-label="Período">
                    {periods.map(([value, label]) => <button type="button" key={value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>{label}</button>)}
                </div>
            </Card>
            <p className="hssa-note">Incluye registros aprobados y corregidos</p>
            {error && <p className="supervisor-error" role="alert">{error}</p>}
            {loading ? <div className="supervisor-summary">{[1, 2, 3].map((item) => <Card className="supervisor-metric hssa-skeleton" key={item}><span /><b /></Card>)}</div> : empty ? <Card><p className="supervisor-empty">No hay datos en el período seleccionado</p></Card> : <>
                <div className="supervisor-summary" style={{ gridTemplateColumns: "repeat(3, minmax(140px, 1fr))" }}>
                    <Card className="supervisor-metric">
                        <span>Pérdidas por merma</span>
                        <b>{formatWeight(kpis?.totalLossKg)}</b>
                        <ChangeSentence value={kpis?.totalLossChange} />
                    </Card>
                    <Card className="supervisor-metric">
                        <span>Costo de disposición</span>
                        <b>{kpis?.hasDisposalCost ? formatMoney(kpis.disposalCost) : "Sin costos registrados en este período"}</b>
                        {kpis?.hasDisposalCost && <ChangeSentence value={kpis?.disposalCostChange} upLabel="Subió" downLabel="Bajó" />}
                    </Card>
                    <Card className="supervisor-metric">
                        <span>Material aprovechado</span>
                        <b>{formatPercent(kpis?.recoveredPct)}</b>
                        <div aria-hidden="true" style={{ marginTop: 12, height: 10, borderRadius: 999, background: "#e8eee9", overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, Math.max(0, Number(kpis?.recoveredPct || 0)))}%`, height: "100%", background: "#0F6B38" }} />
                        </div>
                        <ChangeSentence value={kpis?.recoveredChange} upLabel="Subió" downLabel="Bajó" />
                    </Card>
                </div>
                <div className="hssa-charts">
                    <Card>
                        <h2>Evolución de las mermas</h2>
                        <p className="hssa-chart-alt">Resumen: {weekData.map((item) => `semana ${item.week} ${formatWeight(item.weight)}`).join("; ") || "Sin datos"}. Promedio del período: {formatWeight(charts.weekAverage)}</p>
                        <div className="hssa-chart-box" role="img" aria-label="Gráfico de línea de evolución semanal de mermas">
                            <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={weekData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="week" label={{ value: "Semana", position: "insideBottom", offset: -2 }} />
                                    <YAxis label={{ value: "kg", angle: -90, position: "insideLeft" }} />
                                    <Tooltip formatter={(value, name) => [formatWeight(value), name === "average" ? "Promedio" : "Merma"]} />
                                    <Legend />
                                    <ReferenceLine y={charts.weekAverage} stroke="#6B796F" strokeDasharray="4 4" label="Promedio" />
                                    <Line type="monotone" dataKey="weight" name="Merma kg" stroke="#0F6B38" strokeWidth={2} dot />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                    <Card>
                        <h2>Destino de los residuos</h2>
                        <p className="hssa-chart-alt">Resumen: {charts.byDestination.map((item) => `${item.name} ${formatPercent(item.pct)} (${formatWeight(item.weight)})`).join("; ") || "Sin datos"}</p>
                        <div className="hssa-chart-box" role="img" aria-label="Gráfico de dona de destino de los residuos">
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie data={charts.byDestination} dataKey="weight" nameKey="name" innerRadius={55} outerRadius={90} label={(entry) => `${entry.name}: ${formatPercent(entry.pct)}`}>
                                        {charts.byDestination.map((item, index) => <Cell key={item.name} fill={DEST_COLORS[index % DEST_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(value, _name, props) => [formatWeight(value), `${props.payload.name} (${formatPercent(props.payload.pct)})`]} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
                {insights.length > 0 && <Card>
                    <h2>Lo más importante</h2>
                    <div>{insights.map((phrase) => <p key={phrase} style={{ margin: "10px 0 0", color: "#25392b", lineHeight: 1.5 }}>{phrase}</p>)}</div>
                </Card>}
            </>}
        </div>
    </AppLayout>;
}
