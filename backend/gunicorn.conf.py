# ==============================================================================
# Gunicorn Production Configuration - GarageFlow Backend
# ==============================================================================
import multiprocessing

bind = "0.0.0.0:5000"
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
timeout = 60
keepalive = 2

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Security: do not expose server tokens
proc_name = "garageflow_api"
