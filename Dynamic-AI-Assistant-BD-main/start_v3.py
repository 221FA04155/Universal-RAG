import subprocess
import os
import sys
import time

# Set working directory to the script's directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Environment setup
env = os.environ.copy()
env['PYTHONPATH'] = os.getcwd()
env['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

print(f"Working Directory: {os.getcwd()}")
print(f"PYTHONPATH: {env['PYTHONPATH']}")

log_file = open("startup_v3.log", "w")

try:
    process = subprocess.Popen(
        [r".\backend\venv\Scripts\python.exe", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"],
        stdout=log_file,
        stderr=log_file,
        env=env,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
    )
    print(f"Started PID: {process.pid}")
    
    # Wait and check
    for i in range(5):
        time.sleep(1)
        if process.poll() is not None:
            print(f"Exited with code: {process.returncode}")
            break
        print(f"Running... {i+1}")
    else:
        print("Still running after 5s. Success?")
        
except Exception as e:
    print(f"Error: {e}")
finally:
    log_file.close()
