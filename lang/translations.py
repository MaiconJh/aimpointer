"""
Sistema de internacionalização do AimPointer
"""

LANGUAGES = {
    "en": {
        # App info
        "app_name": "AimPointer",
        "app_description": "Mouse Control via Motion Sensors using Smartphone",
        
        # Status
        "status_connected": "Connected",
        "status_disconnected": "Disconnected", 
        "status_active": "Active",
        "status_calibrating": "Calibrating",
        
        # Buttons
        "buttons_connect": "Connect WebSocket",
        "buttons_disconnect": "Disconnect WebSocket",
        "buttons_enable_sensors": "Enable Sensors",
        "buttons_disable_sensors": "Disable Sensors",
        "buttons_left_click": "Left Click",
        "buttons_right_click": "Right Click",
        "buttons_start_calibration": "Start Calibration",
        "buttons_reset_calibration": "Reset Calibration",
        
        # Menu & Sections
        "menu_settings": "Settings",
        "menu_connection": "Connection",
        "menu_sensors": "Sensors", 
        "menu_sensitivity": "Sensitivity",
        "menu_calibration": "Calibration",
        "menu_stabilization": "Stabilization",
        
        # Labels
        "labels_server_ip": "Server IP",
        "labels_direction_x": "Direction X",
        "labels_direction_y": "Direction Y",
        "labels_rotation_z": "Rotation Z",
        "labels_accuracy": "Accuracy",
        "labels_sensitivity": "Sensitivity",
        "labels_smoothing": "Smoothing",
        "labels_compensation": "Compensation",
        "labels_sensor_fusion": "Sensor Fusion",
        
        # Messages
        "messages_connecting": "Connecting to server...",
        "messages_connected": "Connected successfully!",
        "messages_disconnected": "Disconnected",
        "messages_sensor_error": "Sensor error - check permissions",
        "messages_calibration_complete": "Calibration completed successfully!",
        "messages_calibration_started": "Calibration started - follow the steps",
        "messages_initial_position_set": "Initial position set!",
        
        # Instructions
        "instructions_title": "Pointer Control",
        "instructions_body": "Point the device like a remote control. The cursor will naturally follow your direction.",
        "instructions_calibration": "Keep the device stable during calibration for best results.",
        
        # Calibration Steps
        "calibration_step1": "Set initial reference position",
        "calibration_step2": "Rotate 90° to the left", 
        "calibration_step3": "Rotate 90° to the right",
        "calibration_step4": "Return to initial position",
        
        # Errors
        "error_connection_failed": "Connection failed - check IP and server",
        "error_sensors_not_supported": "Motion sensors not supported by browser",
        "error_permission_denied": "Permission denied for motion sensors",
        
        # Performance
        "performance_fps": "FPS",
        "performance_resolution": "Resolution",
        "performance_latency": "Latency"
    },
    
    "pt": {
        # App info
        "app_name": "AimPointer",
        "app_description": "Controle de Mouse por Movimento usando Celular",
        
        # Status
        "status_connected": "Conectado",
        "status_disconnected": "Desconectado",
        "status_active": "Ativo", 
        "status_calibrating": "Calibrando",
        
        # Buttons
        "buttons_connect": "Conectar WebSocket",
        "buttons_disconnect": "Desconectar WebSocket",
        "buttons_enable_sensors": "Ativar Sensores",
        "buttons_disable_sensors": "Desativar Sensores",
        "buttons_left_click": "Clique Esquerdo",
        "buttons_right_click": "Clique Direito", 
        "buttons_start_calibration": "Iniciar Calibração",
        "buttons_reset_calibration": "Resetar Calibração",
        
        # Menu & Sections
        "menu_settings": "Configurações",
        "menu_connection": "Conexão",
        "menu_sensors": "Sensores",
        "menu_sensitivity": "Sensibilidade",
        "menu_calibration": "Calibração",
        "menu_stabilization": "Estabilização",
        
        # Labels
        "labels_server_ip": "IP do Servidor",
        "labels_direction_x": "Direção X",
        "labels_direction_y": "Direção Y",
        "labels_rotation_z": "Rotação Z",
        "labels_accuracy": "Precisão", 
        "labels_sensitivity": "Sensibilidade",
        "labels_smoothing": "Suavização",
        "labels_compensation": "Compensação",
        "labels_sensor_fusion": "Fusão de Sensores",
        
        # Messages
        "messages_connecting": "Conectando ao servidor...",
        "messages_connected": "Conectado com sucesso!",
        "messages_disconnected": "Desconectado",
        "messages_sensor_error": "Erro nos sensores - verifique permissões",
        "messages_calibration_complete": "Calibração concluída com sucesso!",
        "messages_calibration_started": "Calibração iniciada - siga os passos",
        "messages_initial_position_set": "Posição inicial definida!",
        
        # Instructions
        "instructions_title": "Controle por Ponteiro",
        "instructions_body": "Aponte o dispositivo como um controle remoto. O cursor seguirá naturalmente sua direção.",
        "instructions_calibration": "Mantenha o dispositivo estável durante a calibração para melhores resultados.",
        
        # Calibration Steps
        "calibration_step1": "Defina a posição inicial de referência",
        "calibration_step2": "Gire 90° para a esquerda",
        "calibration_step3": "Gire 90° para a direita", 
        "calibration_step4": "Volte para a posição inicial",
        
        # Errors
        "error_connection_failed": "Conexão falhou - verifique IP e servidor",
        "error_sensors_not_supported": "Sensores de movimento não suportados pelo navegador",
        "error_permission_denied": "Permissão negada para sensores de movimento",
        
        # Performance
        "performance_fps": "FPS",
        "performance_resolution": "Resolução",
        "performance_latency": "Latência"
    }
}

def get_translation(lang="en"):
    """Retorna as traduções para o idioma especificado"""
    return LANGUAGES.get(lang, LANGUAGES["en"])

def get_available_languages():
    """Retorna lista de idiomas disponíveis"""
    return list(LANGUAGES.keys())

def translate(key, lang="en", default=None):
    """Traduz uma chave específica"""
    translations = get_translation(lang)
    return translations.get(key, default or key)

# Instância global para fácil acesso
current_language = "en"
translations = get_translation(current_language)

def set_language(lang):
    """Define o idioma atual globalmente"""
    global current_language, translations
    if lang in LANGUAGES:
        current_language = lang
        translations = get_translation(lang)
        return True
    return False

def t(key, default=None):
    """Função de atalho para tradução rápida"""
    return translate(key, current_language, default)