import subprocess
import time
import os
import sys

# Set environment
os.environ['PYTHONPATH'] = os.getcwd()
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

print("Starting backend...")
process = subprocess.Popen(
    [r".\backend\venv\Scripts\python.exe", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"],
    stdout=open("backend_stdout.log", "w"),
    stderr=open("backend_stderr.log", "w"),
    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
)

print(f"Backend started with PID {process.pid}")

# Wait a bit
for i in range(10):
    time.sleep(1)
    if process.poll() is not None:
        print(f"Backend exited early with code {process.returncode}")
        break
    print(f"Still running... {i+1}s")
else:
    print("Backend seems to be running fine.")
