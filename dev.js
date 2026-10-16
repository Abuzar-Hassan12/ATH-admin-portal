
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const backendDir = path.join(__dirname, "backend");
const frontendDir = path.join(__dirname, "frontend");

const pyCandidates = [
  path.join(backendDir, "venv", "Scripts", "python.exe"),
  path.join(__dirname, ".venv", "Scripts", "python.exe")
];
const pythonExec = pyCandidates.find(p => fs.existsSync(p)) || "python";

console.log("\x1b[32m[BACKEND]\x1b[0m Starting FastAPI on http://127.0.0.1:8000 ...");
const backend = spawn(`"${pythonExec}"`, ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"], {
  cwd: backendDir,
  shell: true,
  stdio: "inherit"
});

console.log("\x1b[36m[FRONTEND]\x1b[0m Starting Vite UI on http://localhost:5173 ...");
const frontend = spawn("npm", ["run", "dev", "--", "--host", "localhost", "--port", "5173"], {
  cwd: frontendDir,
  shell: true,
  stdio: "inherit"
});

process.on("SIGINT", () => {
  backend.kill();
  frontend.kill();
  process.exit();
});

