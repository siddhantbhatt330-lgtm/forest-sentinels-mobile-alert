
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getMessaging,
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAIolask8kokhFZFKKNEbJL1FUDAEvhHdI",
  authDomain: "forest-sentinels-alert-network.firebaseapp.com",
  projectId: "forest-sentinels-alert-network",
  storageBucket: "forest-sentinels-alert-network.firebasestorage.app",
  messagingSenderId: "197163155072",
  appId: "1:197163155072:web:7728ff00e028c544d5b065",
  measurementId: "G-MZT0V9ZJ1M"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const messaging = getMessaging(firebaseApp);

// Your Firebase Web Push public VAPID key
const VAPID_KEY = "BO00ehm34AjSG0XO0MrQf9DR2f47uBrfZz4jzRdXA2dNN4iDtcK8QAs2E4o9lKrjBXzcGFet_p2P4IHbAKQavds";

// Register notification service worker

async function registerNotificationService() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker is not supported.");
  }

  await navigator.serviceWorker.register(
    "/firebase-messaging-sw.js"
  );

  const registration = await navigator.serviceWorker.ready;

  console.log("Service Worker activated:", registration);

  return registration;
}


// Request notification permission
async function enableNotifications() {
  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("Notification permission was not granted.");
      return;
    }

    const registration = await registerNotificationService();

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    
if (token) {
  console.log("Mobile notification token:", token);

  localStorage.setItem("forestSentinelsToken", token);

  alert("Notifications successfully enabled!");
} else {
      alert("Notification token could not be generated.");
    }
  } catch (error) {
    console.error("Notification error:", error);
    alert("Setup error: " + error.message);
  }
}

// Listen for foreground notifications
onMessage(messaging, (payload) => {
  console.log("New Forest Alert:", payload);

  alert(
    payload.notification?.title || "Forest Sentinels Alert"
  );
});

window.enableNotifications = enableNotifications;

console.log("Forest Sentinels Firebase initialized.");



// Connect notification button
document.getElementById("connect-btn").addEventListener("click", () => {
  enableNotifications();
});

// Register mobile details with backend
document.getElementById("registration-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("full-name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const zone = document.getElementById("zone").value;
  const token = localStorage.getItem("forestSentinelsToken");

  const status = document.getElementById("registration-status");

  status.textContent = "Registering your mobile...";

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        phone,
        zone,
        token
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Registration failed");
    }

    status.textContent = result.message;
    document.getElementById("device-status").textContent = "Connected";
    document.getElementById("connection-status").textContent = "Mobile registered";

    localStorage.setItem("forestSentinelsConnected", "true");

    document.getElementById("registration-form").reset();

  } catch (error) {
    console.error("Registration error:", error);
    status.textContent = "Error: " + error.message;
  }
});


// Restore mobile connection status after page refresh
const savedToken = localStorage.getItem("forestSentinelsToken");
const isConnected = localStorage.getItem("forestSentinelsConnected");

if (savedToken && isConnected === "true") {
  document.getElementById("device-status").textContent = "Connected";
  document.getElementById("connection-status").textContent = "Mobile registered";
}
