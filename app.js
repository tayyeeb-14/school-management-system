const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const expressLayouts = require("express-ejs-layouts");
const methodOverride = require("method-override");
const path = require("path");
require("dotenv").config();

// App init
const app = express();

// MongoDB connection (ONLY ONE PLACE)
const connectDB = require("./config/database");
connectDB();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(methodOverride(function (req, res) {
  if (req.body && req.body._method) {
    const method = req.body._method;
    delete req.body._method;
    return method;
  }
}));

app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, "public")));

// EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/main");
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'school-management-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
  })
);

// Flash messages
app.use(flash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  next();
});

// Global variables
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.moment = require("moment");
  next();
});

// Routes
app.use("/", require("./routes/index"));
app.use("/auth", require("./routes/auth"));
app.use("/admin", require("./routes/admin"));
app.use("/teacher", require("./routes/teacher"));
app.use("/student", require("./routes/student"));
app.use("/documents", require("./routes/documents"));
app.use("/blog", require("./routes/blog"));

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err.message);
  console.error("Error stack:", err.stack);
  
  if (res.headersSent) return next(err);

  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    req.flash("error_msg", "File size too large. Maximum size is 5MB.");
    return res.redirect(req.get("Referrer") || "/");
  }
  
  if (err.message && err.message.includes('File')) {
    req.flash("error_msg", err.message || "File upload error");
    return res.redirect(req.get("Referrer") || "/");
  }

  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.status(500).json({ success: false, error: err.message });
  }

  req.flash("error_msg", err.message || "Something went wrong");
  res.redirect(req.get("Referrer") || "/");
});

// 404 handler
app.use((req, res) => {
  res.status(404).render("404", { title: "404 Not Found" });
});

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
