import { useMemo, useState } from "react";

const materialNames = ["Bolsas plásticas", "Bolsas de papel", "Barredura", "Poli film"];
const materialKeys = ["total_plastic_bags", "total_paper_bags", "total_sweepings", "total_poly_film"];

export default function OperationalDashboard({ stats = {}, role = "user", onCreateRequest }) {
    const [period, setPeriod] = useState("Esta semana");
    const [showMaterials, setShowMaterials] = useState(true);
    const total = stats.total_requests || 0;
    const resolved = stats.total_resolved || 0;
    const resolutionRate = total ? Math.round((resolved / total) * 100) : 0;
    const roleLabel = { user: "Operación", driver: "Ruta", admin: "Administración" }[role] || "Operación";
    const materials = useMemo(() => materialNames.map((name, index) => ({ name, value: stats[materialKeys[index]] || 0 })), [stats]);

    return (
        <section className="mx-auto max-w-7xl space-y-6 text-zinc-900">
            <header className="flex flex-col justify-between gap-5 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end">
                <div>
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-500 opacity-50" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime-600" /></span>
                        GreenPulse · {roleLabel} activa
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">Pulso de la operación</h1>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">Una lectura clara de los reportes de residuos y del avance de su gestión.</p>
                </div>
                <div className="flex items-center gap-3">
                    <select value={period} onChange={(event) => setPeriod(event.target.value)} className="border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 outline-none transition-colors hover:border-zinc-400 focus:border-lime-700">
                        <option>Esta semana</option><option>Este mes</option><option>Este trimestre</option>
                    </select>
                    {onCreateRequest && <button onClick={onCreateRequest} className="bg-lime-700 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-lime-800 hover:-translate-y-0.5">+ Registrar residuo</button>}
                </div>
            </header>

            <div className="grid gap-px overflow-hidden border border-zinc-200 bg-zinc-200 md:grid-cols-12">
                <article className="bg-white p-5 md:col-span-5 lg:p-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Reportes registrados</p>
                    <div className="mt-6 flex items-end justify-between"><strong className="text-5xl font-semibold tracking-tight text-zinc-950">{total}</strong><span className="mb-1 border border-lime-200 bg-lime-50 px-2 py-1 text-xs font-semibold text-lime-800">{period}</span></div>
                    <div className="mt-7 h-1.5 w-full bg-zinc-100"><div className="h-full bg-lime-600 transition-all duration-500" style={{ width: `${Math.max(resolutionRate, 3)}%` }} /></div>
                    <p className="mt-3 text-sm text-zinc-500"><span className="font-semibold text-zinc-800">{resolutionRate}%</span> de los reportes ha finalizado su gestión.</p>
                </article>
                <article className="bg-zinc-950 p-5 text-white md:col-span-4 lg:p-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Atención requerida</p>
                    <strong className="mt-6 block text-5xl font-semibold tracking-tight">{stats.total_pending || 0}</strong>
                    <p className="mt-7 border-t border-white/15 pt-3 text-sm leading-6 text-zinc-300">Reportes pendientes de atención o seguimiento.</p>
                </article>
                <article className="bg-white p-5 md:col-span-3 lg:p-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Gestión completada</p>
                    <strong className="mt-6 block text-5xl font-semibold tracking-tight text-zinc-950">{resolved}</strong>
                    <p className="mt-7 border-t border-zinc-200 pt-3 text-sm text-zinc-500">Reportes resueltos en el periodo.</p>
                </article>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                <section className="border border-zinc-200 bg-white p-5 lg:col-span-8 lg:p-7">
                    <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold tracking-tight">Materiales reportados</h2><p className="mt-1 text-sm text-zinc-500">Distribución actual por tipo de residuo.</p></div><button onClick={() => setShowMaterials(!showMaterials)} className="text-sm font-medium text-zinc-600 transition-colors hover:text-lime-700">{showMaterials ? "Ocultar detalle" : "Ver detalle"}</button></div>
                    {showMaterials && <div className="mt-6 space-y-4">{materials.map((material, index) => { const width = total ? Math.max(5, Math.round((material.value / total) * 100)) : 5; return <div key={material.name}><div className="mb-2 flex justify-between text-sm"><span className="font-medium text-zinc-700"><span className="mr-2 text-zinc-400">0{index + 1}</span>{material.name}</span><strong className="font-semibold text-zinc-950">{material.value}</strong></div><div className="h-1.5 bg-zinc-100"><div className="h-full bg-lime-600 transition-all duration-500" style={{ width: `${width}%` }} /></div></div>; })}</div>}
                </section>
                <aside className="border border-zinc-200 bg-stone-100 p-5 lg:col-span-4 lg:p-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Siguiente prioridad</p>
                    <h2 className="mt-3 text-xl font-semibold leading-7 tracking-tight text-zinc-900">Da seguimiento a los reportes pendientes.</h2>
                    <p className="mt-3 text-sm leading-6 text-zinc-600">Mantener la atención al día mejora la trazabilidad de toda la operación.</p>
                    <div className="mt-6 flex items-center gap-2 border-t border-zinc-300 pt-4 text-sm font-medium text-zinc-700"><span className="h-2 w-2 rounded-full bg-amber-500" /> {stats.total_pending || 0} pendientes por revisar</div>
                </aside>
            </div>
        </section>
    );
}
