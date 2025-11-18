module.exports = {
  apps : [
    {
      name: 'chatbot',
      script: 'app.py',
      interpreter: './venv/bin/python3',
      cwd: '/chatbot/', 
      watch: false,
      env: {
        "NODE_ENV": "production",
      }
    },
    {
      name: 'whatsapp-bot',
      script: 'index.js',
      cwd: '/chatbot/whatsapp-bot/', 
      watch: false,
      autorestart: false, 
      env: {
        "NODE_ENV": "production",
      }
    }
  ]
};
