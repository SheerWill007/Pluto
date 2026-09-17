from memory.redis_memory import get_history ,save_message , clear_history
from memory.postgres_memory import get_facts , clear_facts , save_fact

TRIGGER_PHRASES = ["remember that", "remember this", "don't forget", "please remember"]

# def handel_message(session_id : str , role : str , content : str , user_id : str = None):
#     save_message(session_id, role , content , user_id)
#
# def check_and_save_fact(session_id: str, content: str, user_id: str = None) -> bool:
#     """
#         Checks if content contains a trigger phrase. If so, saves it as a fact
#         and returns True. Otherwise returns False.
#     """
#
#     lowered = content.lower()
#
#     for phrase in TRIGGER_PHRASES:
#         if phrase in lowered:
#             save_fact(session_id , content , user_id)
#             return True
#
#     return False
#
# def get_context(session_id: str, user_id: str = None) -> dict:
#     """
#     Returns both short-term and long-term memory for a session,
#     used by the orchestrator to build context before calling the LLM.
#     """
#     return {
#         "recent_history": get_history(session_id),
#         "remembered_facts": get_facts(session_id,user_id)
#     }

def handle_message(session_id : str , role : str , content: str , user_id : str = None):
    save_message(session_id, role , content, user_id)

def check_and_save_fact(session_id : str , content : str , user_id: str = None) -> bool:
    """
            Checks if content contains a trigger phrase. If so, saves it as a fact
             and returns True. Otherwise returns False.
    """
    lower = content.lower()

    for phrase in TRIGGER_PHRASES:
        if phrase in lower:
            save_fact(session_id , content , user_id)
            return True

    return False

def get_context(session_id: str , user_id : str = None) -> dict:
     """
     Returns both short-term and long-term memory for a session,
     used by the orchestrator to build context before calling the LLM.
     """
     return {
         "recent_history" : get_history(session_id),
         "remembered_facts": get_facts(session_id , user_id)
     }