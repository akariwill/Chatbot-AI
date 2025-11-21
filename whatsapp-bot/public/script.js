document.addEventListener('DOMContentLoaded', () => {
    const statusText = document.getElementById('status-text');
    const qrContainer = document.getElementById('qr-container');
    const qrImage = document.getElementById('qr-image');
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const logoutButton = document.getElementById('logout-button');
    const regenerateQrButton = document.getElementById('regenerate-qr-button');

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
            console.error('QR コードの取得中にエラーが発生しました:', error);
            qrContainer.style.display = 'none';
        }
    };
    
    regenerateQrButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/regenerate-qr', { method: 'POST' });
            if(response.ok) {
                await fetchQrCode();
            } else {
                alert('QR コードの再生成に失敗しました。');
            }
        } catch (error) {
            console.error('QR コードの再生成中にエラーが発生しました:', error);
            alert('QR コードの再生成に失敗しました。');
        }
    });

    const checkStatus = async () => {
        try {
            const response = await fetch('/api/status');
            if (!response.ok) {
                throw new Error('ネットワーク応答が正常ではありませんでした');
            }
            const data = await response.json();

            switch (data.status) {
                case 'CONNECTED':
                    loginView.style.display = 'none';
                    dashboardView.style.display = 'block';
                    // 接続時にポーリングを停止する
                    if (statusInterval) clearInterval(statusInterval);
                    break;

                case 'WAITING_FOR_QR':
                    dashboardView.style.display = 'none';
                    loginView.style.display = 'block';
                    statusText.textContent = 'QRコードスキャンを待っています...';
                    await fetchQrCode();
                    break;

                case 'CONNECTING':
                    dashboardView.style.display = 'none';
                    loginView.style.display = 'block';
                    qrContainer.style.display = 'none';
                    statusText.textContent = '接続中...';
                    break;

                case 'DISCONNECTED':
                default:
                    dashboardView.style.display = 'none';
                    loginView.style.display = 'block';
                    qrContainer.style.display = 'none';
                    statusText.textContent = '切断されました。再接続を試行しています...';
                    break;
            }
        } catch (error) {
            console.error('ステータスの取得中にエラーが発生しました:', error);
            statusText.textContent = 'エラー: サーバーに接続できませんでした。';
        }
    };

    logoutButton.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            alert('ログアウトに成功しました。新しいQRコードを取得するためにページを再読み込みします。');
            window.location.reload();
        } catch (error) {
            console.error('ログアウトエラー:', error);
            alert('ログアウトに失敗しました。');
        }
    });

    // 投票を開始する
    statusInterval = setInterval(checkStatus, 2000); // 2秒ごとにポーリング
    checkStatus(); // 初期チェック
});
