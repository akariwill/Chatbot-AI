module.exports = {
  apps : [
    {
      name: "chatbot",
      script: "app.py",
      cwd: "/home/noc/chatbot",
      interpreter: "/home/noc/chatbot/venv/bin/python3",
      watch: false,
      env: {
        NODE_ENV: "production",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        LANGCHAIN_TRACING_V2: "false"
      }
    },
    {
      name: "whatsapp-bot",
      script: "index.js",
      cwd: "/home/noc/chatbot/whatsapp-bot",
      watch: false,
      autorestart: true, 
      env: {
        NODE_ENV: "production",
        CHATBOT_API_URL: "http://160.25.222.84:8001/chat"
      }
    }
  ]
};
