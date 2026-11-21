
const express = require("express");
const fs = require("fs");
const path = require("path");

const { initializeApp, cert } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : require("./serviceAccountKey.json");

initializeApp({
    credential: cert(serviceAccount)
});

const messaging = getMessaging();

const app = express();
const PORT = process.env.PORT || 3000;


// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Registration data file
const DATA_FILE = path.join(__dirname, "registrations.json");

// Create data file if it does not exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

// Server status
app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        message: "Forest Sentinels Alert Server is running"
    });
});

// Register mobile
app.post("/api/register", (req, res) => {
    try {
        const { name, phone, zone, token } = req.body;

        if (!name || !phone || !zone) {
            return res.status(400).json({
                success: false,
                message: "Please provide name, phone and zone."
            });
        }

        const registrations = JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );

        const newRegistration = {
            id: Date.now(),
            name,
            phone,
            zone,
            token: token || null,
            registeredAt: new Date().toISOString()
        };

        registrations.push(newRegistration);

        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(registrations, null, 2)
        );

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



// Test Push Notification
app.post("/api/test-notification", async (req, res) => {
    try {
        const registrations = JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );

        const latestRegistration = registrations[registrations.length - 1];

        if (!latestRegistration || !latestRegistration.token) {
            return res.status(404).json({
                success: false,
                message: "No registered notification device found."
            });
        }

        const message = {
            notification: {
                title: "🌲 FOREST SENTINELS ALERT",
                body: "Test successful! Your wildlife alert system is connected."
            },
            token: latestRegistration.token
        };

        const response = await messaging.send(message);

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


// Start server
app.listen(PORT, () => {
    console.log("-----------------------------------");
    console.log("FOREST SENTINELS ALERT NETWORK");
    console.log("Server running at http://localhost:" + PORT);
    console.log("-----------------------------------");
});
