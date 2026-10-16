import os
import sys
import socket
import subprocess
import uvicorn

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, ".."))
root_dir = os.path.abspath(os.path.join(backend_dir, ".."))
frontend_dir = os.path.join(root_dir, "frontend")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)


def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


if __name__ == "__main__":
    frontend_proc = None
    # Automatically start Vite on port 5173 if it isn't already running
    if os.path.exists(frontend_dir) and not is_port_in_use(5173):
        print("INFO:     Starting Vite Frontend Server on http://localhost:5173 ...")
        frontend_proc = subprocess.Popen(
            "npm run dev -- --host localhost --port 5173",
            cwd=frontend_dir,
            shell=True
        )

    try:
        uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
    finally:
        if frontend_proc:
            frontend_proc.terminate()