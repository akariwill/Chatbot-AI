from agents.base_agent import BaseAgent

class TroubleshootingAgent(BaseAgent):
    def can_handle(self, intent: str) -> bool:
        return intent == "troubleshooting"

    def run(self, message: str) -> str:
        return "Silakan cabut kabel modem selama 10 detik, lalu pasang kembali. Jika masih bermasalah, hubungi teknisi di 085172051808."
