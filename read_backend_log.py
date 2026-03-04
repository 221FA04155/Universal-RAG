
import os

log_path = r"c:\Users\Manikanta\Desktop\Dynamic-AI-Assistant\Dynamic-AI-Assistant-BD-main\backend.log"

def read_log(path):
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return
        
    # Try different encodings
    for encoding in ['utf-16', 'utf-16-le', 'utf-16-be', 'utf-8', 'latin-1']:
        try:
            with open(path, 'r', encoding=encoding) as f:
                content = f.read()
                print(f"--- Log content (Encoding: {encoding}) ---")
                # Print last 1000 characters
                print(content[-2000:])
                return
        except Exception:
            continue
    print("Failed to read log with any common encoding.")

if __name__ == "__main__":
    read_log(log_path)
