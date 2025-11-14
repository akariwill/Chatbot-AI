document.addEventListener('DOMContentLoaded', () => {
    const qrImage = document.getElementById('qrImage');
    const qrCodeContainer = document.getElementById('qrCodeContainer');
    const status = document.getElementById('status');

    function showLoader() {
        const loader = document.createElement('div');
        loader.className = 'loader';
        qrCodeContainer.appendChild(loader);
        qrImage.classList.remove('loaded');
    }

    function hideLoader() {
        const loader = qrCodeContainer.querySelector('.loader');
        if (loader) {
            loader.remove();
        }
        qrImage.classList.add('loaded');
    }

    async function fetchQR() {
        showLoader();
        status.textContent = 'Fetching new QR code...';
        try {
            const res = await fetch("/api/qr");
            const data = await res.json();
            if (data.qr) {
                qrImage.src = data.qr;
                status.textContent = 'QR code loaded. Please scan.';
                hideLoader();
            } else {
                status.textContent = 'Could not fetch QR code. Retrying...';
            }
        } catch (err) {
            console.error(err);
            status.textContent = 'Error fetching QR code. Check console for details.';
        }
    }

    fetchQR();
    setInterval(fetchQR, 15000);
});