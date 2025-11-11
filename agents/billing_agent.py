from agents.base_agent import BaseAgent

class BillingAgent(BaseAgent):
    def can_handle(self, intent: str) -> bool:
        return intent == "billing"

    def run(self, message: str) -> str:
        return "Tagihan Anda bulan ini adalah Rp 250.000. Jika sudah bayar, abaikan pesan ini 😊"
