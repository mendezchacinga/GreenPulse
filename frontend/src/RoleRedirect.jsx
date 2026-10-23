import { useEffect, useState } from "react";

const destinations = { operario: "/operaciones", supervisor: "/supervisor/revision", hssa: "/hssa/tablero", gerencia: "/gerencia/resumen" };

export default function RoleRedirect() {
    const [message, setMessage] = useState("Identificando tu perfil operativo…");
    useEffect(() => {
        fetch("/api/operations/profile", { credentials: "include" })
            .then(async (response) => { const data = await response.json(); if (!response.ok) throw Error(data.message); window.location.replace(destinations[data.role] || "/operaciones"); })
            .catch((error) => setMessage(error.message || "No fue posible cargar tu perfil."));
    }, []);
    return <main className="loading">{message}</main>;
}
