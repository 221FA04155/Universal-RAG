@echo off
set PYTHONPATH=%CD%
set KMP_DUPLICATE_LIB_OK=TRUE
set OMP_NUM_THREADS=1
set FOR_DISABLE_CONSOLE_CTRL_HANDLER=T
backend\venv\Scripts\python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 1
