document.addEventListener('DOMContentLoaded', () => {
    const statusText = document.getElementById('status-text');
    const qrContainer = document.getElementById('qr-container');
    const qrImage = document.getElementById('qr-image');
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const logoutButton = document.getElementById('logout-button');

    let statusInterval;

    const fetchQrCode = async () => {
        try {
            const response = await fetch('/api/qr');
            if (response.ok) {
                const data = await response.json();
                qrImage.src = data.qr;
                qrContainer.style.display = 'block';
            } else {
                qrContainer.style.display = 'none';
            }
        } catch (error) {
            console.error('Error fetching QR code:', error);
            qrContainer.style.display = 'none';
        }
    };

    const checkStatus = async () => {
        try {
            const response = await fetch('/api/status');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();

            switch (data.status) {
                case 'CONNECTED':
                    loginView.style.display = 'none';
                    dashboardView.style.display = 'block';
                    // Stop polling when connected
                    if (statusInterval) clearInterval(statusInterval);
                    break;

                case 'WAITING_FOR_QR':
                    dashboardView.style.display = 'none';
                    loginView.style.display = 'block';
                    statusText.textContent = 'Waiting for QR Code Scan...';
                    await fetchQrCode();
                    break;

                case 'CONNECTING':
                    dashboardView.style.display = 'none';
                    loginView.style.display = 'block';
                    qrContainer.style.display = 'none';
                    statusText.textContent = 'Connecting...';
                    break;

                case 'DISCONNECTED':
                default:
                    dashboardView.style.display = 'none';
                    loginView.style.display = 'block';
                    qrContainer.style.display = 'none';
                    statusText.textContent = 'Disconnected. Attempting to reconnect...';
                    break;
            }
        } catch (error) {
            console.error('Error fetching status:', error);
            statusText.textContent = 'Error: Could not connect to the server.';
        }
    };

    logoutButton.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            alert('Logged out successfully. The page will now reload to get a new QR code.');
            window.location.reload();
        } catch (error) {
            console.error('Error logging out:', error);
            alert('Failed to log out.');
        }
    });

    // Start polling
    statusInterval = setInterval(checkStatus, 2000); // Poll every 2 seconds
    checkStatus(); // Initial check
});
