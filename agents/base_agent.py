class BaseAgent:
    def can_handle(self, intent: str) -> bool:
        raise NotImplementedError

    def run(self, message: str) -> str:
        raise NotImplementedError
