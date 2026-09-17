"""
Gmail Agent with dynamic LLM support
"""

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from tools.gmail_tools import fetch_recent_emails
from llm_provider.llm_initializer import get_llm_model
from typing import List, Dict, Any, Optional


def run_gmail_agent(
    user_id: int,
    max_email: int = 10,
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    emails: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None,
) -> str:
    """
    Summarize emails using the selected LLM provider and model.
    If emails list is not provided, it fetches recent emails from the inbox.
    """
    try:
        if emails is None:
            fetched = fetch_recent_emails(user_id, max_results=max_email)
            if isinstance(fetched, str):
                return fetched
            emails = fetched

        if not emails:
            return "No emails found to summarize."

        # Format email data for the prompt
        formatted = "\n\n".join(
            f"Email {i + 1}:\nFrom: {email.get('sender')}\nDate: {email.get('date')}\nSubject: {email.get('subject')}\nPreview: {email.get('snippet')}"
            for i, email in enumerate(emails)
        )

        # Retrieve the dynamic model based on provider and model_name
        llm = get_llm_model(
            provider=provider,
            model=model_name,
            api_key=api_key,
            temperature=0.0,  # lower temp for summary accuracy
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are a helpful assistant specialized in managing and summarizing emails. "
             "Read the provided emails and create a clear, structured summary digest. "
             "For each email, output:\n"
             "1. Sender, Date, and Subject\n"
             "2. A concise 2-3 sentence summary of the contents\n"
             "3. A status indicating if action is required (Yes/No and action item detail if Yes)\n"
             "4. A spam classification: \"Spam\" or \"Not Spam\", with a brief one-sentence reason (e.g. suspicious sender, urgent financial request, generic mass-marketing language, etc. vs. legitimate sender and normal content)\n\n"
             "Do not add any preamble or conversational fillers. Output the list directly."
             ),
            ("human", "Summarize these emails:\n\n{query}")
        ])

        chain = prompt | llm | StrOutputParser()
        response = chain.invoke({"query": formatted})
        return response

    except Exception as e:
        return f"Error occurred while running Gmail Agent: {e}"
