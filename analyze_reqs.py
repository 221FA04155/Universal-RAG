
import os

log_path = r"c:\Users\Manikanta\Desktop\Dynamic-AI-Assistant\Dynamic-AI-Assistant-BD-main\backend.log"

def analyze_requests():
    if not os.path.exists(log_path): return
    with open(log_path, 'r', encoding='utf-16', errors='replace') as f:
        lines = f.readlines()
        
    for i in range(len(lines)-1, max(-1, len(lines)-100), -1):
        line = lines[i]
        if "POST /api/assistants/" in line and "/upload" in line:
            print(f"Upload Req: {line.strip()}")
            # Search backwards for the user ID log right before this request
            for j in range(i, max(-1, i-20), -1):
                if "Listing assistants for user" in lines[j]:
                    print(f"  User context: {lines[j].strip()}")
                    break
                    
if __name__ == "__main__":
    analyze_requests()
