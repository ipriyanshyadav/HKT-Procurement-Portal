import os
import logging
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_keys():
    private_key_path = os.environ.get("JWT_PRIVATE_KEY_PATH", "keys/private.pem")
    public_key_path = os.environ.get("JWT_PUBLIC_KEY_PATH", "keys/public.pem")
    
    os.makedirs(os.path.dirname(private_key_path), exist_ok=True)
    
    if os.path.exists(private_key_path) and os.path.exists(public_key_path):
        logger.info("Keys already exist, skipping generation.")
        return

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    with open(private_key_path, "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ))
        
    public_key = private_key.public_key()
    with open(public_key_path, "wb") as f:
        f.write(public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ))

    logger.info("Generated new RSA keys.")

if __name__ == "__main__":
    generate_keys()
