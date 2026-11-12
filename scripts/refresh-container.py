# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Brings the local container of this demo (http://localhost:4001) up to date.

Usage (from this folder):
  uv run scripts/refresh-container.py          # fast, ~10 s: build on the host, copy .output/ into the running container, restart it
  uv run scripts/refresh-container.py --full   # image build from the Dockerfile and a new container (~1 min)

Use --full after a change to package.json, package-lock.json or the Dockerfile (the fast path keeps the container's
.output/server/node_modules, whose sharp binary is built for the image's platform), and as the last check before calling a change done ("docker build succeeds" is a gate). The fast path
falls back to --full by itself when the container does not exist or is not running.

The container runs the same image the Dockerfile builds. The Delivery login (NOVA_DELIVERY_URL, NOVA_DELIVERY_USER,
NOVA_DELIVERY_PASSWORD) and the public Shopify Buy Button settings (SHOPIFY_DOMAIN, SHOPIFY_STOREFRONT_TOKEN) come from
the environment or from `.env` (see `.env.example`), the environment winning; --full stops if one is missing and never
prints a value. Engine: podman, else docker.
"""
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAME = "merch-vue-nuxt"
IMAGE = f"localhost/{NAME}:latest"
PORT = 4001
# The port inside the container (the Dockerfile's PORT, as in production)
CONTAINER_PORT = 3000
CHECK_URL = f"http://127.0.0.1:{PORT}/de/"


def tool(name: str) -> str:
    path = shutil.which(name)
    if not path:
        sys.exit(f"{name} not found on PATH")
    return path


ENGINE = shutil.which("podman") or shutil.which("docker") or sys.exit("neither podman nor docker found on PATH")


LOGIN_VARS = ("NOVA_DELIVERY_URL", "NOVA_DELIVERY_USER", "NOVA_DELIVERY_PASSWORD", "SHOPIFY_DOMAIN", "SHOPIFY_STOREFRONT_TOKEN")


def login_env() -> dict[str, str]:
    """The Delivery login and the Shopify settings: the process environment wins over `.env` (KEY=value lines).
    Stops if one is missing; Shopify's two would otherwise leave the site without buy buttons and cart."""
    values: dict[str, str] = {}
    dotenv = ROOT / ".env"
    if dotenv.exists():
        for line in dotenv.read_text(encoding="utf-8").splitlines():
            key, sep, value = line.partition("=")
            if sep and key.strip() in LOGIN_VARS:
                value = value.strip()
                if len(value) > 1 and value[0] == value[-1] and value[0] in "\"'":
                    value = value[1:-1]
                values[key.strip()] = value.replace("\\$", "$")  # an escaped dollar (`\$`) is a literal one, as the framework's .env files write it
    values.update({name: os.environ[name] for name in LOGIN_VARS if os.environ.get(name)})
    missing = [name for name in LOGIN_VARS if not values.get(name)]
    if missing:
        sys.exit(f"{', '.join(missing)} not set (environment or {dotenv})")
    return values


def run(*args: str, check: bool = True, env: dict[str, str] | None = None) -> subprocess.CompletedProcess:
    print("$", " ".join(Path(args[0]).name if i == 0 else a for i, a in enumerate(args)))
    done = subprocess.run(args, cwd=ROOT, encoding="utf-8", check=False, env={**os.environ, **(env or {})})
    if check and done.returncode:
        sys.exit(f"failed with exit code {done.returncode}")
    return done


def running() -> bool:
    done = subprocess.run([ENGINE, "inspect", "--format", "{{.State.Running}}", NAME], capture_output=True,
                          encoding="utf-8", check=False)
    return done.returncode == 0 and done.stdout.strip() == "true"


def wait_until_port_free() -> None:
    """After `stop` the port forwarder (pasta) lingers for a moment; a `start` too early fails with "Address already in use"."""
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        try:
            socket.create_connection(("127.0.0.1", PORT), timeout=1).close()
        except OSError:
            return
        time.sleep(0.3)
    sys.exit(f"port {PORT} is still taken 20 s after stopping {NAME}")


def wait_until_up() -> None:
    deadline = time.monotonic() + 40
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(CHECK_URL, timeout=5) as response:
                print(f"{CHECK_URL} -> {response.status}")
                return
        except OSError:
            time.sleep(1)
    sys.exit(f"{CHECK_URL} did not answer within 40 s: see `{Path(ENGINE).name} logs {NAME}`")


def full() -> None:
    login = login_env()
    run(ENGINE, "build", "-t", IMAGE, ".")
    run(ENGINE, "rm", "-f", NAME, check=False)
    # `-e NAME` takes the value from run()'s environment: it never stands on a command line or in the output
    run(ENGINE, "run", "-d", "--name", NAME, "-p", f"{PORT}:{CONTAINER_PORT}",
        *(arg for name in LOGIN_VARS for arg in ("-e", name)), IMAGE, env=login)


def fast() -> None:
    run(tool("npm"), "run", "build")
    out = ROOT / ".output"
    # Everything but the server's node_modules; /app/.output belongs to root in the image, hence -u root, and clearing
    # first keeps old hashed assets out
    run(ENGINE, "exec", "-u", "root", NAME, "rm", "-rf", "/app/.output/public", "/app/.output/server/chunks", "/app/.output/server/index.mjs")
    run(ENGINE, "cp", str(out / "public"), f"{NAME}:/app/.output/")
    run(ENGINE, "cp", str(out / "server" / "chunks"), f"{NAME}:/app/.output/server/")
    run(ENGINE, "cp", str(out / "server" / "index.mjs"), f"{NAME}:/app/.output/server/")
    run(ENGINE, "stop", "-t", "2", NAME)
    wait_until_port_free()
    run(ENGINE, "start", NAME)


if __name__ == "__main__":
    started = time.monotonic()
    if "--full" in sys.argv[1:] or not running():
        if "--full" not in sys.argv[1:]:
            print(f"container {NAME} is not running: full build")
        full()
    else:
        fast()
    wait_until_up()
    print(f"done in {time.monotonic() - started:.0f} s")
