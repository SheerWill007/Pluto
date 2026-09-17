from memory.redis_memory import save_message, get_history, clear_history

save_message("test_session_1", "user", "Hello, this is a test")
save_message("test_session_1", "assistant", "Hi! How can I help?")

print(get_history("test_session_1"))

clear_history("test_session_1")
print(get_history("test_session_1"))  # should be empty list
