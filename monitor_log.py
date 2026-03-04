
import os
import time

log_path = r"c:\Users\Manikanta\Desktop\Dynamic-AI-Assistant\Dynamic-AI-Assistant-BD-main\backend.log"

def monitor_log(path, duration=15):
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return
        
    print(f"Monitoring {path} for {duration} seconds...")
    start_time = time.time()
    last_size = os.path.getsize(path)
    
    while time.time() - start_time < duration:
        current_size = os.path.getsize(path)
        if current_size > last_size:
            with open(path, 'r', encoding='utf-16') as f:
                f.seek(last_size)
                new_content = f.read()
                if new_content:
                    print(new_content, end='')
            last_size = current_size
        time.sleep(1)

if __name__ == "__main__":
    monitor_log(log_path)
