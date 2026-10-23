const express = require("express");
const app = express();
const path = require("path");
const ejs = require("ejs");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const _db = require("./config/db");
const indexRoutes = require("./routes/index");
const apiRoutes = require("./routes/apiRoutes");
const operationsRoutes = require("./routes/operationsRoutes");

_db.connectToServer();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.session_secret || process.env.jwt_secret || "change-this-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
}));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public/views"))
app.locals.statusLabels = {
  pending: "Pendiente",
  resolved: "Resuelto",
  rejected: "Rechazado",
};
app.use(express.static(path.join(__dirname, "public/")));
app.use(cookieParser());

app.use("/api", apiRoutes);
app.use("/api/operations", operationsRoutes);
app.use(express.static(path.join(__dirname, "frontend/dist")));

const reactPages = ["/", "/enterprise", "/login", "/home", "/mis-registros", "/operaciones", "/supervisor", "/supervisor/revision", "/supervisor/produccion", "/supervisor/paradas", "/supervisor/residuos", "/hssa", "/hssa/tablero", "/hssa/efluentes", "/hssa/reportes", "/hssa/usuarios", "/gerencia", "/gerencia/resumen", "/raise-a-request", "/my-requests", "/driver", "/driver/dashboard", "/driver/pending-requests", "/driver/history", "/admin", "/admin/login", "/admin/dashboard", "/admin/all-requests", "/admin/create-driver", "/admin/all-drivers"];
app.get(reactPages, (req, res) => {
    res.sendFile(path.join(__dirname, "frontend/dist/index.html"));
});

app.use("/", indexRoutes);

app.get("*", (req, res) => {
    res.render("404.ejs");
})


app.listen("3000", () => {
  console.log("Application is running successfully");
});

