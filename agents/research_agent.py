from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from tools.web_search import web_search
from llm_provider.llm_initializer import get_llm_model

def run_research_agent(query):
    try:
        model = get_llm_model(temperature=0, max_tokens=2048)

        web_search_findings = web_search.run(query)
        prompt = ChatPromptTemplate.from_template("""
            You are a research assistant. Using the web search results below, provide a clear and concise summary.
            Only use information present in the search results.
            If sources or URLs are present in the results, mention them.
            If no sources are visible, do not make them up.
            Question : {question}
            WEB_finding: {web_search}  
        """)
        chain = prompt|model|StrOutputParser()
        return chain.invoke({"web_search":web_search_findings , "question":query})
    except Exception as e:
        return f"Error occurred while running search agent {e}"