import React from 'react'
import { createRoot } from 'react-dom/client'
import "./index.css"
import App from "./App.jsx"

const appDiv = document.getElementById("root");
const root = createRoot(appDiv); // Create a root
root.render(<App />); // Render the App component
