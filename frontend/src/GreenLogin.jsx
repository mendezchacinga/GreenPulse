import { AlertCircle, ArrowLeft, Eye, EyeOff, Leaf, Loader2 } from "lucide-react";
import { useState } from "react";
import "./styles/tokens.css";
import "./green-login.css";

export default function GreenLogin() {
    const [showPassword, setShowPassword] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [fieldErrors, setFieldErrors] = useState({});
    async function submit(event) {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        const next = {};
        if (!values.email?.trim()) next.email = "Escribe tu correo";
        if (!values.password) next.password = "Escribe tu contraseña";
        setFieldErrors(next); setError("");
        if (Object.keys(next).length) return;
        setBusy(true);
        try {
            const response = await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw Error(data.message || "Correo o contraseña incorrectos");
            const homes = { user: "/home", driver: "/driver/dashboard", admin: "/admin/dashboard" };
            window.location.assign(homes[data.role] || "/home");
        } catch (requestError) { setError(requestError.message || "Correo o contraseña incorrectos"); } finally { setBusy(false); }
    }
    return <main className="green-login"><section className="login-image-panel"><img src="/images/login-panel-1200.webp" alt=""/><div className="login-image-overlay"/><a className="login-panel-brand" href="/"><img src="/images/logo.png.png" alt="GreenPulse"/><b>GreenPulse</b></a><div className="login-panel-copy"><h1>Registra, valida y controla los residuos de tu planta</h1><span>Lácteos Los Andes</span></div><div className="login-panel-strip">Registro · Validación · Acopio · Indicadores</div></section><section className="login-form-panel"><div className="login-form-wrap"><a className="login-mobile-brand" href="/"><Leaf size={19}/><b>GreenPulse</b></a><div className="login-heading"><span>GESTIÓN RESPONSABLE</span><h1>Iniciar sesión</h1><p>Ingresa con tus credenciales para continuar</p></div><form onSubmit={submit} noValidate><label htmlFor="login-email">Correo electrónico</label><input id="login-email" name="email" type="email" autoComplete="email" autoFocus aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "login-email-error" : undefined}/>{fieldErrors.email && <small id="login-email-error" className="login-field-error"><AlertCircle size={15}/>{fieldErrors.email}</small>}<label htmlFor="login-password">Contraseña</label><div className="login-password"><input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "login-password-error" : undefined}/><button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div>{fieldErrors.password && <small id="login-password-error" className="login-field-error"><AlertCircle size={15}/>{fieldErrors.password}</small>}{error && <p role="alert" className="login-error"><AlertCircle size={17}/>{error}</p>}<button className="login-submit" disabled={busy}>{busy && <Loader2 className="login-spinner" size={17}/>} {busy ? "Ingresando..." : "Iniciar sesión"}</button></form><a className="login-back" href="/"><ArrowLeft size={16}/>Volver al inicio</a></div></section></main>;
}
