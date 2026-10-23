import { ArrowLeftRight, BarChart3, ClipboardCheck, ClipboardList, Droplets, Factory, FilePlus2, FileText, LayoutDashboard, LogOut, Menu, ShieldAlert, Timer, Users, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import "./operator-layout.css";

const menus = {
    operario: [{ label: "Registrar merma", href: "/operaciones", icon: FilePlus2 }, { label: "Mis registros", href: "/mis-registros", icon: ClipboardList }],
    supervisor: [{ label: "Revisar registros", href: "/supervisor/revision", icon: ClipboardCheck }, { label: "Producción", href: "/supervisor/produccion", icon: Factory }, { label: "Paradas", href: "/supervisor/paradas", icon: Timer }, { label: "Movimiento de residuos", href: "/supervisor/residuos", icon: ArrowLeftRight }],
    hssa: [{ label: "Tablero", href: "/hssa/tablero", icon: BarChart3 }, { label: "Efluentes", href: "/hssa/efluentes", icon: Droplets }, { label: "Reportes", href: "/hssa/reportes", icon: FileText }, { label: "Usuarios", href: "/hssa/usuarios", icon: Users }],
    gerencia: [{ label: "Resumen", href: "/gerencia/resumen", icon: LayoutDashboard }]
};
const homeByRole = { operario: "/operaciones", supervisor: "/supervisor/revision", hssa: "/hssa/tablero", gerencia: "/gerencia/resumen" };

export default function AppLayout({ title, subtitle, active, role = "operario", children }) {
    const [collapsed, setCollapsed] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [online, setOnline] = useState(navigator.onLine);
    const [profile, setProfile] = useState(null);
    useEffect(() => {
        let alive = true;
        fetch("/api/operations/profile", { credentials: "include" }).then((response) => response.ok ? response.json() : null).then((data) => {
            if (!alive || !data) return;
            if (data.role !== role) return window.location.replace(homeByRole[data.role] || "/");
            setProfile(data);
        }).catch(() => {});
        const update = () => setOnline(navigator.onLine);
        addEventListener("online", update); addEventListener("offline", update);
        return () => { alive = false; removeEventListener("online", update); removeEventListener("offline", update); };
    }, [role]);
    async function logout() { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); window.location.assign("/"); }
    const date = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "2-digit", month: "short" }).format(new Date());
    return <div className={`operator-app ${collapsed ? "is-collapsed" : ""}`}>
        <aside className="operator-sidebar"><a className="operator-brand" href={homeByRole[role]}><span><img src="/images/logo.png.png" alt="GreenPulse" /></span>{!collapsed && <div><b>GreenPulse</b><small>Lácteos Los Andes</small></div>}</a><nav>{(menus[role] || []).map(({ label, href, icon: Icon }) => <a href={href} className={active === label ? "is-active" : ""} key={label}><Icon size={20} />{!collapsed && label}</a>)}</nav></aside>
        <main className="operator-main"><header className="operator-header"><div className="operator-heading"><button className="operator-menu" aria-label="Mostrar u ocultar menú" onClick={() => setCollapsed(!collapsed)}><Menu size={21} /></button><div><h1>{title}</h1><p>{subtitle}</p></div></div><div className="operator-meta"><span className="operator-date">{date}</span><span className="operator-shift">Turno actual</span><span className="operator-user">{profile ? `${profile.name} · ${profile.area || profile.role}` : "Cargando usuario"}</span><span className={`operator-connection ${online ? "online" : "offline"}`}>{online ? "● Conectado" : <><WifiOff size={15} />Sin conexión</>}</span><button className="operator-logout" onClick={() => setConfirming(true)}><LogOut size={16} />Cerrar sesión</button></div></header><div className="operator-content">{children}</div></main>
        {confirming && <div className="operator-confirm" role="dialog" aria-modal="true" aria-labelledby="logout-title"><section><ShieldAlert size={23} /><h2 id="logout-title">¿Seguro que deseas cerrar sesión?</h2><p>Tendrás que iniciar sesión nuevamente para acceder a GreenPulse</p><div><button onClick={() => setConfirming(false)}>Cancelar</button><button onClick={logout}>Cerrar sesión</button></div></section></div>}
    </div>;
}
