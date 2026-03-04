
import os

log_path = r"c:\Users\Manikanta\Desktop\Dynamic-AI-Assistant\Dynamic-AI-Assistant-BD-main\backend.log"

def find_user():
    if not os.path.exists(log_path):
        print("Log not found")
        return
        
    with open(log_path, 'r', encoding='utf-16', errors='replace') as f:
        lines = f.readlines()
        
    found = False
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i]
        if "Listing assistants for user" in line:
            print(f"Found at line {i}: {line.strip()}")
            # Print next line which should be "Found X assistants"
            if i + 1 < len(lines):
                print(f"Next line: {lines[i+1].strip()}")
            found = True
            break
            
    if not found:
        print("No 'Listing assistants' log found. Maybe the endpoint wasn't hit or logging wasn't reloaded.")

if __name__ == "__main__":
    find_user()
