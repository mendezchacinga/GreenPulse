import { useEffect, useState } from "react";
import { LogOut, ShieldAlert } from "lucide-react";

export default function EnterpriseActions() {
    const [confirming, setConfirming] = useState(false);
    const [operationRole, setOperationRole] = useState(null);
    const toggleNavigation = () => {
        const sidebar = document.querySelector("#root aside");
        const content = document.querySelector("#root main");
        if (!sidebar) return;
        const hidden = sidebar.dataset.hidden === "true";
        sidebar.dataset.hidden = hidden ? "false" : "true";
        sidebar.style.transform = hidden ? "translateX(0)" : "translateX(-100%)";
        if (content) content.style.marginLeft = hidden ? "" : "0";
    };
    const logout = async () => {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        window.location.assign("/");
    };
    useEffect(() => {
        const originalMenu = document.querySelector("#root main header svg");
        if (!originalMenu) return undefined;
        const sidebar = document.querySelector("#root aside");
        const content = document.querySelector("#root main");
        if (sidebar && !sidebar.dataset.initialized) {
            sidebar.dataset.initialized = "true";
            sidebar.dataset.hidden = "true";
            sidebar.style.transform = "translateX(-100%)";
            if (content) content.style.marginLeft = "0";
        }
        originalMenu.style.cursor = "pointer";
        originalMenu.addEventListener("click", toggleNavigation);
        return () => originalMenu.removeEventListener("click", toggleNavigation);
    });
    useEffect(() => {
        let cleanup = () => {};
        fetch("/api/operations/profile", { credentials: "include" }).then((response) => response.ok ? response.json() : null).then((profile) => {
            if (!profile) return;
            setOperationRole(profile.role);
            if (profile.role === "operario") {
                window.location.replace("/operaciones");
                return;
            }
            document.querySelectorAll("#root main h3").forEach((heading) => {
                if (heading.textContent.trim() === "Captura rÃ¡pida de merma" || heading.textContent.trim() === "Captura rápida de merma") heading.textContent = "Registro rápido de merma";
            });
            document.querySelectorAll("#root main p").forEach((paragraph) => {
                if (paragraph.textContent.includes("directamente al supervisor")) paragraph.textContent = paragraph.textContent.replace("para validación", "para la validación").replace(/\.$/, "");
                if (paragraph.textContent.includes("Lectura consolidada")) paragraph.remove();
            });
            const dashboardHeader = document.querySelector("#root main header > div:last-child");
            document.querySelectorAll("#root main header button, #root main header a").forEach((control) => {
                const label = control.textContent.trim();
                if (label === "Actualizar" || label === "Ver mis registros") control.style.display = "none";
            });
            const logoutControl = Array.from(document.querySelectorAll("#root > button")).find((button) => button.textContent.includes("Cerrar sesiÃ³n") || button.textContent.includes("Cerrar sesión"));
            if (dashboardHeader && logoutControl) {
                dashboardHeader.appendChild(logoutControl);
                logoutControl.style.position = "static";
                logoutControl.style.inset = "auto";
                logoutControl.style.margin = "0";
                logoutControl.style.background = "#2D863B";
                logoutControl.style.boxShadow = "none";
            }
            if (profile.role === "operario") {
                const restricted = ["Acopio y despacho", "Turnos", "CatÃ¡logos", "Catálogos"];
                document.querySelectorAll("#root aside nav button").forEach((button) => {
                    if (restricted.includes(button.textContent.trim())) button.style.display = "none";
                });
                const nav = document.querySelector("#root aside nav");
                if (nav && !Array.from(nav.querySelectorAll("button")).some((button) => button.textContent.trim() === "Registros")) {
                    const source = nav.querySelector("button");
                    const item = document.createElement("button");
                    item.className = source?.className || "";
                    item.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect><path d="M9 2v20"></path><path d="M14 7h2"></path><path d="M14 11h2"></path><path d="M14 15h2"></path></svg><span>Registros</span>';
                    item.addEventListener("click", () => window.location.assign("/mis-registros"));
                    nav.insertBefore(item, nav.children[2] || null);
                }
            }
            const roleButtons = ["Operario", "Supervisor", "HSSA", "Gerencia"];
            document.querySelectorAll("#root main button").forEach((button) => {
                if (roleButtons.includes(button.textContent.trim())) button.parentElement.style.display = "none";
            });
            const destinations = { operario: "/operaciones", supervisor: "/supervisor", hssa: "/hssa/tablero", gerencia: "/gerencia/resumen" };
            const navigation = { "Tablero": profile.role === "operario" ? "/mis-registros" : "/enterprise", "Mermas": destinations[profile.role], "Acopio y despacho": profile.role === "supervisor" ? "/supervisor" : destinations[profile.role], "Turnos": profile.role === "supervisor" ? "/supervisor" : destinations[profile.role], "Catálogos": profile.role === "hssa" ? "/hssa/tablero" : destinations[profile.role] };
            const handlers = [];
            document.querySelectorAll("#root aside nav button").forEach((button) => {
                if (["Tablero", "Registros"].includes(button.textContent.trim())) button.style.background = "transparent";
                const destination = navigation[button.textContent.trim()];
                if (!destination) return;
                const handler = () => window.location.assign(destination);
                button.addEventListener("click", handler);
                handlers.push([button, handler]);
            });
            document.querySelectorAll("#root button").forEach((button) => {
                if (!button.textContent.includes("3 registros pendientes")) return;
                const handler = () => window.location.assign("/mis-registros?status=pending");
                button.style.cursor = "pointer";
                button.addEventListener("click", handler);
                handlers.push([button, handler]);
            });
            cleanup = () => handlers.forEach(([button, handler]) => button.removeEventListener("click", handler));
        });
        return () => cleanup();
    }, []);
    useEffect(() => {
        const root = document.querySelector("#root");
        if (!root) return undefined;
        const clearSuccess = () => {
            root.querySelectorAll("p").forEach((message) => {
                if (!message.textContent.includes("Merma registrada correctamente")) return;
                window.setTimeout(() => message.remove(), 2600);
            });
        };
        const observer = new MutationObserver(clearSuccess);
        observer.observe(root, { childList: true, subtree: true, characterData: true });
        clearSuccess();
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        if (!operationRole) return undefined;
        const destinations = { operario: "/operaciones", supervisor: "/supervisor", hssa: "/hssa/tablero", gerencia: "/gerencia/resumen" };
        const clickMenu = (event) => {
            const button = event.target.closest("#root aside nav button");
            if (!button) return;
            const label = button.textContent.trim();
            const navigation = { "Tablero": operationRole === "operario" ? "/mis-registros" : "/enterprise", "Mermas": destinations[operationRole], "Acopio y despacho": operationRole === "supervisor" ? "/supervisor" : destinations[operationRole], "Turnos": operationRole === "supervisor" ? "/supervisor" : destinations[operationRole], "Catálogos": operationRole === "hssa" ? "/hssa/tablero" : destinations[operationRole] };
            if (!navigation[label]) return;
            event.preventDefault();
            event.stopPropagation();
            window.location.assign(navigation[label]);
        };
        document.addEventListener("click", clickMenu, true);
        return () => document.removeEventListener("click", clickMenu, true);
    }, [operationRole]);
    return <><button onClick={() => setConfirming(true)} className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-lg bg-[#0F6B38] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#2D863B]"><LogOut size={17} />Cerrar sesión</button>{confirming && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 p-4 backdrop-blur-[2px]"><section role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl"><span className="grid h-11 w-11 place-items-center rounded-full bg-amber-50 text-[#E69F00]"><ShieldAlert size={22}/></span><h2 className="mt-4 text-lg font-semibold text-slate-900">¿Estás seguro de que quieres salir?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Tendrás que volver a iniciar sesión para acceder a la operación de GreenPulse.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setConfirming(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button><button onClick={logout} className="rounded-lg bg-[#0F6B38] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2D863B]">Cerrar sesión</button></div></section></div>}</>;
}
