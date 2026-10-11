
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = Number(process.env.PORT || 5000);

// Keep the existing database and generate a local JWT secret if needed.
const secretPath = path.join(__dirname, ".roadsense-secret");
let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (fs.existsSync(secretPath)) {
    JWT_SECRET = fs.readFileSync(secretPath, "utf8").trim();
  } else {
    JWT_SECRET = crypto.randomBytes(48).toString("hex");
    fs.writeFileSync(secretPath, JWT_SECRET, { flag: "wx", mode: 0o600 });
  }
}

if (JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters.");
}

app.use(cors());
app.use(express.json({ limit: "100kb" }));

const db = new Database(path.join(__dirname, "roadsense.db"));
db.pragma("journal_mode = WAL");

// Create tables only if they do not already exist.
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    verificationStatus TEXT NOT NULL DEFAULT 'unverified',
    reportedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    createdAt TEXT NOT NULL
  );
`);

// Migrate existing databases without deleting existing data.
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`Database migration: added ${table}.${column}`);
  }
}

ensureColumn("users", "role", "TEXT NOT NULL DEFAULT 'user'");
ensureColumn("reports", "userId", "INTEGER REFERENCES users(id)");

const findUser = db.prepare(
  "SELECT * FROM users WHERE email = ? COLLATE NOCASE"
);

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function authenticate(requiredRole) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Please sign in first."
      });
    }

    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET);
      const user = db.prepare(
        "SELECT id, name, email, role FROM users WHERE id = ?"
      ).get(Number(payload.sub));

      if (!user) {
        return res.status(401).json({
          error: "Account not found."
        });
      }

      if (requiredRole && user.role !== requiredRole) {
        return res.status(403).json({
          error: "Admin access required."
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("AUTH ERROR:", error.message);
      return res.status(401).json({
        error: "Session expired. Please sign in again."
      });
    }
  };
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


app.get("/", (req, res) => {
  res.json({
    message: "RoadSense AI backend is running",
    status: "ok"
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// User registration.
app.post("/api/auth/register", async (req, res) => {
  const name =
    typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body.password === "string" ? req.body.password : "";

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({
      error: "Name must be 2–80 characters."
    });
  }

  if (!validEmail(email)) {
    return res.status(400).json({
      error: "Enter a valid email."
    });
  }

  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({
      error: "Password must be 8–128 characters."
    });
  }

  try {
    const hash = await bcrypt.hash(password, 12);

    const result = db.prepare(`
      INSERT INTO users (name, email, passwordHash, role, createdAt)
      VALUES (?, ?, ?, 'user', ?)
    `).run(name, email, hash, new Date().toISOString());

    const user = {
      id: Number(result.lastInsertRowid),
      name,
      email,
      role: "user"
    };

    return res.status(201).json({
      token: signToken(user),
      user
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    if (String(error.code || "").includes("CONSTRAINT")) {
      return res.status(409).json({
        error: "An account with this email already exists."
      });
    }

    return res.status(500).json({
      error: error.message || "Could not create account."
    });
  }
});

// Demo login: a new email can enter either workspace.
// Existing accounts can switch workspace using their existing password.
app.post("/api/auth/login", async (req, res) => {
  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body.password === "string" ? req.body.password : "";

  const requestedRole =
    req.body.accountType === "admin" ? "admin" : "user";

  if (!validEmail(email)) {
    return res.status(400).json({
      error: "Enter a valid email."
    });
  }

  if (password.length < 1 || password.length > 128) {
    return res.status(400).json({
      error: "Enter a valid password."
    });
  }

  try {
    let user = findUser.get(email);

    if (!user) {
      const name =
        (email.split("@")[0] || "RoadSense User")
          .replace(/[._-]+/g, " ")
          .slice(0, 80) || "RoadSense User";

      const hash = await bcrypt.hash(password, 12);

      const result = db.prepare(`
        INSERT INTO users (name, email, passwordHash, role, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        name,
        email,
        hash,
        requestedRole,
        new Date().toISOString()
      );

      user = db.prepare(
        "SELECT * FROM users WHERE id = ?"
      ).get(Number(result.lastInsertRowid));
    } else {
      const passwordMatches = await bcrypt.compare(
        password,
        user.passwordHash
      );

      if (!passwordMatches) {
        return res.status(401).json({
          error: "Incorrect password for this email."
        });
      }

      if (user.role !== requestedRole) {
        db.prepare(
          "UPDATE users SET role = ? WHERE id = ?"
        ).run(requestedRole, user.id);

        user = findUser.get(email);
      }
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    return res.json({
      token: signToken(safeUser),
      user: safeUser
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      error: error.message || "Could not open demo account."
    });
  }
});

app.post("/api/auth/logout", authenticate(), (req, res) => {
  // JWT is stateless; the frontend removes its saved token.
  res.json({ success: true });
});

app.get("/api/auth/me", authenticate(), (req, res) => {
  res.json({ user: req.user });
});

// Admin sees all reports; normal users see their own reports.


app.get("/api/reports", authenticate(), (req, res) => {
  try {
    const reports = db
      .prepare("SELECT * FROM reports ORDER BY id DESC")
      .all();

    res.json(reports);
  } catch (error) {
    console.error("GET REPORTS ERROR:", error);
    res.status(500).json({ error: "Could not load reports." });
  }
});


// Submit a hazard report.
app.post("/api/reports", authenticate(), (req, res) => {
  try {
    const {
      type,
      title,
      description = "",
      latitude,
      longitude,
      severity = "medium"
    } = req.body;

    if (
      typeof type !== "string" ||
      !type.trim() ||
      typeof title !== "string" ||
      !title.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        error: "Valid type, title, latitude and longitude are required."
      });
    }

    if (!["low", "medium", "high"].includes(severity)) {
      return res.status(400).json({ error: "Invalid severity." });
    }

    const result = db.prepare(`
      INSERT INTO reports (
        type, title, description, latitude, longitude,
        severity, verificationStatus, reportedAt, userId
      )
      VALUES (?, ?, ?, ?, ?, ?, 'unverified', ?, ?)
    `).run(
      type.trim(),
      title.trim(),
      String(description).slice(0, 2000),
      latitude,
      longitude,
      severity,
      new Date().toISOString(),
      req.user.id
    );

    const report = db.prepare(
      "SELECT * FROM reports WHERE id = ?"
    ).get(result.lastInsertRowid);

    res.status(201).json(report);
  } catch (error) {
    console.error("CREATE REPORT ERROR:", error);
    res.status(500).json({
      error: error.message || "Could not create report."
    });
  }
});

// Demo admin can verify, reject, or resolve reports.
app.patch(
  "/api/reports/:id/verify",
  authenticate("admin"),
  (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;

      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({
          error: "Invalid report ID."
        });
      }

      if (!["verified", "rejected", "resolved"].includes(status)) {
        return res.status(400).json({
          error: "Invalid status."
        });
      }

      const result = db.prepare(
        "UPDATE reports SET verificationStatus = ? WHERE id = ?"
      ).run(status, id);

      if (!result.changes) {
        return res.status(404).json({
          error: "Report not found."
        });
      }

      res.json(
        db.prepare("SELECT * FROM reports WHERE id = ?").get(id)
      );
    } catch (error) {
      console.error("VERIFY REPORT ERROR:", error);
      res.status(500).json({
        error: error.message || "Could not update report."
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(`RoadSense AI backend running at http://localhost:${PORT}`);
});
