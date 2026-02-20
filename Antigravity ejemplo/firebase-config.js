// ========================================
// FIREBASE CONFIG — Pluviometría Guayal
// ========================================
// INSTRUCCIONES:
// 1. Ir a https://firebase.google.com → "Ir a la consola"
// 2. Crear un proyecto nuevo (nombre: "pluviometria-guayal" o el que quieras)
// 3. En el proyecto, ir a "Compilación" > "Firestore Database" > Crear base de datos
//    - Seleccionar "Comenzar en modo de prueba"
//    - Elegir la ubicación más cercana (ej: southamerica-east1)
// 4. Ir a Configuración del proyecto (⚙️) > "Tus apps" > Agregar app Web (</> ícono)
//    - Registrar la app con un nombre (ej: "pluviometria")
//    - NO marcar Firebase Hosting
//    - Copiar los valores de firebaseConfig aquí abajo
// 5. Reemplazar los valores de ejemplo con los tuyos:

const firebaseConfig = {
    apiKey: "AIzaSyDO7V87xp-BGXOnFtMZK4oNyVe4Ub4xG9c",
    authDomain: "pluviometros-app.firebaseapp.com",
    projectId: "pluviometros-app",
    storageBucket: "pluviometros-app.firebasestorage.app",
    messagingSenderId: "269748174052",
    appId: "1:269748174052:web:cc79eb81f10f8ba9a340f1",
    measurementId: "G-0TN2STZKV3"
};

// ========================================
// NO MODIFICAR DEBAJO DE ESTA LÍNEA
// ========================================
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
