"""GarageFlow Backend Extensions Module.

Initializes unconfigured extension singletons.
Configuration and application binding are performed inside the create_app factory.
"""
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_bcrypt import Bcrypt

db = SQLAlchemy()
jwt = JWTManager()
cors = CORS()
bcrypt = Bcrypt()
