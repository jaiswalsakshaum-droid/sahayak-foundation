"""
dev_runner.py — Starts FastAPI backend, creates a public tunnel, and registers the URL with Supabase secrets automatically.
"""

import os
import re
import sys
import time
import subprocess
import signal
from pathlib import Path

BACKEND_DIR = Path(__file__).parent.resolve()
ROOT_DIR = BACKEND_DIR.parent

def main():
    print("=" * 60)
    print("🚀 Starting Sahayak Backend & Tunnel Manager")
    print("=" * 60)

    # 1. Kill any existing uvicorn or localtunnel processes
    subprocess.run(["pkill", "-f", "uvicorn app:app"], capture_output=True)
    subprocess.run(["pkill", "-f", "localtunnel"], capture_output=True)
    time.sleep(1)

    # 2. Start Uvicorn backend
    venv_python = str(BACKEND_DIR / ".venv" / "bin" / "python3")
    if not os.path.exists(venv_python):
        venv_python = sys.executable

    print(f"📦 Starting FastAPI backend using {venv_python}...")
    backend_proc = subprocess.Popen(
        [venv_python, "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    # Wait for backend to be healthy
    time.sleep(2)
    print("✅ Backend process started.")

    # 3. Start Localtunnel
    print("🌐 Launching localtunnel...")
    lt_proc = subprocess.Popen(
        ["npx", "-y", "localtunnel", "--port", "8000"],
        cwd=str(ROOT_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    tunnel_url = None
    for _ in range(30):
        line = lt_proc.stdout.readline()
        if line:
            print(f"[localtunnel] {line.strip()}")
            match = re.search(r"https://[a-zA-Z0-9-]+\.loca\.lt", line)
            if match:
                tunnel_url = match.group(0)
                break
        time.sleep(0.5)

    if not tunnel_url:
        print("❌ Could not get localtunnel URL after 15 seconds.")
        print("Backend is still running on http://localhost:8000")
    else:
        print(f"🎉 Public Tunnel Active: {tunnel_url}")
        print("🔄 Updating Supabase secrets (RENDER_BACKEND_URL & INTERNAL_SHARED_SECRET)...")
        res = subprocess.run(
            [
                "npx", "supabase", "secrets", "set",
                f"RENDER_BACKEND_URL={tunnel_url}",
                "INTERNAL_SHARED_SECRET=sahayak_dev_secret_123",
            ],
            cwd=str(ROOT_DIR),
            capture_output=True,
            text=True,
        )
        print(f"Supabase response: {res.stdout.strip() or res.stderr.strip()}")
        print("=" * 60)
        print(f"✨ ALL SYSTEMS GO! Documents uploaded in the UI will now be processed by Gemini Flash at {tunnel_url}")
        print("=" * 60)

    def shutdown(sig, frame):
        print("\nShutting down...")
        backend_proc.terminate()
        lt_proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Stream logs from both
    while True:
        b_line = backend_proc.stdout.readline()
        if b_line:
            print(f"[backend] {b_line.strip()}")
        time.sleep(0.01)

if __name__ == "__main__":
    main()
