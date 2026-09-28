// backend/index.js
import express from "express";
import cors from "cors";
import checkProofRouter from "./checkProof.js";

/*
  This file starts the backend server for DeductIT.
  It sets up Express, enables CORS so the React frontend can communicate
  with the server, and registers the proof checking API route.
*/

const app = express();
const PORT = 5000;

// Enable Cross-Origin Resource Sharing so the React frontend
// (running on a different port) can send requests to the backend.
app.use(cors());

// Middleware that allows the server to read JSON data
// sent in request bodies.
app.use(express.json());

// Main API route used by the frontend to check proofs.
app.use("/api/check-proof", checkProofRouter);

// Simple test route so we can confirm the backend is running.
app.get("/", (req, res) => {
  res.send("deductIT backend is running!");
});

// Start the server and listen on the specified port.
app.listen(PORT, () => {
  console.log(`deductIT backend running on http://localhost:${PORT}`);
});