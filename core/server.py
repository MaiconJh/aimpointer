# core/server.py
import asyncio
import json
import threading
import ssl
import websockets
from http.server import HTTPServer, SimpleHTTPRequestHandler

from core.security import generate_self_signed_cert
from core.mouse_controller import mouse_controller, SCREEN_WIDTH, SCREEN_HEIGHT
from core.calibration import calibration_system
from utils.network import get_local_ip

# Configurações - MESMAS do original
HTTP_PORT = 8443
WS_PORT = 8765

# REMOVIDO: Configurações globais compartilhadas
# Cada cliente agora tem suas próprias configurações locais

# Conjunto de clientes conectados - MESMA lógica
connected_clients = set()

class CORSRequestHandler(SimpleHTTPRequestHandler):
    """Handler HTTP com CORS - MESMA lógica do original"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="static", **kwargs)
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()
    
    def do_GET(self):
        if self.path == '/':
            self.path = '/index.html'
        return super().do_GET()

def run_http_server():
    """Servidor HTTP/HTTPS - MESMA lógica do original"""
    generate_self_signed_cert()
    
    local_ip = get_local_ip()
    
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain('cert.pem', 'key.pem')
    
    server = HTTPServer(('0.0.0.0', HTTP_PORT), CORSRequestHandler)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    
    print("=" * 60)
    print("SERVIDOR HTTPS")
    print("=" * 60)
    print(f"URL: https://{local_ip}:{HTTP_PORT}")
    print("=" * 60)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Servidor HTTP parado")

async def handle_websocket(websocket):
    """WebSocket para controle de ponteiro - SIMPLIFICADO"""
    print("Cliente WebSocket conectado!")
    connected_clients.add(websocket)
    
    # Variáveis por cliente - MESMA lógica
    calibration = {'x': 0, 'y': 0, 'z': 0}
    control_mode = "absolute"
    
    # REMOVIDO: Envio de configurações globais
    # Envia apenas informações essenciais
    await websocket.send(json.dumps({
        "message": "Conectado!",
        "status": "connected",
        "calibration": calibration,
        "control_mode": control_mode,
        "screen_width": SCREEN_WIDTH,
        "screen_height": SCREEN_HEIGHT
    }))
    
    try:
        async for message in websocket:
            data = json.loads(message)
            
            if data.get('type') == 'absolute_position':
                # Posição absoluta do ponteiro - MESMA lógica
                x = data.get('x', 0)
                y = data.get('y', 0)
                
                # Garantir que está dentro dos limites da tela - MESMA lógica
                x = max(0, min(SCREEN_WIDTH - 1, x))
                y = max(0, min(SCREEN_HEIGHT - 1, y))
                
                mouse_controller.set_mouse_absolute(x, y)
                
            elif data.get('type') == 'click':
                # Clique instantâneo - MESMA lógica
                button = data.get('button', 'left')
                mouse_controller.mouse_click(button)
                
            elif data.get('type') == 'calibrate':
                # Calibração avançada - MESMA lógica
                current_orientation = data.get('orientation', {})
                calibration = calibration_system.update_calibration(current_orientation)
                
                await websocket.send(json.dumps({
                    "type": "calibration_updated",
                    "calibration": calibration
                }))
                
            elif data.get('type') == 'reset_calibration':
                calibration = calibration_system.reset_calibration()
                
                await websocket.send(json.dumps({
                    "type": "calibration_updated", 
                    "calibration": calibration
                }))
                
            # REMOVIDO: Atualização de configurações globais
            # Cada cliente agora gerencia suas próprias configurações
                
    except Exception as e:
        print(f"Erro WebSocket: {e}")
    finally:
        connected_clients.discard(websocket)

async def run_websocket_server():
    """Servidor WebSocket seguro - MESMA lógica do original"""
    generate_self_signed_cert()
    
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain('cert.pem', 'key.pem')
    
    async with websockets.serve(handle_websocket, "0.0.0.0", WS_PORT, ssl=ssl_context):
        local_ip = get_local_ip()
        print("=" * 60)
        print("WEBSOCKET - MODO CONTROLE")
        print("=" * 60)
        print(f"URL: wss://{local_ip}:{WS_PORT}")
        print(f"Resolução da tela: {SCREEN_WIDTH}x{SCREEN_HEIGHT}")
        print("=" * 60)
        print("Aguardando conexões...")
        await asyncio.Future()

async def start_servers():
    """Inicia ambos os servidores - MESMA lógica do original"""
    generate_self_signed_cert()
    
    # Servidor HTTP em thread separada
    http_thread = threading.Thread(target=run_http_server, daemon=True)
    http_thread.start()
    
    await asyncio.sleep(1)
    await run_websocket_server()