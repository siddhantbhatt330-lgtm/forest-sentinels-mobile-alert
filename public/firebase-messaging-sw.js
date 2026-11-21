
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAIolask8kokhFZFKKNEbJL1FUDAEvhHdI",
  authDomain: "forest-sentinels-alert-network.firebaseapp.com",
  projectId: "forest-sentinels-alert-network",
  storageBucket: "forest-sentinels-alert-network.firebasestorage.app",
  messagingSenderId: "197163155072",
  appId: "1:197163155072:web:7728ff00e028c544d5b065",
  measurementId: "G-MZT0V9ZJ1M"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Forest Sentinels Alert";

  const options = {
    body: payload.notification?.body || "Wildlife activity detected!",
    icon: "/icon.png",
    data: {
      url: "/"
    }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow("/")
  );
});
