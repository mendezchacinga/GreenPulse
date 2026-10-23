export const LINES = ["Soplado", "Envasado", "Empaque"];
export const SHIFTS = ["Mañana", "Tarde"];
export const WASTE_TYPES = ["Trilaminado", "Poli film", "Bolsa plástica", "Bolsa de papel", "Barredura", "Lactosuero"];
export const LOSS_CAUSES = ["Falla de máquina", "Envase defectuoso", "Error de operación", "Otra"];
export const STOPPAGE_CAUSES = ["Falla mecánica", "Falla eléctrica", "Mantenimiento", "Cambio de formato", "Falta de material", "Otra"];
export const DESTINATIONS = ["Reciclaje", "Disposición final", "Reventa", "Reutilización interna"];
export const RECOVERED_DESTINATIONS = ["Reciclaje", "Reventa", "Reutilización interna"];
export const WASTE_COLORS = {
    "Trilaminado": "#0F6B38",
    "Poli film": "#2D863B",
    "Bolsa plástica": "#58B332",
    "Bolsa de papel": "#A56800",
    "Barredura": "#4E6F82",
    "Lactosuero": "#6B796F",
    "Bolsas plásticas": "#58B332",
    "Bolsas de papel": "#A56800"
};
export const HSSA_ROLES = [
    ["operario", "Operario"],
    ["supervisor", "Supervisor"],
    ["hssa", "Jefe de HSSA"],
    ["gerencia", "Gerencia"]
];
export const AREAS = [
    "Soplado de envases",
    "Pasteurización y llenado",
    "Envasado aséptico",
    "Empaque secundario",
    "Acopio y despacho",
    "Mantenimiento",
    "HSSA",
    "Gerencia / Operaciones",
    "Sistemas / TI"
];
export const EFFLUENT_POINTS = [
    { name: "PTAR entrada", example: true },
    { name: "PTAR salida", example: true },
    { name: "Descarga pluvial", example: true }
];
export const EFFLUENT_PARAMETERS = [
    { name: "pH", unit: "pH", defaultLimit: "", example: true },
    { name: "DQO", unit: "mg/L", defaultLimit: "", example: true },
    { name: "SST", unit: "mg/L", defaultLimit: "", example: true },
    { name: "Aceites y grasas", unit: "mg/L", defaultLimit: "", example: true }
];
