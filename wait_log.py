
import os
import time

log_path = r"c:\Users\Manikanta\Desktop\Dynamic-AI-Assistant\live_backend.log"

def wait_for_user():
    print("Waiting for activity in live_backend.log...")
    last_pos = os.path.getsize(log_path)
    start_time = time.time()
    
    while time.time() - start_time < 30: # Wait 30s
        if os.path.getsize(log_path) > last_pos:
            with open(log_path, 'r') as f:
                f.seek(last_pos)
                content = f.read()
                if content:
                    print(content, end='')
            last_pos = os.path.getsize(log_path)
        time.sleep(1)

if __name__ == "__main__":
    wait_for_user()
