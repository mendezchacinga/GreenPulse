const _db = require("../config/db");

const roles = ["operario", "supervisor", "hssa", "gerencia"];
const allowedShifts = ["Mañana", "Tarde"];
const movementWaste = ["Trilaminado", "Poli film", "Bolsa plástica", "Bolsa de papel", "Barredura", "Lactosuero"];
const allowedWaste = ["Bolsas plásticas", "Bolsas de papel", "Barredura", "Poli film"];

allowedWaste.push(...movementWaste.filter((item) => !allowedWaste.includes(item)));

exports.requireRole = (...allowed) => async (req, res, next) => {
    const user = await _db.getDb().collection("users").findOne({ email: req.userEmail }, { projection: { role: 1 } });
    req.operationRole = user?.role || "operario";
    if (!allowed.includes(req.operationRole)) return res.status(403).json({ message: "No tienes permiso para esta operación." });
    next();
};

exports.profile = async (req, res) => {
    const user = await _db.getDb().collection("users").findOne({ email: req.userEmail }, { projection: { name: 1, role: 1, area: 1, email: 1 } });
    res.json({ name: user?.name || req.userEmail, email: user?.email || req.userEmail, role: user?.role || "operario", area: user?.area || "Línea" });
};

exports.createLoss = async (req, res) => {
    const { line, shift, wasteType, weight, cause, occurredAt } = req.body;
    const kg = Number(weight);
    if (!line || !allowedShifts.includes(shift) || !allowedWaste.includes(wasteType) || !Number.isFinite(kg) || kg <= 0 || kg > 10000 || !cause) return res.status(400).json({ message: "Completa línea, turno, residuo, peso válido y causa." });
    const record = { line, shift, wasteType, weight: kg, cause, occurredAt: occurredAt || new Date().toISOString(), status: "pending", createdBy: req.userEmail, createdAt: new Date() };
    await _db.getDb().collection("losses").insertOne(record);
    await _db.getDb().collection("audit_log").insertOne({ action: "loss_created", actor: req.userEmail, entity: "losses", detail: { line, shift, wasteType, weight: kg }, createdAt: new Date() });
    res.status(201).json({ message: "Merma registrada para validación.", record });
};

exports.listLosses = async (req, res) => {
    const query = req.operationRole === "operario" ? { createdBy: req.userEmail } : {};
    if (req.query.line) query.line = req.query.line;
    if (req.query.shift) query.shift = req.query.shift;
    if (req.query.status) query.status = req.query.status;
    if (req.query.from || req.query.to) {
        query.occurredAt = {};
        if (req.query.from) query.occurredAt.$gte = new Date(req.query.from).toISOString();
        if (req.query.to) query.occurredAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`).toISOString();
    }
    res.json(await _db.getDb().collection("losses").find(query).sort({ createdAt: -1 }).limit(200).toArray());
};

exports.lossHistory = async (req, res) => {
    const { ObjectId } = require("mongodb");
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Identificador inválido." });
    const item = await _db.getDb().collection("losses").findOne({ _id: new ObjectId(req.params.id) });
    if (!item || (req.operationRole === "operario" && item.createdBy !== req.userEmail)) return res.status(404).json({ message: "Registro no encontrado." });
    res.json({ createdBy: item.createdBy, createdAt: item.createdAt, status: item.status, validatedBy: item.validatedBy || null, validatedAt: item.validatedAt || null, supervisorNote: item.supervisorNote || "" });
};

exports.validateLoss = async (req, res) => {
    const { ObjectId } = require("mongodb");
    const { status, note = "", line, wasteType, weight, cause } = req.body;
    if (["corrected", "rejected"].includes(status) && String(note).trim().length < 10) return res.status(400).json({ message: "El motivo debe tener al menos 10 caracteres." });
    const losses = _db.getDb().collection("losses");
    const previous = ObjectId.isValid(req.params.id) ? await losses.findOne({ _id: new ObjectId(req.params.id) }) : null;
    if (!previous) return res.status(404).json({ message: "Registro no encontrado." });
    if (!ObjectId.isValid(req.params.id) || !["approved", "corrected", "rejected"].includes(req.body.status)) return res.status(400).json({ message: "Validación inválida." });
    const update = { status, supervisorNote: String(note).trim(), validatedBy: req.userEmail, validatedAt: new Date() };
    if (status === "corrected") {
        const kg = Number(weight);
        if (!line || !allowedWaste.includes(wasteType) || !Number.isFinite(kg) || kg <= 0 || !cause) return res.status(400).json({ message: "Completa los datos corregidos del registro." });
        update.originalValues = previous.originalValues || { line: previous.line, wasteType: previous.wasteType, weight: previous.weight, cause: previous.cause };
        update.line = line;
        update.wasteType = wasteType;
        update.weight = kg;
        update.cause = cause;
    }
    const result = await losses.findOneAndUpdate({ _id: previous._id }, { $set: update }, { returnDocument: "after" });
    if (!result) return res.status(404).json({ message: "Registro no encontrado." });
    await _db.getDb().collection("audit_log").insertOne({ action: "loss_validated", actor: req.userEmail, entity: "losses", entityId: req.params.id, detail: { status: req.body.status, note: req.body.note || "" }, createdAt: new Date() });
    res.json(result);
};

exports.createEvent = (collection) => async (req, res) => {
    const number = (name, max) => Number.isFinite(Number(req.body[name])) && Number(req.body[name]) >= 0 && Number(req.body[name]) <= max;
    if (collection === "production" && (!req.body.line || !allowedShifts.includes(req.body.shift) || !number("units", 10000000))) return res.status(400).json({ message: "Producción inválida." });
    if (collection === "stoppages" && (!req.body.line || !req.body.cause || !number("minutes", 1440))) return res.status(400).json({ message: "Parada mecánica inválida." });
    if ((collection === "storage" || collection === "dispatches") && (!req.body.zone || !number("weight", 100000))) return res.status(400).json({ message: "Peso o zona inválidos." });
    if (collection === "dispatches" && (!req.body.destination || !number("cost", 1000000000))) return res.status(400).json({ message: "Destino o costo inválidos." });
    if (collection === "effluents" && (!req.body.date || !req.body.point || !number("volume", 1000000))) return res.status(400).json({ message: "Efluente inválido." });
    await _db.getDb().collection(collection).insertOne({ ...req.body, createdBy: req.userEmail, createdAt: new Date() });
    await _db.getDb().collection("audit_log").insertOne({ action: `${collection}_created`, actor: req.userEmail, entity: collection, detail: req.body, createdAt: new Date() });
    res.status(201).json({ message: "Registro guardado." });
};

exports.listZones = async (req, res) => {
    await ensureZoneCatalog();
    res.json(await _db.getDb().collection("catalog_zones").find({}).sort({ name: 1 }).toArray());
};

exports.listMovements = async (req, res) => {
    const db = _db.getDb();
    const [entries, exits] = await Promise.all([db.collection("storage").find({}).toArray(), db.collection("dispatches").find({}).toArray()]);
    const movements = [...entries.map((item) => ({ ...item, movementType: "entry" })), ...exits.map((item) => ({ ...item, movementType: "exit" }))].sort((a, b) => new Date(b.occurredAt || b.createdAt) - new Date(a.occurredAt || a.createdAt));
    const balances = {};
    movements.slice().reverse().forEach((item) => { if (!item.zone || !item.wasteType) return; const key = `${item.zone}::${item.wasteType}`; balances[key] = (balances[key] || 0) + (item.movementType === "entry" ? Number(item.weight || 0) : -Number(item.weight || 0)); });
    res.json({ movements: movements.slice(0, 50), balances });
};

exports.createMovement = (movementType) => async (req, res) => {
    const { zone, wasteType, weight, occurredAt, destination, cost } = req.body;
    const kg = Number(weight);
    if (!zone || !movementWaste.includes(wasteType) || !Number.isFinite(kg) || kg <= 0 || kg > 100000) return res.status(400).json({ message: "Completa zona, residuo y peso válido." });
    const db = _db.getDb();
    if (movementType === "exit") {
        if (!destination) return res.status(400).json({ message: "Selecciona un destino." });
        if (cost !== "" && cost !== undefined && (!Number.isFinite(Number(cost)) || Number(cost) < 0)) return res.status(400).json({ message: "El costo no es válido." });
        const [entries, exits] = await Promise.all([db.collection("storage").find({ zone, wasteType }).toArray(), db.collection("dispatches").find({ zone, wasteType }).toArray()]);
        const available = entries.reduce((sum, item) => sum + Number(item.weight || 0), 0) - exits.reduce((sum, item) => sum + Number(item.weight || 0), 0);
        if (kg > available) return res.status(400).json({ message: `El peso supera el saldo disponible de ${available.toFixed(2)} kg.` });
    }
    const record = { zone, wasteType, weight: kg, occurredAt: occurredAt || new Date().toISOString(), createdBy: req.userEmail, createdAt: new Date() };
    if (movementType === "exit") { record.destination = destination; if (cost !== "" && cost !== undefined) record.cost = Number(cost); }
    const collection = movementType === "entry" ? "storage" : "dispatches";
    await db.collection(collection).insertOne(record);
    await db.collection("audit_log").insertOne({ action: `${movementType}_movement_created`, actor: req.userEmail, entity: collection, detail: record, createdAt: new Date() });
    res.status(201).json({ message: "Movimiento guardado.", record: { ...record, movementType } });
};

exports.listProduction = async (req, res) => {
    const query = req.query.date ? { date: req.query.date } : {};
    res.json(await _db.getDb().collection("production").find(query).sort({ createdAt: -1 }).toArray());
};

exports.saveProduction = async (req, res) => {
    const { date, line, shift, units, observation = "" } = req.body;
    const quantity = Number(units);
    if (!date || !line || !allowedShifts.includes(shift) || !Number.isInteger(quantity) || quantity <= 0) return res.status(400).json({ message: "Completa fecha, línea, turno y unidades producidas." });
    const record = { date, line, shift, units: quantity, observation: String(observation).trim(), createdBy: req.userEmail, updatedAt: new Date() };
    const result = await _db.getDb().collection("production").findOneAndUpdate({ date, line, shift }, { $set: record, $setOnInsert: { createdAt: new Date() } }, { upsert: true, returnDocument: "after" });
    await _db.getDb().collection("audit_log").insertOne({ action: "production_saved", actor: req.userEmail, entity: "production", detail: { date, line, shift, units: quantity }, createdAt: new Date() });
    res.status(201).json({ message: "Producción guardada.", record: result });
};

exports.listStoppages = async (req, res) => {
    const query = req.query.date ? { date: req.query.date } : {};
    res.json(await _db.getDb().collection("stoppages").find(query).sort({ createdAt: -1 }).toArray());
};

exports.createStoppage = async (req, res) => {
    const { date, line, startTime, endTime, cause, observation = "" } = req.body;
    if (!date || !line || !startTime || !endTime || !cause) return res.status(400).json({ message: "Completa los datos de la parada." });
    const start = new Date(`${date}T${startTime}:00`), end = new Date(`${date}T${endTime}:00`), minutes = Math.round((end - start) / 60000);
    if (!Number.isFinite(minutes) || minutes <= 0) return res.status(400).json({ message: "La hora de fin debe ser posterior al inicio." });
    if (cause === "Otra" && !String(observation).trim()) return res.status(400).json({ message: "Describe la causa de la parada." });
    const record = { date, line, startTime, endTime, cause, observation: String(observation).trim(), minutes, createdBy: req.userEmail, createdAt: new Date() };
    await _db.getDb().collection("stoppages").insertOne(record);
    await _db.getDb().collection("audit_log").insertOne({ action: "stoppage_created", actor: req.userEmail, entity: "stoppages", detail: record, createdAt: new Date() });
    res.status(201).json({ message: "Parada registrada.", record });
};

exports.dashboard = async (req, res) => {
    const db = _db.getDb(); const [losses, production, dispatches] = await Promise.all([db.collection("losses").find({}).toArray(), db.collection("production").find({}).toArray(), db.collection("dispatches").find({}).toArray()]);
    const totalKg = losses.reduce((sum, item) => sum + (item.weight || 0), 0);
    const units = production.reduce((sum, item) => sum + Number(item.units || 0), 0);
    const cost = dispatches.reduce((sum, item) => sum + Number(item.cost || 0), 0);
    const reused = dispatches.filter((item) => ["reciclaje", "reventa"].includes(String(item.destination || "").toLowerCase())).reduce((sum, item) => sum + Number(item.weight || 0), 0);
    const pendingValidation = losses.filter((item) => item.status === "pending").length;
    const compliance = losses.length ? (losses.filter((item) => item.status === "approved").length / losses.length) * 100 : 0;
    const lineTotals = losses.reduce((totals, item) => ({ ...totals, [item.line]: (totals[item.line] || 0) + Number(item.weight || 0) }), {});
    const alerts = [];
    if (pendingValidation > 0) alerts.push({ level: "warning", message: `${pendingValidation} mermas esperan validación del supervisor.` });
    if (losses.length && compliance < 80) alerts.push({ level: "critical", message: `El cumplimiento de registros es ${compliance.toFixed(1)}%, por debajo del objetivo del 80%.` });
    Object.entries(lineTotals).filter(([, value]) => value > 500).forEach(([line, value]) => alerts.push({ level: "warning", message: `La línea ${line} acumula ${value.toFixed(1)} kg de merma.` }));
    res.json({ totalLossKg: totalKg, lossPerUnit: units ? totalKg / units : 0, disposalCost: cost, recoveryRate: totalKg ? (reused / totalKg) * 100 : 0, pendingValidation, compliance, alerts });
};

const { inRange, buildDashboardMetrics } = require("../utils/operationsMetrics");

exports.hssaDashboard = async (req, res) => {
    const from = req.query.from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const line = req.query.line || "";
    const db = _db.getDb();
    const [losses, production, dispatches] = await Promise.all([
        db.collection("losses").find({}).toArray(),
        db.collection("production").find({}).toArray(),
        db.collection("dispatches").find({}).toArray()
    ]);
    res.json(buildDashboardMetrics({ losses, production, dispatches, from, to, line }));
};

exports.gerenciaSummary = async (req, res) => {
    const from = req.query.from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const db = _db.getDb();
    const [losses, production, dispatches] = await Promise.all([
        db.collection("losses").find({}).toArray(),
        db.collection("production").find({}).toArray(),
        db.collection("dispatches").find({}).toArray()
    ]);
    res.json(buildDashboardMetrics({ losses, production, dispatches, from, to, line: "" }));
};

exports.catalog = async (req, res) => {
    const types = ["waste-types", "zones", "destinations", "lines"];
    if (!types.includes(req.params.type)) return res.status(400).json({ message: "Catálogo inválido." });
    const collection = `catalog_${req.params.type}`;
    if (req.method === "GET") return res.json(await _db.getDb().collection(collection).find({}).sort({ name: 1 }).toArray());
    if (!req.body.name || req.body.name.trim().length < 2) return res.status(400).json({ message: "Ingresa un nombre válido." });
    await _db.getDb().collection(collection).updateOne({ name: req.body.name.trim() }, { $setOnInsert: { name: req.body.name.trim(), createdBy: req.userEmail, createdAt: new Date() } }, { upsert: true });
    res.status(201).json({ message: "Catálogo actualizado." });
};

exports.report = async (req, res) => {
    const db = _db.getDb(); const losses = await db.collection("losses").find({}).toArray();
    const lines = ["Fecha,Línea,Turno,Residuo,Peso kg,Causa,Estado", ...losses.map((item) => [item.occurredAt || item.createdAt?.toISOString(), item.line, item.shift, item.wasteType, item.weight, item.cause, item.status].map((value) => `"${String(value || "").replaceAll('"', '""')}"`).join(","))];
    res.type("text/csv").attachment("reporte-mermas-greenpulse.csv").send(lines.join("\n"));
};

exports.analytics = async (req, res) => {
    const losses = await _db.getDb().collection("losses").find({ status: { $ne: "rejected" } }).toArray();
    const group = (key) => Object.entries(losses.reduce((result, item) => { const name = item[key] || "Sin dato"; result[name] = (result[name] || 0) + Number(item.weight || 0); return result; }, {})).map(([name, weight]) => ({ name, weight }));
    res.json({ byLine: group("line"), byShift: group("shift"), byWasteType: group("wasteType"), records: losses.length });
};

exports.monthlyTrend = async (req, res) => {
    const db = _db.getDb();
    const [losses, dispatches] = await Promise.all([db.collection("losses").find({ status: { $ne: "rejected" } }).toArray(), db.collection("dispatches").find({}).toArray()]);
    const months = {};
    losses.forEach((item) => { const month = new Date(item.occurredAt || item.createdAt).toISOString().slice(0, 7); months[month] ||= { month, lossKg: 0, cost: 0, recoveredKg: 0 }; months[month].lossKg += Number(item.weight || 0); });
    dispatches.forEach((item) => { const month = new Date(item.createdAt).toISOString().slice(0, 7); months[month] ||= { month, lossKg: 0, cost: 0, recoveredKg: 0 }; months[month].cost += Number(item.cost || 0); if (["reciclaje", "reventa"].includes(item.destination)) months[month].recoveredKg += Number(item.weight || 0); });
    res.json(Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).map((item) => ({ ...item, recoveryRate: item.lossKg ? (item.recoveredKg / item.lossKg) * 100 : 0 })));
};

exports.auditLog = async (req, res) => res.json(await _db.getDb().collection("audit_log").find({}).sort({ createdAt: -1 }).limit(200).toArray());

exports.backup = async (req, res) => {
    const db = _db.getDb(); const collections = ["users", "losses", "production", "stoppages", "storage", "dispatches", "effluents", "effluent_points", "effluent_parameters", "audit_log"];
    const payload = { generatedAt: new Date().toISOString(), application: "GreenPulse - Lácteos Los Andes", collections: {} };
    for (const collection of collections) payload.collections[collection] = await db.collection(collection).find({}).project(collection === "users" ? { password: 0 } : {}).toArray();
    res.type("application/json").attachment(`respaldo-greenpulse-${new Date().toISOString().slice(0, 10)}.json`).send(JSON.stringify(payload, null, 2));
};

const defaultEffluentPoints = [
    { name: "PTAR entrada", example: true, active: true },
    { name: "PTAR salida", example: true, active: true },
    { name: "Descarga pluvial", example: true, active: true }
];
const defaultEffluentParameters = [
    { name: "pH", unit: "pH", defaultLimit: null, example: true, active: true },
    { name: "DQO", unit: "mg/L", defaultLimit: null, example: true, active: true },
    { name: "SST", unit: "mg/L", defaultLimit: null, example: true, active: true },
    { name: "Aceites y grasas", unit: "mg/L", defaultLimit: null, example: true, active: true }
];

const defaultZones = [
    "Acopio Interno - Soplado y Envasado",
    "Acopio Interno - Pasteurización / Recepción",
    "Patio Exterior - Material Polimérico y Empaques",
    "Patio Exterior - Chatarrería e Inorgánicos",
    "Tanques de Acopio - Subproductos Líquidos (Lactosuero)"
];

async function ensureEffluentCatalog() {
    const db = _db.getDb();
    if (!(await db.collection("effluent_points").countDocuments())) await db.collection("effluent_points").insertMany(defaultEffluentPoints.map((item) => ({ ...item, createdAt: new Date() })));
    if (!(await db.collection("effluent_parameters").countDocuments())) await db.collection("effluent_parameters").insertMany(defaultEffluentParameters.map((item) => ({ ...item, createdAt: new Date() })));
}

async function ensureZoneCatalog() {
    const db = _db.getDb();
    if (!(await db.collection("catalog_zones").countDocuments())) await db.collection("catalog_zones").insertMany(defaultZones.map((name) => ({ name, createdAt: new Date() })));
}

exports.listOperationUsers = async (req, res) => {
    const users = await _db.getDb().collection("users").find({}).project({ password: 0 }).sort({ name: 1 }).toArray();
    res.json(users.map((user) => ({ ...user, active: user.active !== false, area: user.area || "", number: user.number || user.phone || "" })));
};

exports.createOperationUser = async (req, res) => {
    const bcrypt = require("bcrypt");
    const { name, email, number, role, password } = req.body;
    if (!name?.trim() || !email?.trim() || !number?.trim() || !roles.includes(role) || !password) return res.status(400).json({ message: "Completa nombre, correo, teléfono, rol y contraseña temporal." });
    const db = _db.getDb();
    if (await db.collection("users").findOne({ $or: [{ email: email.trim().toLowerCase() }, { number: String(number).trim() }] })) return res.status(409).json({ message: "El correo o teléfono ya está registrado." });
    const record = { name: name.trim(), email: email.trim().toLowerCase(), number: String(number).trim(), role, area: "", password: bcrypt.hashSync(password, 10), active: true, time_stamp: new Date().toISOString() };
    await db.collection("users").insertOne(record);
    await db.collection("audit_log").insertOne({ action: "user_created", actor: req.userEmail, entity: "users", detail: { email: record.email, role, area: record.area }, createdAt: new Date() });
    const { password: _password, ...safe } = record;
    res.status(201).json({ message: `Usuario creado: ${record.name} · ${role}`, user: safe });
};

exports.updateOperationUser = async (req, res) => {
    const { role, area, number, active } = req.body;
    const db = _db.getDb();
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const existing = await db.collection("users").findOne({ email });
    if (!existing) return res.status(404).json({ message: "Usuario no encontrado." });
    if (email === req.userEmail.toLowerCase()) {
        if (active === false) return res.status(400).json({ message: "No puedes desactivar tu propia cuenta." });
        if (role && role !== "hssa") return res.status(400).json({ message: "No puedes quitarte el rol de HSSA." });
    }
    const update = {};
    if (role !== undefined) {
        if (!roles.includes(role)) return res.status(400).json({ message: "Rol inválido." });
        update.role = role;
    }
    if (area !== undefined) update.area = String(area).trim();
    if (number !== undefined) update.number = String(number).trim();
    if (active !== undefined) update.active = Boolean(active);
    if (!Object.keys(update).length) return res.status(400).json({ message: "No hay cambios para guardar." });
    await db.collection("users").updateOne({ email }, { $set: update });
    await db.collection("audit_log").insertOne({ action: "user_updated", actor: req.userEmail, entity: "users", detail: { email, ...update }, createdAt: new Date() });
    res.json({ message: `Usuario actualizado: ${existing.name}`, user: { ...existing, ...update, password: undefined } });
};
exports.deleteOperationUser = async (req, res) => {
    const db = _db.getDb();
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const existing = await db.collection("users").findOne({ email });
    if (!existing) return res.status(404).json({ message: "Usuario no encontrado." });
    if (email === req.userEmail.toLowerCase()) return res.status(400).json({ message: "No puedes eliminar tu propia cuenta." });
    await db.collection("users").deleteOne({ email });
    await db.collection("audit_log").insertOne({ action: "user_deleted", actor: req.userEmail, entity: "users", detail: { email, name: existing.name }, createdAt: new Date() });
    res.json({ message: `Usuario eliminado: ${existing.name}` });
};

exports.listEffluentCatalog = async (req, res) => {
    await ensureEffluentCatalog();
    const db = _db.getDb();
    const [points, parameters] = await Promise.all([
        db.collection("effluent_points").find({}).sort({ name: 1 }).toArray(),
        db.collection("effluent_parameters").find({}).sort({ name: 1 }).toArray()
    ]);
    res.json({ points, parameters });
};

exports.saveEffluentCatalog = async (req, res) => {
    await ensureEffluentCatalog();
    const { kind, name, unit, defaultLimit } = req.body;
    if (!["point", "parameter"].includes(kind) || !name?.trim()) return res.status(400).json({ message: "Indica el tipo y el nombre del elemento." });
    const db = _db.getDb();
    if (kind === "point") {
        await db.collection("effluent_points").updateOne({ name: name.trim() }, { $setOnInsert: { name: name.trim(), example: false, active: true, createdAt: new Date() } }, { upsert: true });
    } else {
        if (!unit?.trim()) return res.status(400).json({ message: "Indica la unidad del parámetro." });
        const limit = defaultLimit === "" || defaultLimit == null ? null : Number(defaultLimit);
        if (limit != null && !Number.isFinite(limit)) return res.status(400).json({ message: "El límite no es válido." });
        await db.collection("effluent_parameters").updateOne(
            { name: name.trim() },
            { $set: { unit: unit.trim(), defaultLimit: limit, example: false, active: true }, $setOnInsert: { name: name.trim(), createdAt: new Date() } },
            { upsert: true }
        );
    }
    await db.collection("audit_log").insertOne({ action: "effluent_catalog_saved", actor: req.userEmail, entity: kind === "point" ? "effluent_points" : "effluent_parameters", detail: req.body, createdAt: new Date() });
    res.status(201).json({ message: "Catálogo actualizado." });
};

exports.listEffluents = async (req, res) => {
    const query = {};
    if (req.query.point) query.point = req.query.point;
    if (req.query.result) query.result = req.query.result;
    if (req.query.from || req.query.to) {
        query.measuredAt = {};
        if (req.query.from) query.measuredAt.$gte = new Date(req.query.from).toISOString();
        if (req.query.to) query.measuredAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`).toISOString();
    }
    const db = _db.getDb();
    const items = await db.collection("effluents").find(query).sort({ measuredAt: -1 }).limit(300).toArray();
    const monthKey = new Date().toISOString().slice(0, 7);
    const monthStart = `${monthKey}-01`;
    const monthItems = await db.collection("effluents").find({ measuredAt: { $gte: new Date(monthStart).toISOString() } }).toArray();
    const fulfill = monthItems.filter((item) => item.result === "cumple").length;
    const fail = monthItems.filter((item) => item.result === "no_cumple").length;
    res.json({
        items,
        summary: {
            monthTotal: monthItems.length,
            fulfill,
            fail,
            compliancePct: monthItems.length ? (fulfill / monthItems.length) * 100 : 0
        }
    });
};

exports.createEffluent = async (req, res) => {
    const { measuredAt, point, parameter, value, limit, unit, observation = "", correctionOf = null, correctionReason = "" } = req.body;
    const measured = Number(value);
    const allowed = limit === "" || limit == null ? null : Number(limit);
    if (!measuredAt || !point || !parameter || !Number.isFinite(measured) || !unit) return res.status(400).json({ message: "Completa fecha, punto, parámetro, valor y unidad." });
    if (allowed != null && !Number.isFinite(allowed)) return res.status(400).json({ message: "El límite no es válido." });
    if (correctionOf && String(correctionReason).trim().length < 10) return res.status(400).json({ message: "El motivo de la corrección debe tener al menos 10 caracteres." });
    const user = await _db.getDb().collection("users").findOne({ email: req.userEmail }, { projection: { name: 1 } });
    const result = allowed == null ? "cumple" : (measured <= allowed ? "cumple" : "no_cumple");
    const record = {
        measuredAt: new Date(measuredAt).toISOString(),
        point,
        parameter,
        value: measured,
        limit: allowed,
        unit,
        result,
        responsible: user?.name || req.userEmail,
        observation: String(observation || "").trim(),
        correctionOf: correctionOf || null,
        correctionReason: String(correctionReason || "").trim(),
        createdBy: req.userEmail,
        createdAt: new Date()
    };
    await _db.getDb().collection("effluents").insertOne(record);
    await _db.getDb().collection("audit_log").insertOne({ action: correctionOf ? "effluent_correction" : "effluent_created", actor: req.userEmail, entity: "effluents", detail: record, createdAt: new Date() });
    res.status(201).json({ message: `Medición guardada: ${parameter} en ${point} · ${result === "cumple" ? "Cumple" : "No cumple"}`, record });
};

exports.hssaReportPreview = async (req, res) => {
    const type = req.query.type || "losses";
    const from = req.query.from || "";
    const to = req.query.to || "";
    const line = req.query.line || "";
    const wasteType = req.query.wasteType || "";
    const destination = req.query.destination || "";
    const point = req.query.point || "";
    const result = req.query.result || "";
    const db = _db.getDb();
    if (type === "losses") {
        const all = await db.collection("losses").find({}).toArray();
        const inPeriod = all.filter((item) => inRange(item.occurredAt || item.createdAt, from, to) && (!line || item.line === line) && (!wasteType || item.wasteType === wasteType));
        const rows = inPeriod.filter((item) => ["approved", "corrected"].includes(item.status));
        const excluded = inPeriod.filter((item) => ["pending", "rejected"].includes(item.status)).length;
        return res.json({
            type,
            rows: rows.map((item) => ({ date: item.occurredAt || item.createdAt, line: item.line, shift: item.shift, wasteType: item.wasteType, weight: item.weight, cause: item.cause, status: item.status })),
            totals: { weight: rows.reduce((sum, item) => sum + Number(item.weight || 0), 0), excluded },
            empty: !rows.length
        });
    }
    if (type === "movements") {
        const exits = await db.collection("dispatches").find({}).toArray();
        const rows = exits.filter((item) => inRange(item.occurredAt || item.createdAt, from, to) && (!wasteType || item.wasteType === wasteType) && (!destination || item.destination === destination));
        return res.json({
            type,
            rows: rows.map((item) => ({ date: item.occurredAt || item.createdAt, zone: item.zone, wasteType: item.wasteType, weight: item.weight, destination: item.destination, cost: item.cost || 0 })),
            totals: { weight: rows.reduce((sum, item) => sum + Number(item.weight || 0), 0), cost: rows.reduce((sum, item) => sum + Number(item.cost || 0), 0) },
            empty: !rows.length
        });
    }
    const effluents = await db.collection("effluents").find({}).toArray();
    const rows = effluents.filter((item) => inRange(item.measuredAt || item.createdAt, from, to) && (!point || item.point === point) && (!result || item.result === result));
    res.json({
        type: "effluents",
        rows: rows.map((item) => ({ date: item.measuredAt || item.createdAt, point: item.point, parameter: item.parameter, value: item.value, unit: item.unit, limit: item.limit, result: item.result, responsible: item.responsible })),
        totals: { count: rows.length, fail: rows.filter((item) => item.result === "no_cumple").length },
        empty: !rows.length
    });
};

exports.roles = roles;
