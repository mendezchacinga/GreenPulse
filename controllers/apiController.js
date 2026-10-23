const bcrypt = require("bcrypt");
const { ObjectId } = require("mongodb");
const _db = require("../config/db");
const jwt = require("../utils/jwt");

const wasteTypes = ["Bolsas plásticas", "Bolsas de papel", "Barredura", "Poli film"];

const unauthorized = (res) => res.status(401).json({ message: "Tu sesión no es válida o ha expirado." });
const invalidId = (res) => res.status(400).json({ message: "Identificador inválido." });

const getToken = (req) => {
    try {
        return jwt.verify(req.cookies.accesstoken, process.env.jwt_secret);
    } catch (error) {
        return null;
    }
};

exports.requireUser = (req, res, next) => {
    const token = getToken(req);
    if (!token || token.role) return unauthorized(res);
    req.userEmail = token.email;
    next();
};

exports.requireDriver = (req, res, next) => {
    const token = getToken(req);
    if (!token || token.role !== "driver" || !token.id) return unauthorized(res);
    req.driverId = String(token.id);
    next();
};

exports.requireAdmin = (req, res, next) => {
    if (!req.session || !req.session.isAdmin) return unauthorized(res);
    next();
};

const makeStats = (requests, includeRejected = false) => {
    const stats = {
        total_requests: requests.length,
        total_pending: requests.filter((request) => request.status === "pending").length,
        total_resolved: requests.filter((request) => request.status === "resolved").length,
        total_plastic_bags: requests.filter((request) => request.request_type === wasteTypes[0]).length,
        total_paper_bags: requests.filter((request) => request.request_type === wasteTypes[1]).length,
        total_sweepings: requests.filter((request) => request.request_type === wasteTypes[2]).length,
        total_poly_film: requests.filter((request) => request.request_type === wasteTypes[3]).length,
    };
    if (includeRejected) stats.total_rejected = requests.filter((request) => request.status === "rejected").length;
    return stats;
};

const objectId = (value, res) => {
    if (!ObjectId.isValid(value)) {
        invalidId(res);
        return null;
    }
    return new ObjectId(value);
};

exports.loginUser = async (req, res) => {
    const user = await _db.getDb().collection("users").findOne({ email: req.body.email });
    if (!user || !bcrypt.compareSync(req.body.password || "", user.password)) return res.status(401).json({ message: "Correo o contraseña incorrectos." });
    if (user.active === false) return res.status(403).json({ message: "Esta cuenta está inactiva. Contacta a HSSA." });
    res.cookie("accesstoken", jwt.sign({ email: user.email }, process.env.jwt_secret, { expiresIn: "5h" }), { httpOnly: true, sameSite: "lax" });
    res.json({ role: "user" });
};

exports.loginDriver = async (req, res) => {
    const driver = await _db.getDb().collection("drivers").findOne({ email: req.body.email });
    if (!driver || !bcrypt.compareSync(req.body.password || "", driver.password)) return res.status(401).json({ message: "Correo o contraseña incorrectos." });
    res.cookie("accesstoken", jwt.sign({ id: String(driver._id), role: "driver" }, process.env.jwt_secret, { expiresIn: "5h" }), { httpOnly: true, sameSite: "lax" });
    res.json({ role: "driver", name: driver.name });
};

exports.loginAdmin = (req, res) => {
    const valid = req.body.email === "admin@example.com" && bcrypt.compareSync(req.body.password || "", "$2b$10$MmYRPyzFDEUjaEp1iYSdveyvR.v1n.jfoS6qSDQHx3GUEVWs4x8z6");
    if (!valid) return res.status(401).json({ message: "Correo o contraseña incorrectos." });
    req.session.isAdmin = true;
    res.json({ role: "admin" });
};

exports.logout = (req, res) => {
    res.clearCookie("accesstoken");
    if (req.session) req.session.destroy(() => res.json({ message: "Sesión cerrada." }));
    else res.json({ message: "Sesión cerrada." });
};

exports.session = (req, res) => {
    if (req.session && req.session.isAdmin) return res.json({ role: "admin" });
    const token = getToken(req);
    if (!token) return unauthorized(res);
    res.json({ role: token.role === "driver" ? "driver" : "user" });
};

exports.userDashboard = async (req, res) => {
    const requests = await _db.getDb().collection("requests").find({ email: req.userEmail }).toArray();
    const stats = makeStats(requests);
    stats.total_unassigned_driver_requests = requests.filter((request) => !request.assignedDriver || request.assignedDriver === "none").length;
    res.json(stats);
};

exports.userRequests = async (req, res) => {
    const requests = await _db.getDb().collection("requests").find({ email: req.userEmail }).sort({ _id: -1 }).toArray();
    res.json(requests);
};

exports.createRequest = async (req, res) => {
    const { name, address, request_type, message = "" } = req.body;
    if (!name || !address || !wasteTypes.includes(request_type)) return res.status(400).json({ message: "Completa responsable, ubicación y un tipo de residuo válido." });
    await _db.getDb().collection("requests").insertOne({ name, address, request_type, message, email: req.userEmail, status: "pending", time: new Date().toLocaleString("es-CO"), assignedDriver: "none", assignedDriverId: "" });
    res.status(201).json({ message: "Tu reporte fue registrado correctamente." });
};

exports.driverDashboard = async (req, res) => {
    const requests = await _db.getDb().collection("requests").find({ assignedDriverId: req.driverId }).toArray();
    res.json(makeStats(requests, true));
};

exports.driverRequests = async (req, res) => {
    const query = { assignedDriverId: req.driverId };
    if (req.query.status === "pending") query.status = "pending";
    const requests = await _db.getDb().collection("requests").find(query).sort({ _id: -1 }).toArray();
    res.json(requests);
};

exports.updateDriverRequest = async (req, res) => {
    if (!["resolved", "rejected"].includes(req.body.status)) return res.status(400).json({ message: "Estado inválido." });
    const id = objectId(req.params.id, res); if (!id) return;
    const result = await _db.getDb().collection("requests").findOneAndUpdate({ _id: id, assignedDriverId: req.driverId, status: "pending" }, { $set: { status: req.body.status } }, { returnDocument: "after" });
    if (!result) return res.status(404).json({ message: "Reporte no disponible." });
    res.json(result);
};

exports.adminDashboard = async (req, res) => {
    const db = _db.getDb();
    const [requests, drivers, users] = await Promise.all([db.collection("requests").find({}).toArray(), db.collection("drivers").find({}).toArray(), db.collection("users").find({}).toArray()]);
    const stats = makeStats(requests);
    stats.total_unassigned_driver_requests = requests.filter((request) => !request.assignedDriver || request.assignedDriver === "none").length;
    stats.total_drivers = drivers.length; stats.total_users = users.length;
    stats.total_trucks = drivers.filter((driver) => driver.vehicleType === "Truck").length;
    stats.total_cars = drivers.filter((driver) => driver.vehicleType === "Car").length;
    stats.total_van = drivers.filter((driver) => driver.vehicleType === "Van").length;
    stats.total_motorcycle = drivers.filter((driver) => driver.vehicleType === "Motorcycle").length;
    res.json(stats);
};

exports.adminRequests = async (req, res) => res.json(await _db.getDb().collection("requests").find({}).sort({ _id: -1 }).toArray());
exports.drivers = async (req, res) => res.json(await _db.getDb().collection("drivers").find({}).project({ password: 0 }).toArray());

exports.updateAdminRequest = async (req, res) => {
    const id = objectId(req.params.id, res); if (!id) return;
    const db = _db.getDb(); let update;
    if (req.body.action === "assign") {
        const driverId = objectId(req.body.driverId, res); if (!driverId) return;
        const driver = await db.collection("drivers").findOne({ _id: driverId });
        if (!driver) return res.status(404).json({ message: "Conductor no encontrado." });
        update = { assignedDriver: driver.name, assignedDriverId: String(driver._id) };
    } else if (req.body.action === "unassign") update = { assignedDriver: "none", assignedDriverId: "" };
    else if (req.body.action === "reject") update = { status: "rejected", assignedDriver: "none", assignedDriverId: "" };
    else return res.status(400).json({ message: "Acción inválida." });
    const result = await db.collection("requests").findOneAndUpdate({ _id: id, status: { $ne: "rejected" } }, { $set: update }, { returnDocument: "after" });
    if (!result) return res.status(404).json({ message: "Reporte no disponible." });
    res.json(result);
};

exports.createDriver = async (req, res) => {
    const { name, email, phone, license, vehicle, vehicleType, password, confirmPassword } = req.body;
    if (![name, email, phone, license, vehicle, vehicleType, password].every(Boolean)) return res.status(400).json({ message: "Completa todos los campos." });
    if (password !== confirmPassword) return res.status(400).json({ message: "Las contraseñas no coinciden." });
    const db = _db.getDb();
    if (await db.collection("drivers").findOne({ $or: [{ email }, { phone }] })) return res.status(409).json({ message: "El correo o teléfono ya está registrado." });
    await db.collection("drivers").insertOne({ name, email, phone, license, vehicle, vehicleType, password: bcrypt.hashSync(password, 10) });
    res.status(201).json({ message: "Conductor creado." });
};

exports.deleteDriver = async (req, res) => {
    const id = objectId(req.params.id, res); if (!id) return;
    const result = await _db.getDb().collection("drivers").deleteOne({ _id: id });
    if (!result.deletedCount) return res.status(404).json({ message: "Conductor no encontrado." });
    res.json({ message: "Conductor eliminado." });
};
