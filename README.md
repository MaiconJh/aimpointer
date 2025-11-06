```markdown
# AimPointer

Controle do mouse usando os sensores de movimento do celular (AimPointer).

Resumo
------
AimPointer é um servidor HTTPS + WebSocket que recebe dados de orientação do sensor do celular (DeviceOrientation) e controla o ponteiro do mouse em uma máquina (implementação atual focada em Windows). A interface web (cliente) captura os sensores do navegador e envia posições absolutas via WSS para o servidor, que posiciona o cursor e dispara cliques.

Principais funcionalidades
- Servidor HTTPS (porta 8443) que serve a interface web.
- Servidor WebSocket seguro (WSS, porta 8765) para transmitir posições e comandos.
- Geração automática de certificados SSL autoassinados (quando inexistentes).
- Calibração avançada baseada na posição inicial e passos guiados.
- Visualizador 3D do dispositivo (Three.js) no cliente para feedback em tempo real.
- Controles de sensibilidade, suavização e compensação.

Requisitos
----------
- Python 3.8+ (recomendado 3.10+)
- Windows para controle do mouse (a implementação atual usa chamadas Win32 via ctypes)
- Navegador moderno no celular (Chrome/Android testado; iOS tem restrições adicionais)
- Rede local com comunicação entre celular e máquina (mesma rede Wi‑Fi ou rota acessível)

Dependências (instalar no venv)
- websockets
- cryptography

Exemplo rápido:
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux / macOS
# source venv/bin/activate

pip install websockets cryptography
python main.py
```

Observação: se preferir, crie um arquivo requirements.txt com:
```
websockets
cryptography
```

Como executar
--------------
1. Clone o repositório e entre na pasta do projeto.
2. Crie e ative um ambiente virtual (recomendado).
3. Instale dependências (ver seção acima).
4. Execute:
   ```bash
   python main.py
   ```
   - O servidor HTTPS será iniciado (porta 8443) para servir a interface web.
   - O servidor WebSocket seguro (WSS) será iniciado (porta 8765) para receber dados do cliente.

Certificados TLS
----------------
- O projeto gera automaticamente um par cert.pem / key.pem se eles não existirem (função em core/security.py).
- Como são certificados autoassinados, o navegador do celular pedirá que você aceite o certificado. Em alguns dispositivos (iOS) pode ser necessário instalar o certificado como CA confiável ou usar um túnel/NGROK com HTTPS válido.
- Arquivos gerados: `cert.pem`, `key.pem` — localizados na raiz do projeto por padrão.

Uso do cliente (no celular)
---------------------------
1. No celular, abra o navegador e acesse:
   https://<IP_DO_SERVIDOR>:8443
   (substitua <IP_DO_SERVIDOR> pelo IP local mostrado no terminal ao iniciar o servidor).
2. Aceite o certificado autoassinado (ou instale-o).
3. No painel de configurações do cliente:
   - Ajuste o IP do servidor (se necessário) e clique em "Conectar WebSocket".
   - Clique em "Ativar Sensores" e conceda permissão quando solicitado.
   - Use os botões de clique (Esquerdo/Direito) conforme necessário.
   - Use a seção de Sensibilidade / Calibração para ajustar o comportamento do cursor.

Portas e configuração
---------------------
- HTTPS (arquivo estático): porta padrão 8443
- WSS (WebSocket seguro): porta padrão 8765
- Para alterar portas ou caminhos, edite `config/settings.py`.

Como funciona a calibração
--------------------------
- O cliente possui um sistema de calibração que define uma posição inicial de referência e passos (giro 90° à esquerda/direita, retorno).
- A calibração é aplicada ao sistema de conversão de ângulos em coordenadas de tela e também é enviada ao servidor para persistência local do host.

Limitações e observações importantes
-----------------------------------
- Implementação do mouse baseada em Win32 (ctypes). Testado em Windows — em outros SOs o controle do mouse não funcionará sem adaptação.
- Navegadores modernos limitam acesso aos sensores de movimento:
  - No iOS é necessário usar HTTPS e pedir permissão via DeviceOrientationEvent.requestPermission() — o cliente já tenta fazê-lo, mas comportamento depende do navegador/versão.
- Certificados autoassinados gerarão avisos no navegador. Para uso mais fluido, use um certificado emitido por CA confiável ou túnel HTTPS (ex.: ngrok).
- Firewall/antivírus podem bloquear as portas 8443/8765. Abra-as ou ajuste regras se necessário.
- O servidor escuta em 0.0.0.0; certifique-se que a máquina esteja na mesma rede do celular.

Solução de problemas (rápido)
-----------------------------
- "Não consigo conectar via WSS": verifique IP, portas, se o processo Python está rodando e aceite o certificado no navegador.
- "Sensores não ativam / permissão negada": no iOS/ Safari/ algumas versões de browsers, a permissão é feita por API específica e só após interação do usuário.
- "Cursor não se move": confirme que está em Windows e que o servidor tem permissões adequadas; verifique mensagens de erro no terminal.
- "FPS baixo / envio lento": o envio é limitado por SEND_INTERVAL (~16ms). Ajuste em config/settings.py se necessário.

Contribuição
------------
Contribuições são bem-vindas! Algumas ideias:
- Suporte multiplataforma para controle do mouse (Linux/macOS).
- Mecanismo de autenticação para clientes WebSocket.
- Persistência de configurações por cliente (arquivo JSON / DB).
- Melhorias na UI/UX do cliente (toasts, testes de usabilidade).
- Suporte a certificados válidos (Let's Encrypt / ACME) e integração automática para exposição externa.

Estrutura de diretórios (resumida)
---------------------------------
- main.py — entrypoint
- config/ — configurações do sistema
- core/ — implementações principais (server, mouse_controller, security, calibration)
- static/ — cliente web (index.html, js/, css/)
- utils/ — utilitários (network, helpers)

Licença
-------
MIT — veja o arquivo LICENSE.

Contato
-------
Autor: MaiconJh
Repositório: https://github.com/MaiconJh/aimpointer
```