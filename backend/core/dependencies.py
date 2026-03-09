from core.engine import AgenticEmpathySystem

# Biến global lưu trữ instance
system_instance = None

def get_system() -> AgenticEmpathySystem:
    """Dependency injection để các API dùng chung 1 bộ não"""
    global system_instance
    if system_instance is None:
        system_instance = AgenticEmpathySystem()
    return system_instance