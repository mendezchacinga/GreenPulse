import { AlertCircle, Eye, EyeOff, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "./AppLayout";
import { Card } from "./OperatorUI";
import { HSSA_ROLES } from "./operationConstants";
import "./supervisor-review.css";

async function api(path, options = {}) {
    const response = await fetch(`/api/operations${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.message || "No se pudo completar la acción");
    return data;
}
const blank = { name: "", email: "", number: "", role: "operario", password: "" };

export default function HssaUsers() {
    const [users, setUsers] = useState([]);
    const [profile, setProfile] = useState(null);
    const [search, setSearch] = useState("");
    const [role, setRole] = useState("");
    const [status, setStatus] = useState("");
    const [drawer, setDrawer] = useState(null);
    const [editing, setEditing] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [toDelete, setToDelete] = useState(null);
    const [form, setForm] = useState(blank);
    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const load = () => api("/hssa/users").then(setUsers).catch((reason) => setError(reason.message));
    useEffect(() => { load(); fetch("/api/operations/profile", { credentials: "include" }).then((response) => response.ok ? response.json() : null).then(setProfile).catch(() => {}); }, []);
    useEffect(() => { const onKey = (event) => { if (event.key === "Escape") { setDrawer(null); setEditing(null); setConfirm(null); setToDelete(null); } }; addEventListener("keydown", onKey); return () => removeEventListener("keydown", onKey); }, []);
    useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(""), 3200); return () => clearTimeout(timer); }, [notice]);
    const visible = useMemo(() => users.filter((user) => {
        const term = search.trim().toLowerCase();
        const matchesSearch = !term || user.name?.toLowerCase().includes(term) || user.email?.toLowerCase().includes(term);
        const matchesRole = !role || user.role === role;
        const active = user.active !== false;
        const matchesStatus = !status || (status === "active" ? active : !active);
        return matchesSearch && matchesRole && matchesStatus;
    }), [users, search, role, status]);
    function validateCreate() {
        const next = {};
        if (!form.name.trim()) next.name = "Escribe el nombre completo";
        if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Escribe un correo válido";
        if (!form.number.trim()) next.number = "Escribe el teléfono";
        if (!form.role) next.role = "Selecciona un rol";

        if (!form.password || form.password.length < 6) next.password = "Escribe una contraseña de al menos 6 caracteres";
        setErrors(next);
        return !Object.keys(next).length;
    }
    async function createUser(event) {
        event.preventDefault();
        if (!validateCreate()) return;
        setBusy(true); setError("");
        try {
            const data = await api("/hssa/users", { method: "POST", body: JSON.stringify(form) });
            setNotice(data.message); setDrawer(null); setForm(blank); load();
        } catch (reason) { setError(reason.message); } finally { setBusy(false); }
    }
    async function saveEdit(event) {
        event.preventDefault();
        const next = {};
        if (!editing.number?.trim()) next.number = "Escribe el teléfono";

        if (!editing.role) next.role = "Selecciona un rol";
        setErrors(next);
        if (Object.keys(next).length) return;
        setBusy(true); setError("");
        try {
            const data = await api(`/hssa/users/${encodeURIComponent(editing.email)}`, { method: "PATCH", body: JSON.stringify({ role: editing.role, area: editing.area, number: editing.number }) });
            setNotice(data.message); setEditing(null); load();
        } catch (reason) { setError(reason.message); } finally { setBusy(false); }
    }
    async function toggleActive() {
        if (!confirm) return;
        setBusy(true); setError("");
        try {
            const data = await api(`/hssa/users/${encodeURIComponent(confirm.email)}`, { method: "PATCH", body: JSON.stringify({ active: confirm.active === false }) });
            setNotice(data.message); setConfirm(null); load();
        } catch (reason) { setError(reason.message); } finally { setBusy(false); }
    }
    async function deleteUser() {
        if (!toDelete) return;
        setBusy(true); setError("");
        try {
            const data = await api(`/hssa/users/${encodeURIComponent(toDelete.email)}`, { method: "DELETE" });
            setNotice(data.message); setToDelete(null); load();
        } catch (reason) { setError(reason.message); } finally { setBusy(false); }
    }
    const roleLabel = (value) => HSSA_ROLES.find(([key]) => key === value)?.[1] || value;
    const mine = (user) => profile?.email && user.email?.toLowerCase() === profile.email.toLowerCase();
    return <AppLayout role="hssa" active="Usuarios" title="Gestión de usuarios" subtitle="Administra los accesos, roles y áreas de la planta">
        <div className="supervisor-page">
            <Card>
                <div className="hssa-users-toolbar">
                    <div className="hssa-users-head"><h2>Usuarios</h2></div>
                    <div className="supervisor-filters" style={{ flex: 1 }}>
                        <div className="filter-field"><label htmlFor="user-search">Buscar</label><input id="user-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o correo" /></div>
                        <div className="filter-field"><label htmlFor="user-role">Rol</label><select id="user-role" value={role} onChange={(event) => setRole(event.target.value)}><option value="">Todos</option>{HSSA_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                        <div className="filter-field"><label htmlFor="user-status">Estado</label><select id="user-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="active">Activo</option><option value="inactive">Inactivo</option></select></div>
                    </div>
                    <button className="supervisor-primary" type="button" onClick={() => { setDrawer(true); setForm(blank); setErrors({}); }}>Crear usuario</button>
                </div>
            </Card>
            {notice && <p className="supervisor-toast" role="status">{notice}</p>}
            {error && <p className="supervisor-error" role="alert"><AlertCircle size={17} />{error}</p>}
            <Card className="supervisor-records">
                <div className="supervisor-table">
                    <div className="supervisor-table-head hssa-user-head"><span>Nombre</span><span>Correo</span><span>Teléfono</span><span>Rol</span><span>Estado</span><span>Acciones</span></div>
                    {visible.length ? visible.map((user) => <article className="hssa-user-row" key={user.email}>
                        <span>{user.name}</span><span>{user.email}</span><span>{user.number || "—"}</span><span>{roleLabel(user.role)}</span>
                        <span>{user.active === false ? "Inactivo" : "Activo"}</span>
                        <div className="supervisor-actions">
                            <button type="button" onClick={() => { setEditing({ ...user }); setErrors({}); }}>Editar</button>
                            <button type="button" className="supervisor-reject" disabled={mine(user) && user.active !== false} onClick={() => setConfirm(user)}>{user.active === false ? "Activar" : "Desactivar"}</button>
                            <button type="button" className="supervisor-reject-fill" disabled={mine(user)} onClick={() => setToDelete(user)}>Eliminar</button>
                        </div>
                    </article>) : <p className="supervisor-empty">No hay usuarios con estos filtros</p>}
                </div>
            </Card>
        </div>
        {drawer && <div className="supervisor-overlay"><aside className="supervisor-drawer hssa-side-panel" role="dialog" aria-modal="true" aria-labelledby="create-user-title"><header><h2 id="create-user-title">Crear usuario</h2><button aria-label="Cerrar" onClick={() => setDrawer(null)}><X size={20} /></button></header><form onSubmit={createUser}><label htmlFor="create-name">Nombre completo<input id="create-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} aria-invalid={!!errors.name} />{errors.name && <small className="supervisor-error">{errors.name}</small>}</label><label htmlFor="create-email">Correo electrónico<input id="create-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} aria-invalid={!!errors.email} />{errors.email && <small className="supervisor-error">{errors.email}</small>}</label><label htmlFor="create-number">Teléfono<input id="create-number" value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} aria-invalid={!!errors.number} />{errors.number && <small className="supervisor-error">{errors.number}</small>}</label><label htmlFor="create-role">Rol<select id="create-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{HSSA_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{errors.role && <small className="supervisor-error">{errors.role}</small>}</label><label htmlFor="create-password">Contraseña temporal<div className="supervisor-password" style={{ position: "relative" }}><input id="create-password" type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} aria-invalid={!!errors.password} style={{ paddingRight: "2.5rem" }} autoComplete="new-password" />{errors.password && <small className="supervisor-error">{errors.password}</small>}<button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword((value) => !value)} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", cursor: "pointer", color: "#536359", display: "grid", placeItems: "center", width: "28px", height: "28px" }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label><footer><button type="button" onClick={() => setDrawer(null)}>Cancelar</button><button className="supervisor-primary" disabled={busy}>Crear usuario</button></footer></form></aside></div>}
        {editing && <div className="supervisor-overlay"><aside className="supervisor-drawer hssa-side-panel" role="dialog" aria-modal="true" aria-labelledby="edit-user-title"><header><h2 id="edit-user-title">Editar usuario</h2><button aria-label="Cerrar" onClick={() => setEditing(null)}><X size={20} /></button></header><form onSubmit={saveEdit}><p>{editing.name} · {editing.email}</p><label htmlFor="edit-number">Teléfono<input id="edit-number" value={editing.number || ""} onChange={(event) => setEditing({ ...editing, number: event.target.value })} />{errors.number && <small className="supervisor-error">{errors.number}</small>}</label><label htmlFor="edit-role">Rol<select id="edit-role" value={editing.role} disabled={mine(editing)} onChange={(event) => setEditing({ ...editing, role: event.target.value })}>{HSSA_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{errors.role && <small className="supervisor-error">{errors.role}</small>}</label><footer><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="supervisor-primary" disabled={busy}>Guardar cambios</button></footer></form></aside></div>}
        {confirm && <div className="supervisor-overlay"><section className="supervisor-dialog" role="dialog" aria-modal="true" aria-labelledby="toggle-user-title"><header><h2 id="toggle-user-title">{confirm.active === false ? "Activar usuario" : "Desactivar usuario"}</h2><button aria-label="Cerrar" onClick={() => setConfirm(null)}><X size={20} /></button></header><p>{confirm.active === false ? `¿Activar a ${confirm.name}?` : `¿Desactivar a ${confirm.name}? El usuario no podrá iniciar sesión y sus registros se conservan`}</p><footer><button type="button" onClick={() => setConfirm(null)}>Cancelar</button><button className={confirm.active === false ? "supervisor-primary" : "supervisor-reject-fill"} disabled={busy} onClick={toggleActive}>{confirm.active === false ? "Aceptar" : "Desactivar"}</button></footer></section></div>}
        {toDelete && <div className="supervisor-overlay"><section className="supervisor-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-user-title"><header><h2 id="delete-user-title">Eliminar usuario</h2><button aria-label="Cerrar" onClick={() => setToDelete(null)}><X size={20} /></button></header><p>¿Eliminar definitivamente a {toDelete.name}? Esta acción no se puede deshacer.</p><footer><button type="button" onClick={() => setToDelete(null)}>Cancelar</button><button className="supervisor-reject-fill" disabled={busy} onClick={deleteUser}>Eliminar</button></footer></section></div>}
    </AppLayout>;
}
