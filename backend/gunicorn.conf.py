# ==============================================================================
# Gunicorn Production Configuration - GarageFlow Backend
# ==============================================================================
import os
import multiprocessing

bind = "0.0.0.0:5000"
# Dynamic worker calculation respecting container limits or explicit env variable
workers = int(os.environ.get("GUNICORN_WORKERS", min(4, max(2, multiprocessing.cpu_count()))))
worker_class = "sync"
timeout = 60
keepalive = 2

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Security: do not expose server tokens
proc_name = "garageflow_api"
