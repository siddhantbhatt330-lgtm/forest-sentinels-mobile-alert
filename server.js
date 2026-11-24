
const express = require("express");
const fs = require("fs");
const path = require("path");

const { initializeApp, cert } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

// ==========================================
// 1. FIREBASE ADMIN SETUP
// ==========================================

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : require("./serviceAccountKey.json");

initializeApp({
    credential: cert(serviceAccount)
});

const messaging = getMessaging();

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 2. MIDDLEWARE
// ==========================================

// ==========================================
// CORS CONFIGURATION
// ==========================================

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// 3. DATA FILES
// ==========================================

const DATA_FILE = path.join(__dirname, "registrations.json");
const EVENTS_FILE = path.join(__dirname, "events.json");

function ensureDataFile(file) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify([], null, 2));
    }
}

function readData(file) {
    ensureDataFile(file);
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function saveData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

ensureDataFile(DATA_FILE);
ensureDataFile(EVENTS_FILE);

// ==========================================
// 4. ALLOWED ZONES AND RISK CLASSIFICATION
// ==========================================

const allowedZones = ["Zone A", "Zone B", "Zone C", "Zone D"];

function getRisk(animal) {
    const name = String(animal).trim().toLowerCase();

    if (["tiger", "lion", "leopard", "bear"].includes(name)) {
        return "HIGH";
    }

    if (name === "elephant") {
        return "MEDIUM";
    }

    return "LOW";
}

// ==========================================
// 5. SERVER STATUS
// ==========================================

app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        message: "Forest Sentinels Alert Server is running"
    });
});

// ==========================================
// 6. REGISTER MOBILE
// ==========================================

app.post("/api/register", (req, res) => {
    try {
        const { name, phone, zone, token } = req.body;

        if (!name || !phone || !zone) {
            return res.status(400).json({
                success: false,
                message: "Please provide name, phone and zone."
            });
        }

        if (!allowedZones.includes(zone)) {
            return res.status(400).json({
                success: false,
                message: "Invalid forest zone."
            });
        }

        const registrations = readData(DATA_FILE);

        const newRegistration = {
            id: Date.now(),
            name: String(name).trim(),
            phone: String(phone).trim(),
            zone,
            token: token || null,
            registeredAt: new Date().toISOString()
        };

        registrations.push(newRegistration);
        saveData(DATA_FILE, registrations);

        res.json({
            success: true,
            message: "Mobile registered successfully!"
        });

    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            success: false,
            message: "Server registration failed."
        });
    }
});

// ==========================================
// 7. TEST PUSH NOTIFICATION
// ==========================================

app.post("/api/test-notification", async (req, res) => {
    try {
        const registrations = readData(DATA_FILE);

        const latestRegistration =
            registrations[registrations.length - 1];

        if (!latestRegistration || !latestRegistration.token) {
            return res.status(404).json({
                success: false,
                message: "No registered notification device found."
            });
        }

        const response = await messaging.send({
            notification: {
                title: "🌲 FOREST SENTINELS ALERT",
                body: "Test successful! Your wildlife alert system is connected."
            },
            token: latestRegistration.token
        });

        res.json({
            success: true,
            message: "Test notification sent successfully!",
            messageId: response
        });

    } catch (error) {
        console.error("Test notification error:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==========================================
// 8. CREATE WILDLIFE DETECTION
// ==========================================

app.post("/api/detections", async (req, res) => {
    try {
        const { animal, zone, source } = req.body;

        if (!animal || !zone) {
            return res.status(400).json({
                success: false,
                message: "Animal and zone are required."
            });
        }

        if (!allowedZones.includes(zone)) {
            return res.status(400).json({
                success: false,
                message: "Invalid forest zone."
            });
        }

        const cleanAnimal = String(animal).trim();

        if (!cleanAnimal || cleanAnimal.length > 50) {
            return res.status(400).json({
                success: false,
                message: "Invalid animal name."
            });
        }

        const risk = getRisk(cleanAnimal);

        const event = {
            id: Date.now().toString(),
            animal: cleanAnimal,
            zone,
            risk,
            source: source === "camera" ? "camera" : "simulation",
            time: new Date().toISOString()
        };

        // Save detection event
        const events = readData(EVENTS_FILE);
        events.unshift(event);
        saveData(EVENTS_FILE, events);

        // Only HIGH risk events send push notifications
        if (risk !== "HIGH") {
            return res.json({
                success: true,
                message: "Detection saved. No high-risk notification required.",
                event,
                notifications: {
                    sent: 0,
                    failed: 0
                }
            });
        }

        // Find registered devices in the matching zone only
        const registrations = readData(DATA_FILE);

        const matchingDevices = registrations.filter(device =>
            device.zone === zone && device.token
        );

        const uniqueTokens = [
            ...new Set(matchingDevices.map(device => device.token))
        ];

        if (uniqueTokens.length === 0) {
            return res.json({
                success: true,
                message: "Detection saved, but no notification device is registered in this zone.",
                event,
                notifications: {
                    sent: 0,
                    failed: 0
                }
            });
        }

        // Firebase allows up to 500 tokens per multicast request
        let sent = 0;
        let failed = 0;

        for (let i = 0; i < uniqueTokens.length; i += 500) {
            const tokenBatch = uniqueTokens.slice(i, i + 500);

            const result = await messaging.sendEachForMulticast({
                notification: {
                    title: "🚨 FOREST SENTINELS - HIGH RISK",
                    body: `${cleanAnimal} detected in ${zone}. Immediate attention required.`
                },
                data: {
                    eventId: event.id,
                    animal: cleanAnimal,
                    zone,
                    risk,
                    time: event.time
                },
                tokens: tokenBatch
            });

            sent += result.successCount;
            failed += result.failureCount;
        }

        res.json({
            success: true,
            message: "Detection saved and zone notifications processed.",
            event,
            notifications: {
                sent,
                failed
            }
        });

    } catch (error) {
        console.error("Detection error:", error);

        res.status(500).json({
            success: false,
            message: "Detection processing failed.",
            error: error.message
        });
    }
});

// ==========================================
// 9. GET DETECTION HISTORY
// ==========================================

app.get("/api/events", (req, res) => {
    try {
        const events = readData(EVENTS_FILE);

        res.json({
            success: true,
            count: events.length,
            events
        });

    } catch (error) {
        console.error("Events error:", error);

        res.status(500).json({
            success: false,
            message: "Could not load detection history."
        });
    }
});

// ==========================================
// 10. START SERVER
// ==========================================

app.listen(PORT, () => {
    console.log("-----------------------------------");
    console.log("FOREST SENTINELS ALERT NETWORK");
    console.log("Server running at http://localhost:" + PORT);
    console.log("Detection API: /api/detections");
    console.log("Events API: /api/events");
    console.log("-----------------------------------");
});
