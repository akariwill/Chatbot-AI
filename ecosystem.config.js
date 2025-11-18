module.exports = {
  apps: [
    {
      name: "chatbot",
      script: "app.py",
      interpreter: "/home/noc/chatbot/venv/bin/python3",  
      cwd: "/home/noc/chatbot",
      watch: false,
      env: {
        NODE_ENV: "production",
        OPENAI_API_KEY: "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"    
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
        OPENAI_API_KEY: "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"    
      }
    }
  ]
}
