# 🎯 AimPointer

**Controle de Mouse por Movimento usando Sensores do Celular**

Transforme seu smartphone em um controle de movimento preciso para o mouse do computador. Ideal para apresentações, gaming ou controle remoto.

![Python](https://img.shields.io/badge/Python-3.8%2B-blue)
![Windows](https://img.shields.io/badge/Platform-Windows%2010%2F11-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Características

- 🎮 **Controle por Movimento** - Use os sensores giroscópios do celular como controle
- 📱 **Interface Web Responsiva** - Funciona em qualquer navegador moderno
- 🔒 **Conexão Segura** - SSL com certificados auto-assinados
- ⚙️ **Sistema de Calibração Avançado** - Calibração precisa para melhor experiência
- 🖱️ **Cliques Completos** - Suporte a clique esquerdo e direito
- 🌐 **Tempo Real** - Comunicação via WebSocket para baixa latência

## 🚀 Começo Rápido

### Pré-requisitos
- Python 3.8 ou superior
- Windows 10/11
- Smartphone com navegador moderno
- Ambos na mesma rede Wi-Fi

### Instalação
# Clone o repositório
```bash
git clone https://github.com/MaiconJh/aimpointer.git
cd aimpointer
```

# Instale as dependências
```bash
pip install -r requirements.txt
```

# Execute o servidor
python main.py

Uso
Execute o servidor no computador

Anote o IP mostrado no terminal

No celular, acesse: https://IP-DO-PC:8443

Conecte o WebSocket e ative os sensores

Aponte e controle!

`
📁 Estrutura do Projeto
aimpointer/
├── .git/
├── .gitattributes
├── .gitignore
├── LICENSE
├── README.md
├── config/
│   ├── __init__.py
│   └── settings.py
├── core/
│   ├── __init__.py
│   ├── calibration.py
│   ├── mouse_controller.py
│   ├── security.py
│   └── server.py
├── docs/
│   ├── setup.md
│   └── usage.md
├── lang/
│   └── translations.py
├── main.py
├── requirements.txt
├── static/
│   ├── css/
│   │   ├── style.css
│   │   └── threejs-visualizer.css
│   ├── index.html
│   └── js/
│       ├── app.js
│       └── threejs-visualizer.js
└── utils/
    ├── __init__.py
    ├── helpers.py
    └── network.py
`

🛠️ Desenvolvimento
Requisitos de Desenvolvimento
Python 3.8+

Windows 10/11

Navegador com suporte a DeviceOrientation API

Executando em Desenvolvimento
bash
python main.py
🤝 Contribuindo
Contribuições são bem-vindas! Siga estos passos:

Fork o projeto

Crie uma branch: git checkout -b feature/nova-funcionalidade

Commit: git commit -am 'Adiciona nova funcionalidade'

Push: git push origin feature/nova-funcionalidade

Abra um Pull Request

📄 Licença
Distribuído sob licença MIT. Veja LICENSE para mais informações.

🐛 Reportar Problemas
Encontrou um bug? Abra uma issue com detalhes.

🙋‍♂️ Suporte
📖 Documentação Completa

🐛 Reportar Bugs

💡 Sugerir Funcionalidades

Desenvolvido com ❤️ para a comunidade de código aberto


⚠️ Nota: Este projeto atualmente funciona apenas no Windows devido às dependências do sistema de controle do mouse.



