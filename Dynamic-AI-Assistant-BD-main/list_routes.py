import os
import sys

# Add current directory to path
sys.path.append(os.getcwd())

from backend.main import app

print("Listing routes:")
for route in app.routes:
    methods = getattr(route, "methods", None)
    path = getattr(route, "path", None)
    print(f"{methods} {path}")
