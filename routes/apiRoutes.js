const express = require("express");
const api = require("../controllers/apiController");

const router = express.Router();

router.post("/auth/login", api.loginUser);
router.post("/auth/driver-login", api.loginDriver);
router.post("/auth/admin-login", api.loginAdmin);
router.post("/auth/logout", api.logout);
router.get("/auth/session", api.session);

router.get("/user/dashboard", api.requireUser, api.userDashboard);
router.get("/user/requests", api.requireUser, api.userRequests);
router.post("/user/requests", api.requireUser, api.createRequest);

router.get("/driver/dashboard", api.requireDriver, api.driverDashboard);
router.get("/driver/requests", api.requireDriver, api.driverRequests);
router.patch("/driver/requests/:id", api.requireDriver, api.updateDriverRequest);

router.get("/admin/dashboard", api.requireAdmin, api.adminDashboard);
router.get("/admin/requests", api.requireAdmin, api.adminRequests);
router.patch("/admin/requests/:id", api.requireAdmin, api.updateAdminRequest);
router.get("/admin/drivers", api.requireAdmin, api.drivers);
router.post("/admin/drivers", api.requireAdmin, api.createDriver);
router.delete("/admin/drivers/:id", api.requireAdmin, api.deleteDriver);

module.exports = router;
