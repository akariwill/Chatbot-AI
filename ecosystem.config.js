module.exports = {
  apps : [
    {
      name: 'chatbot',
      script: '/home/noc/chatbot/app.py',
      interpreter: '/home/noc/chatbot/venv/bin/python3',
      cwd: '/home/noc/chatbot',
      watch: false,
      env: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY
      }
    },
    {
      name: 'whatsapp-bot',
      script: 'index.js',
      cwd: '/home/noc/chatbot/whatsapp-bot',
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
