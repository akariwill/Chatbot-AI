document.addEventListener('DOMContentLoaded', () => {
    const qrCodeCanvas = document.getElementById('qrCodeCanvas');
    const eventSource = new EventSource('/events');

    eventSource.onmessage = function(event) {
        const qrData = event.data;
        if (qrData) {
            try {
                new QRious({
                    element: qrCodeCanvas,
                    value: qrData,
                    size: 250,
                    level: 'H'
                });
                console.log("QR code generated.");
            } catch (error) {
                console.error("Error generating QR code:", error);
            }
        }
    };

    eventSource.onerror = function(err) {
        console.error("EventSource failed:", err);
    };
});