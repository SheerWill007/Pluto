from langchain_community.tools import DuckDuckGoSearchRun , Tool

def web_searcher(query):
    try:
        duck = DuckDuckGoSearchRun()
        return duck.run(query)
    except Exception as e:
        return f"Error during extracting file from web {e}"

web_search = Tool(
    func= web_searcher,
    name= "web_search",
    description=  "Use this when the user asks about current events, recent news, or any topic not found in uploaded documents."
)
