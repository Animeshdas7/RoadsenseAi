# RoadSense AI 🚦
### Smart Road Safety and Route Risk Analysis

RoadSense AI is a map-based road safety application developed to help users make informed travel decisions through route comparison, road hazard reporting, route risk assessment, and nearby emergency service discovery.

The project explores how interactive mapping and community-reported hazards can improve road safety awareness.

## ✨ Features

- **Interactive Map:** Select starting points and destinations.
- **Route Planning:** View and compare available routes.
- **Route Risk Assessment:** Estimate route risk using verified, unresolved hazard reports near a route.
- **Hazard Reporting:** Submit road hazard reports through the application.
- **Admin Workflow:** Verify, reject, and resolve submitted reports.
- **Nearby Emergency Services:** Discover nearby emergency-related facilities using available map data.
- **Weather Information:** Access weather information where configured.
- **Responsive Interface:** Designed for different screen sizes.

## 🛠️ Technology Stack

- React
- Vite
- JavaScript
- CSS
- Node.js
- Express.js
- SQLite
- OpenStreetMap-based services, where configured

## 📂 Repository

**GitHub:** https://github.com/Animeshdas7/RoadsenseAi

## 📁 Project Structure

```text
RoadsenseAi/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── data/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── Dashboard.jsx
│   │   ├── InteractiveMap.jsx
│   │   ├── api.js
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
├── backend/
│   ├── server.js
│   ├── package.json
│   └── roadsense.db
└── README.md
```

*The structure above describes the intended organization. Actual files may vary depending on the uploaded repository contents.*

## ⚙️ Prerequisites

Install the following before running the application:

- [Node.js and npm](https://nodejs.org/)
- A modern web browser
- Internet access for external map, routing, and weather services

## 🚀 Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/Animeshdas7/RoadsenseAi.git
cd RoadsenseAi
```

### 2. Install and start the backend

Open a terminal in the project root:

```bash
cd backend
npm install
node server.js
```

Keep this terminal running.

### 3. Install and start the frontend

Open a second terminal in the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite. The default is usually:

`http://localhost:5173`

**Important:** These commands assume the frontend and backend files have been uploaded to their respective directories and that the backend configuration matches the frontend API configuration. If a required file or configuration is missing, resolve that before running the application.

## 🧭 How to Use

1. Open the application in your browser.
2. Select a starting point and destination.
3. Explore and compare available routes.
4. Review route risk assessments and nearby hazard reports.
5. Submit a road hazard report when appropriate.
6. Explore nearby emergency-related facilities.
7. Use the administrative workflow to manage reports when enabled.

## 📊 Route Risk Assessment

The current implementation evaluates route risk using verified, unresolved hazard reports within approximately 100 metres of a route.

The severity weights are:

| Hazard Severity | Weight |
|---|---:|
| Low | 1 |
| Medium | 3 |
| High | 5 |

The implementation uses accumulated risk scores to classify routes into risk levels. Similar hazard reports within approximately 30 metres are deduplicated for route-risk calculation, preferring higher-severity reports.

These scores are estimates based on available reports and do not guarantee road safety.

## 🗄️ Database and Data Storage

The backend uses SQLite for database-backed functionality. Browser local storage, if used, is separate from the SQLite database.

- Preserve the database if it contains required demonstration data.
- Do not upload `node_modules`.
- Do not publish passwords, secret keys, `.env` files, or sensitive personal information.
- Ensure any required database initialization steps are completed before running the backend.

## 🔐 Security Notes

RoadSense AI is a demonstration project. Demo authentication and role-switching functionality should not be considered production-grade security.

Before production deployment, implement appropriate authentication, authorization, input validation, rate limiting, secure configuration, and database management.

## ⚠️ Limitations

- Route risk estimates depend on the accuracy and freshness of hazard reports.
- External mapping, routing, and weather services may be unavailable or rate-limited.
- Nearby service information depends on the available map data.
- Emergency service discovery does not automatically contact emergency responders or dispatch assistance.
- A low risk score does not guarantee a safe route.
- A working deployment requires the complete source code, correct configuration, and a functioning backend.

## 🎯 Project Objective

RoadSense AI aims to explore how interactive mapping, community-reported hazards, and route risk analysis can support safer travel decisions and improve road safety awareness.

## 🏆 Hackathon Information

- **Project Name:** RoadSense AI
- **Domain:** Road Safety
- **Event:** HackOverflow 10.0

## 📄 License

No specific open-source license is declared. Add a license if you intend to distribute this project under specific open-source terms.
