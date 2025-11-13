# Deployment Guide

This guide provides instructions on how to deploy the Python backend and the WhatsApp bot web interface to separate hosting services.

## Part 1: Deploying the Python Server to PythonAnywhere

This section guides you through deploying your FastAPI application to PythonAnywhere.

### 1. Sign up for PythonAnywhere

If you don't have an account, sign up at [www.pythonanywhere.com](https://www.pythonanywhere.com). A free account is sufficient for this project.

### 2. Upload Your Code

1.  Create a `.zip` file of your Python server code (all files and folders except `whatsapp-bot`).
2.  On the PythonAnywhere **Files** tab, upload the `.zip` file and then unzip it in the console.

### 3. Set up the Web App

1.  From your PythonAnywhere dashboard, go to the **Web** tab.
2.  Click **Add a new web app**.
3.  Follow the prompts. When asked, choose **Manual configuration** and the Python version that matches your project (e.g., Python 3.10).

### 4. Set up your Virtual Environment and Install Dependencies

1.  Go to the **Consoles** tab and open a **Bash** console.
2.  Create a virtual environment for your project:
    ```bash
    mkvirtualenv --python=/usr/bin/python3.10 my-chatbot-venv
    ```
3.  Activate the virtual environment and navigate to your project directory:
    ```bash
    workon my-chatbot-venv
    cd /home/your-username/your-project-directory
    ```
4.  Install the required packages:
    ```bash
    pip install -r requirements.txt
    pip install gunicorn uvicorn
    ```

### 5. Configure the WSGI file for FastAPI

1.  Go back to the **Web** tab.
2.  In the **Code** section, click on the link to your **WSGI configuration file**.
3.  Replace the contents of this file with the following:
    ```python
    import sys
    import os

    # Add your project directory to the Python path
    path = '/home/your-username/your-project-directory'
    if path not in sys.path:
        sys.path.insert(0, path)

    # Import your FastAPI app
    from app import app as application
    ```

### 6. Configure Gunicorn in the Web Tab

1.  Go back to the **Web** tab.
2.  In the **Virtualenv** section, enter the path to your virtual environment:
    `/home/your-username/.virtualenvs/my-chatbot-venv`
3.  In the **Code** section, edit the **WSGI file** entry and replace the command with:
    ```bash
    gunicorn --workers 4 --bind 0.0.0.0:8000 -k uvicorn.workers.UvicornWorker app:app
    ```

### 7. Reload your Web App

1.  Go to the **Web** tab and click the big green **Reload** button.
2.  Your FastAPI server is now running continuously on PythonAnywhere. Your API URL will be `http://your-username.pythonanywhere.com`.

---

## Part 2: Deploying the WhatsApp Bot Web Interface to Vercel

This section guides you through deploying the Node.js `whatsapp-bot` to Vercel.

### 1. Prerequisites

*   Your Python server is deployed on PythonAnywhere and you have the URL.
*   You have a GitHub, GitLab, or Bitbucket account.

### 2. Update the API URL

1.  In your local `whatsapp-bot/index.js` file, find the line with `axios.post`.
2.  Change the URL to your PythonAnywhere server's URL:
    ```javascript
    const response = await axios.post('http://your-username.pythonanywhere.com/chat', { query: text });
    ```

### 3. Push Your Code to a Git Repository

1.  Initialize a Git repository in your `whatsapp-bot` directory.
2.  Commit all your files and push the repository to GitHub, GitLab, or Bitbucket.

### 4. Deploy to Vercel

1.  Sign up for a Vercel account at [vercel.com](https://vercel.com).
2.  From your Vercel dashboard, click **Add New...** > **Project**.
3.  Import the Git repository you just created.
4.  Vercel will automatically detect that it's a Node.js project.
5.  In the **Build and Output Settings**, ensure the following are set:
    *   **Framework Preset:** `Other`
    *   **Build Command:** `npm install`
    *   **Start Command:** `node index.js`
6.  Click **Deploy**.

### 5. Access Your QR Code

Once the deployment is complete, Vercel will provide you with a URL (e.g., `https://your-project-name.vercel.app`). Open this URL in your browser to see the WhatsApp QR code and log in.
