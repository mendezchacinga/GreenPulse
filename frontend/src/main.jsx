import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import LegacyHome from "./LegacyHome";
import OperationsConsole from "./OperationsConsole";
import HssaDashboard from "./HssaDashboard";
import HssaEffluents from "./HssaEffluents";
import HssaReports from "./HssaReports";
import HssaUsers from "./HssaUsers";
import ManagementSummary from "./ManagementSummary";
import RoleRedirect from "./RoleRedirect";
import SupervisorConsole from "./SupervisorConsole";
import SupervisorMovements from "./SupervisorMovements";
import SupervisorProduction from "./SupervisorProduction";
import SupervisorStoppages from "./SupervisorStoppages";
import EnterpriseDashboard from "./EnterpriseDashboard";
import EnterpriseActions from "./EnterpriseActions";
import MyRecords from "./MyRecords";
import GreenLogin from "./GreenLogin";
import "./styles.css";

const path = window.location.pathname;
const page =
    path === "/" ? <LegacyHome /> :
    path === "/login" ? <GreenLogin /> :
    path === "/enterprise" ? <><EnterpriseDashboard /><EnterpriseActions /></> :
    path === "/home" ? <RoleRedirect /> :
    path === "/mis-registros" ? <MyRecords /> :
    path === "/operaciones" ? <OperationsConsole /> :
    ["/supervisor", "/supervisor/revision"].includes(path) ? <SupervisorConsole /> :
    path === "/supervisor/residuos" ? <SupervisorMovements /> :
    path === "/supervisor/produccion" ? <SupervisorProduction /> :
    path === "/supervisor/paradas" ? <SupervisorStoppages /> :
    path === "/hssa" || path === "/hssa/tablero" ? <HssaDashboard /> :
    path === "/hssa/efluentes" ? <HssaEffluents /> :
    path === "/hssa/reportes" ? <HssaReports /> :
    path === "/hssa/usuarios" ? <HssaUsers /> :
    path === "/gerencia" || path === "/gerencia/resumen" ? <ManagementSummary /> :
    <App />;

createRoot(document.getElementById("root")).render(<StrictMode>{page}</StrictMode>);
