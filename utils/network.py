# utils/network.py
import socket

def get_local_ip():
    """ObtÃ©m IP local - MESMA lÃ³gica do original"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except:
        return "127.0.0.1"
