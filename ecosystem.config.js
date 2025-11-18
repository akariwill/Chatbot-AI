module.exports = {
  apps : [
    {
      name: 'chatbot',
      script: 'app.py',
      interpreter: './venv/bin/python3',
      cwd: '/path/to/your/project/', // <-- GANTI DENGAN PATH ABSOLUT PROYEK ANDA
      watch: false,
      env: {
        "NODE_ENV": "production",
      }
    },
    {
      name: 'whatsapp-bot',
      script: 'index.js',
      cwd: '/path/to/your/project/whatsapp-bot/', // <-- GANTI DENGAN PATH ABSOLUT PROYEK ANDA
      watch: false,
      autorestart: false, // <-- PENTING: Jangan restart otomatis, biarkan skrip internal yang menangani
      env: {
        "NODE_ENV": "production",
      }
    }
  ]
};
