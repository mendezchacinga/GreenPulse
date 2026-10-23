import { AlertCircle, CheckCircle2, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "./AppLayout";
import { Card, formatDate, formatTime } from "./OperatorUI";
import "./supervisor-review.css";

const nowLocal = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
};
async function api(path, options = {}) {
    const response = await fetch(`/api/operations${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.message || "No se pudo completar la acción");
    return data;
}
const formatValue = (value, unit) => `${new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))} ${unit || ""}`.trim();

export default function HssaEffluents() {
    const [catalog, setCatalog] = useState({ points: [], parameters: [] });
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState({ monthTotal: 0, fulfill: 0, fail: 0, compliancePct: 0 });
    const [profile, setProfile] = useState(null);
    const [filters, setFilters] = useState({ from: "", to: "", point: "", result: "" });
    const [form, setForm] = useState({ measuredAt: nowLocal(), point: "", parameter: "", value: "", limit: "", observation: "" });
    const [catalogForm, setCatalogForm] = useState({ kind: "point", name: "", unit: "", defaultLimit: "" });
    const [correcting, setCorrecting] = useState(null);
    const [reason, setReason] = useState("");
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const selectedParam = catalog.parameters.find((item) => item.name === form.parameter);
    const measured = Number(form.value);
    const limitValue = form.limit === "" ? null : Number(form.limit);
    const liveResult = !Number.isFinite(measured) ? null : limitValue == null || !Number.isFinite(limitValue) ? "cumple" : measured <= limitValue ? "cumple" : "no_cumple";
    const load = () => {
        api("/effluent-catalog").then(setCatalog).catch((reason) => setError(reason.message));
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
        api(`/effluents?${params}`).then((data) => { setItems(data.items || []); setSummary(data.summary || { monthTotal: 0, fulfill: 0, fail: 0, compliancePct: 0 }); }).catch((reason) => setError(reason.message));
    };
    useEffect(load, [filters.from, filters.to, filters.point, filters.result]);
    useEffect(() => { fetch("/api/operations/profile", { credentials: "include" }).then((response) => response.ok ? response.json() : null).then(setProfile).catch(() => {}); }, []);
    useEffect(() => { if (!selectedParam) return; setForm((current) => ({ ...current, limit: selectedParam.defaultLimit == null ? "" : String(selectedParam.defaultLimit) })); }, [form.parameter]);
    useEffect(() => { const onKey = (event) => { if (event.key === "Escape") setCorrecting(null); }; addEventListener("keydown", onKey); return () => removeEventListener("keydown", onKey); }, []);
    useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(""), 3200); return () => clearTimeout(timer); }, [notice]);
    function choose(key, value) { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: "" })); }
    async function submit(event) {
        event.preventDefault();
        const next = {};
        if (!form.point) next.point = "Selecciona un punto de descarga";
        if (!form.parameter) next.parameter = "Selecciona un parámetro";
        if (!(Number(form.value) >= 0) || form.value === "") next.value = "Escribe el valor medido";
        setErrors(next);
        if (Object.keys(next).length) return;
        setBusy(true); setError("");
        try {
            const data = await api("/effluents", { method: "POST", body: JSON.stringify({ ...form, unit: selectedParam?.unit || "", limit: form.limit === "" ? null : Number(form.limit) }) });
            setNotice(data.message);
            setForm({ measuredAt: nowLocal(), point: form.point, parameter: "", value: "", limit: "", observation: "" });
            load();
        } catch (reason) { setError(reason.message); } finally { setBusy(false); }
    }
    async function saveCatalog(event) {
        event.preventDefault();
        setBusy(true); setError("");
        try {
            await api("/effluent-catalog", { method: "POST", body: JSON.stringify(catalogForm) });
            setNotice("Catálogo actualizado");
            setCatalogForm({ kind: catalogForm.kind, name: "", unit: "", defaultLimit: "" });
            load();
        } catch (reason) { setError(reason.message); } finally { setBusy(false); }
    }
    async function saveCorrection(event) {
        event.preventDefault();
        if (reason.trim().length < 10) return setError("Escribe un motivo de al menos 10 caracteres");
        setBusy(true); setError("");
        try {
            const data = await api("/effluents", {
                method: "POST",
                body: JSON.stringify({
                    measuredAt: form.measuredAt || correcting.measuredAt,
                    point: form.point || correcting.point,
                    parameter: form.parameter || correcting.parameter,
                    value: form.value === "" ? correcting.value : Number(form.value),
                    limit: form.limit === "" ? correcting.limit : Number(form.limit),
                    unit: selectedParam?.unit || correcting.unit,
                    observation: form.observation,
                    correctionOf: correcting._id,
                    correctionReason: reason.trim()
                })
            });
            setNotice(data.message); setCorrecting(null); setReason(""); load();
        } catch (reasonText) { setError(reasonText.message); } finally { setBusy(false); }
    }
    const openCorrection = (item) => {
        setCorrecting(item);
        setReason("");
        setForm({ measuredAt: nowLocal(), point: item.point, parameter: item.parameter, value: String(item.value), limit: item.limit == null ? "" : String(item.limit), observation: "" });
    };
    return <AppLayout role="hssa" active="Efluentes" title="Bitácora de efluentes" subtitle="Registra las mediciones y verifica el cumplimiento de los límites">
        <div className="supervisor-page">
            <div className="supervisor-summary">
                <Card className="supervisor-metric"><span>Mediciones del mes</span><b>{summary.monthTotal}</b></Card>
                <Card className="supervisor-metric approved"><span>Cumplen</span><b>{summary.fulfill}</b></Card>
                <Card className="supervisor-metric rejected"><span>No cumplen</span><b>{summary.fail}</b></Card>
                <Card className="supervisor-metric"><span>% de cumplimiento</span><b>{new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(summary.compliancePct)} %</b></Card>
            </div>
            {notice && <p className="supervisor-toast" role="status">{notice}</p>}
            {error && <p className="supervisor-error" role="alert"><AlertCircle size={17} />{error}</p>}
            <div className="hssa-charts">
                <Card className="supervisor-form-card">
                    <h2>Nueva medición</h2>
                    <form className="supervisor-drawer" style={{ boxShadow: "none", width: "100%", padding: 0, minHeight: 0 }} onSubmit={submit}>
                        <label htmlFor="eff-datetime">Fecha y hora<input id="eff-datetime" type="datetime-local" value={form.measuredAt} onChange={(event) => choose("measuredAt", event.target.value)} /></label>
                        <div className="filter-field"><label htmlFor="eff-point">Punto de descarga</label><select id="eff-point" value={form.point} onChange={(event) => choose("point", event.target.value)}><option value="">Selecciona</option>{catalog.points.map((item) => <option key={item._id || item.name} value={item.name}>{item.name}{item.example ? " (ejemplo)" : ""}</option>)}</select>{errors.point && <small className="supervisor-error">{errors.point}</small>}</div>
                        <div className="filter-field"><label htmlFor="eff-param">Parámetro medido</label><select id="eff-param" value={form.parameter} onChange={(event) => choose("parameter", event.target.value)}><option value="">Selecciona</option>{catalog.parameters.map((item) => <option key={item._id || item.name} value={item.name}>{item.name}{item.example ? " (ejemplo · sin límite oficial)" : ""}</option>)}</select>{errors.parameter && <small className="supervisor-error">{errors.parameter}</small>}</div>
                        <label htmlFor="eff-value">Valor medido ({selectedParam?.unit || "unidad"})<input id="eff-value" inputMode="decimal" type="number" step="0.01" value={form.value} onChange={(event) => choose("value", event.target.value)} />{errors.value && <small className="supervisor-error">{errors.value}</small>}</label>
                        <label htmlFor="eff-limit">Límite permitido{selectedParam?.example ? " (ejemplo · editable)" : ""}<input id="eff-limit" inputMode="decimal" type="number" step="0.01" value={form.limit} onChange={(event) => choose("limit", event.target.value)} placeholder="Sin límite oficial" /></label>
                        <label>Responsable<input value={profile?.name || "Cargando"} readOnly /></label>
                        <label htmlFor="eff-obs">Observación<textarea id="eff-obs" value={form.observation} onChange={(event) => choose("observation", event.target.value)} /></label>
                        {liveResult && <p className={`hssa-result ${liveResult === "cumple" ? "ok" : "bad"}`} role="status">{liveResult === "cumple" ? <><CheckCircle2 size={18} />Cumple</> : <><XCircle size={18} />No cumple</>}</p>}
                        <button className="supervisor-primary" disabled={busy}>Guardar medición</button>
                    </form>
                </Card>
                <Card>
                    <h2>Catálogo</h2>
                    <p className="hssa-note">Los elementos marcados como ejemplo no son límites oficiales</p>
                    <form className="supervisor-drawer" style={{ boxShadow: "none", width: "100%", padding: 0, minHeight: 0 }} onSubmit={saveCatalog}>
                        <div className="filter-field"><label htmlFor="cat-kind">Tipo</label><select id="cat-kind" value={catalogForm.kind} onChange={(event) => setCatalogForm({ ...catalogForm, kind: event.target.value })}><option value="point">Punto de descarga</option><option value="parameter">Parámetro</option></select></div>
                        <label htmlFor="cat-name">Nombre<input id="cat-name" value={catalogForm.name} onChange={(event) => setCatalogForm({ ...catalogForm, name: event.target.value })} required /></label>
                        {catalogForm.kind === "parameter" && <>
                            <label htmlFor="cat-unit">Unidad<input id="cat-unit" value={catalogForm.unit} onChange={(event) => setCatalogForm({ ...catalogForm, unit: event.target.value })} required /></label>
                            <label htmlFor="cat-limit">Límite por defecto<input id="cat-limit" type="number" step="0.01" value={catalogForm.defaultLimit} onChange={(event) => setCatalogForm({ ...catalogForm, defaultLimit: event.target.value })} placeholder="Vacío si no hay límite oficial" /></label>
                        </>}
                        <button className="supervisor-primary" disabled={busy}>Agregar al catálogo</button>
                    </form>
                    <div className="supervisor-table" style={{ marginTop: 16 }}>
                        <div className="supervisor-table-head hssa-alert-head"><span>Elemento</span><span>Detalle</span><span>Nota</span></div>
                        {catalog.points.map((item) => <article className="hssa-alert-row" key={`p-${item.name}`}><span>{item.name}</span><span>Punto</span><span>{item.example ? "Ejemplo" : "Catalogado"}</span></article>)}
                        {catalog.parameters.map((item) => <article className="hssa-alert-row" key={`m-${item.name}`}><span>{item.name}</span><span>{item.unit} · límite {item.defaultLimit == null ? "vacío" : item.defaultLimit}</span><span>{item.example ? "Ejemplo · sin límite oficial" : "Catalogado"}</span></article>)}
                    </div>
                </Card>
            </div>
            <Card className="supervisor-filters">
                <div className="filter-field"><label htmlFor="eff-from">Desde</label><input id="eff-from" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></div>
                <div className="filter-field"><label htmlFor="eff-to">Hasta</label><input id="eff-to" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></div>
                <div className="filter-field"><label htmlFor="eff-filter-point">Punto</label><select id="eff-filter-point" value={filters.point} onChange={(event) => setFilters({ ...filters, point: event.target.value })}><option value="">Todos</option>{catalog.points.map((item) => <option key={item.name}>{item.name}</option>)}</select></div>
                <div className="filter-field"><label htmlFor="eff-filter-result">Resultado</label><select id="eff-filter-result" value={filters.result} onChange={(event) => setFilters({ ...filters, result: event.target.value })}><option value="">Todos</option><option value="cumple">Cumple</option><option value="no_cumple">No cumple</option></select></div>
                <button className="supervisor-clear" type="button" onClick={() => setFilters({ from: "", to: "", point: "", result: "" })}>Limpiar filtros</button>
            </Card>
            <Card className="supervisor-records">
                <div className="supervisor-table">
                    <div className="supervisor-table-head hssa-effluent-head"><span>Fecha</span><span>Punto</span><span>Parámetro</span><span>Valor</span><span>Límite</span><span>Resultado</span><span>Responsable</span><span>Acciones</span></div>
                    {items.length ? items.map((item) => <article className={`hssa-effluent-row ${item.result === "no_cumple" ? "hssa-fail-row" : ""}`} key={item._id}>
                        <time>{formatDate(item.measuredAt)} {formatTime(item.measuredAt)}</time>
                        <span>{item.point}</span><span>{item.parameter}</span>
                        <strong>{formatValue(item.value, item.unit)}</strong>
                        <span>{item.limit == null ? "—" : formatValue(item.limit, item.unit)}</span>
                        <span className={`hssa-result ${item.result === "cumple" ? "ok" : "bad"}`}>{item.result === "cumple" ? <><CheckCircle2 size={16} />Cumple</> : <><XCircle size={16} />No cumple</>}</span>
                        <span>{item.responsible}</span>
                        <div className="supervisor-actions"><button type="button" onClick={() => openCorrection(item)}>Corregir</button></div>
                    </article>) : <p className="supervisor-empty">No hay mediciones con estos filtros</p>}
                </div>
            </Card>
        </div>
        {correcting && <div className="supervisor-overlay"><aside className="supervisor-drawer" role="dialog" aria-modal="true" aria-labelledby="correction-effluent-title"><header><h2 id="correction-effluent-title">Corrección de medición</h2><button aria-label="Cerrar" onClick={() => setCorrecting(null)}><X size={20} /></button></header><p>Se conserva el registro original de {correcting.parameter} en {correcting.point}</p><form onSubmit={saveCorrection}><label htmlFor="corr-value">Valor medido<input id="corr-value" type="number" step="0.01" value={form.value} onChange={(event) => choose("value", event.target.value)} /></label><label htmlFor="corr-limit">Límite<input id="corr-limit" type="number" step="0.01" value={form.limit} onChange={(event) => choose("limit", event.target.value)} /></label><label htmlFor="corr-reason">Motivo de la corrección<textarea id="corr-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} required /></label><footer><button type="button" onClick={() => setCorrecting(null)}>Cancelar</button><button className="supervisor-primary" disabled={busy}>Guardar corrección</button></footer></form></aside></div>}
    </AppLayout>;
}
