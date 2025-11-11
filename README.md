<div align="center">
  <img src="https://github.com/akariwill/Otaku/blob/main/assets/images/akari.jpg" alt="logo" width="180" style="border-radius: 50%;"/>
</div>

<h1 align="center">
  WhatsApp AI Chatbot
</h1>

<p align="center">
  An intelligent WhatsApp chatbot powered by an AI backend to provide relevant and contextual responses. This project uses a two-part architecture: a WhatsApp bot frontend built with Node.js and an AI backend built with Python and FastAPI.
</p>

---

## 🤖 Architecture

This project consists of two main services working together:

1.  **WhatsApp Bot (Node.js)**:
    -   Located in the `whatsapp-bot/` directory.
    -   Uses the **Baileys** library to connect to WhatsApp.
    -   It's responsible for receiving incoming messages, sending replies, and handling basic interactions like greetings or static info.
    -   For complex questions, the bot forwards them to the AI backend via an API request.

2.  **AI Backend (Python)**:
    -   Located in the root directory.
    -   Built with **FastAPI** to provide an API endpoint (`/chat`).
    -   Uses **LangChain** and models from **OpenAI** to understand and process natural language questions.
    -   Leverages **FAISS CPU** as a vector store for relevant information retrieval (Retrieval-Augmented Generation - RAG) from available data.

<p align="center">
  <img src="https://github.com/akariwill/chatbot-ai/blob/main/assets/image/RAG%20Arch.png?raw=true" alt="Architecture Diagram" width="70%">
</p>

---

## ✨ Key Features

-   **Quick Greeting Responses**: Handles common greetings directly at the bot level for efficiency.
-   **Static Info**: Provides quick answers for common questions like addresses or technician contacts.
-   **AI Processing (RAG)**: Forwards complex questions to the Python backend for context-aware, data-driven answers.
-   **History Logging**: Saves conversation history for each user.
-   **Media Handling**: Saves media files sent by users.

---

## 🛠️ Tech Stack

| Component       | Technology                                                                                             |
|---------------|-------------------------------------------------------------------------------------------------------|
| **WhatsApp Bot**  | ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black) **Baileys, Axios, Pino** |
| **AI Backend**    | ![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white) **LangChain, OpenAI, FAISS, Uvicorn** |
| **Deployment**  | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)                                                                                             |

---

## 🚀 Installation & Usage

### 1. AI Backend (Python)

Ensure you have Python 3.8+ installed.

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/akariwill/chatbot-ai.git
    cd chatbot-ai
    ```

2.  **Create and activate a virtual environment**:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```

3.  **Install Python dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Set up environment variables**:
    -   Create a `.env` file in the root directory.
    -   Add your `OPENAI_API_KEY` to this file:
      ```
      OPENAI_API_KEY="sk-..."
      ```

5.  **Run the FastAPI server**:
    ```bash
    uvicorn app:app --host 0.0.0.0 --port 8000
    ```
    The AI server is now running at `http://localhost:8000`.

### 2. WhatsApp Bot (Node.js)

Ensure you have Node.js v16+ installed.

1.  **Navigate to the bot directory**:
    ```bash
    cd whatsapp-bot
    ```

2.  **Install Node.js dependencies**:
    ```bash
    npm install
    ```

3.  **Run the bot**:
    ```bash
    npm start
    ```
    -   A QR code will appear in the terminal.
    -   Scan the QR code with your WhatsApp mobile app (Link a device).

Once both services are running, your bot will be active and ready to respond to messages on WhatsApp.

---

## 📂 Project Structure

```
chatbot-ai/
├── whatsapp-bot/         # WhatsApp Bot Frontend (Node.js)
│   ├── index.js
│   ├── package.json
│   └── auth_info/        # (Auto-generated, ignored by Git)
├── app.py                # Entry point for the AI server (FastAPI)
├── main.py               # Core chatbot logic (LangChain)
├── requirements.txt      # Python dependencies
├── Dockerfile            # Configuration for containerization
├── assets/
│   └── Data/             # Data for RAG
└── ...
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 📞 Contact

If you have any questions or feedback, feel free to contact me on Discord `wildanjr_` or Instagram `akariwill`.