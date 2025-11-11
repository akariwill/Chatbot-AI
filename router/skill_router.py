from agents.billing_agent import BillingAgent
from agents.troubleshooting_agent import TroubleshootingAgent
from chains.qa_chain import run_rag_qa

class SkillRouter:
    def __init__(self):
        self.agents = [BillingAgent(), TroubleshootingAgent()]

    def classify_intent(self, message: str) -> str:
        # Sederhana: bisa ditingkatkan pakai LLM atau model klasifikasi
        if any(keyword in message.lower() for keyword in ["tagihan", "bayar", "pembayaran"]):
            return "billing"
        elif any(keyword in message.lower() for keyword in ["jaringan", "lemot", "tidak konek", "troubleshoot"]):
            return "troubleshooting"
        else:
            return "rag"  # default ke LangChain RAG

    def route(self, message: str) -> str:
        intent = self.classify_intent(message)
        for agent in self.agents:
            if agent.can_handle(intent):
                return agent.run(message)
        return run_rag_qa(message)
