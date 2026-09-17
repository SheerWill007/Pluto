# Multi-Provider LLM Guide

This project now supports multiple LLM providers, allowing you to easily switch between different APIs without code changes.

## Supported Providers

- **OpenAI** - GPT-4, GPT-3.5-turbo, and other OpenAI models
- **OpenRouter** - Access to multiple models through OpenRouter's API
- **Anthropic** - Claude models (Claude 3 Opus, Sonnet, Haiku)
- **Google** - Google Gemini models
- **Ollama** - Local models (Llama 2, Mistral, Neural Chat, etc.)
- **Azure OpenAI** - OpenAI models hosted on Azure

## Configuration

### Environment Variables

Set these in your `.env` file:

```bash
# LLM Provider selection (default: openai)
LLM_PROVIDER=openai

# Generic LLM Configuration
LLM_MODEL=gpt-3.5-turbo
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://api.openai.com/v1  # Optional, for custom endpoints
LLM_TEMPERATURE=0
LLM_MAX_TOKENS=4096

# Legacy settings (still supported for backward compatibility)
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-3.5-turbo
BASE_URL=https://api.openai.com/v1
MAX_TOKEN=4096
```

## Quick Start - Using Different Providers

### 1. OpenAI (Default)

```bash
LLM_PROVIDER=openai
LLM_MODEL=gpt-4
LLM_API_KEY=sk-your-openai-key
```

### 2. OpenRouter

```bash
LLM_PROVIDER=openai  # OpenRouter uses OpenAI-compatible API
LLM_MODEL=openai/gpt-4  # Or any other OpenRouter model
LLM_API_KEY=your-openrouter-key
LLM_BASE_URL=https://openrouter.ai/api/v1
```

### 3. Anthropic (Claude)

```bash
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-opus-20240229  # or claude-3-sonnet-20240229, claude-3-haiku-20240307
LLM_API_KEY=your-anthropic-api-key
```

### 4. Google Gemini

```bash
LLM_PROVIDER=google
LLM_MODEL=gemini-pro  # or gemini-1.5-pro
LLM_API_KEY=your-google-api-key
```

### 5. Azure OpenAI

```bash
LLM_PROVIDER=azure  # Alias for openai
LLM_MODEL=gpt-4  # Your deployment name
LLM_API_KEY=your-azure-openai-key
LLM_BASE_URL=https://<your-resource>.openai.azure.com/openai/deployments/<deployment>/
```

### 6. Local Ollama

```bash
LLM_PROVIDER=ollama
LLM_MODEL=llama2  # or mistral, neural-chat, etc.
# No API key needed for local Ollama
# Base URL defaults to http://localhost:11434
```

Make sure Ollama is running:
```bash
ollama serve
```

## Using in Your Code

### Option 1: Use Settings Default (Recommended)

All agents automatically use the configured provider:

```python
from llm_provider.llm_initializer import get_llm_model

# Uses provider configured in LLM_PROVIDER env var
model = get_llm_model()
response = model.invoke("Hello!")
```

### Option 2: Override Provider Per Call

```python
from llm_provider.llm_initializer import get_llm_model

# Use a different provider for this specific call
model = get_llm_model(provider="anthropic", model="claude-3-opus-20240229")
response = model.invoke("Hello!")
```

### Option 3: Override Model Only

```python
from llm_provider.llm_initializer import get_llm_model

# Use a different model from the same provider
model = get_llm_model(model="gpt-4")  # If using OpenAI
response = model.invoke("Hello!")
```

### Option 4: Custom Parameters

```python
from llm_provider.llm_initializer import get_llm_model

model = get_llm_model(
    provider="anthropic",
    model="claude-3-opus-20240229",
    temperature=0.7,
    max_tokens=2000
)
response = model.invoke("Hello!")
```

## Advanced Usage

### List Available Providers

```python
from llm_provider.provider_factory import LLMProviderFactory

providers = LLMProviderFactory.get_available_providers()
for name, description in providers.items():
    print(f"{name}: {description}")
```

### Set Current Provider Globally

```python
from llm_provider.llm_initializer import create_llm_provider

# Set provider for all subsequent calls
model = create_llm_provider(provider="anthropic", model="claude-3-opus-20240229")
```

### Validate Configuration

```python
from llm_provider.llm_initializer import validate_provider_config

try:
    validate_provider_config("anthropic")
    print("Anthropic is properly configured!")
except ValueError as e:
    print(f"Configuration error: {e}")
```

### Create Custom Provider

```python
from llm_provider.base_provider import BaseLLMProvider
from llm_provider.provider_factory import LLMProviderFactory

class MyCustomProvider(BaseLLMProvider):
    def validate_config(self):
        # Validate your config
        return True
    
    def get_model(self):
        # Return your LLM instance
        pass

# Register the custom provider
LLMProviderFactory.register_provider("custom", MyCustomProvider, alias="my_provider")

# Use it
model = get_llm_model(provider="custom")
```

## Migration from Old Code

### Before (Hardcoded to OpenAI)

```python
from langchain_openai import ChatOpenAI
from config.settings import settings

model = ChatOpenAI(
    api_key=settings.OPENAI_API_KEY,
    base_url=settings.BASE_URL,
    model=settings.OPENAI_MODEL,
    max_tokens=2048
)
```

### After (Works with Any Provider)

```python
from llm_provider.llm_initializer import get_llm_model

model = get_llm_model(max_tokens=2048)
```

## Testing Different Providers

Create a test script to compare providers:

```python
from llm_provider.llm_initializer import get_llm_model

providers = [
    {"provider": "openai", "model": "gpt-3.5-turbo"},
    {"provider": "anthropic", "model": "claude-3-haiku-20240307"},
    {"provider": "google", "model": "gemini-pro"},
]

question = "What is the capital of France?"

for provider_config in providers:
    try:
        model = get_llm_model(**provider_config)
        response = model.invoke(question)
        print(f"\n{provider_config['provider']} ({provider_config['model']}):")
        print(response)
    except Exception as e:
        print(f"\n{provider_config['provider']}: Error - {e}")
```

## Cost Optimization

### Using Cheaper Models

```bash
# Option 1: Use cheaper OpenAI model
LLM_MODEL=gpt-3.5-turbo

# Option 2: Use Anthropic Haiku (cheaper than other Claude models)
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-haiku-20240307

# Option 3: Use OpenRouter to compare prices
LLM_PROVIDER=openai
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openai/gpt-3.5-turbo  # Or search for cheapest model on OpenRouter
```

## Troubleshooting

### "Missing required field: api_key"

**Solution**: Set `LLM_API_KEY` in your `.env` file for the provider you're using.

### "No LLM provider set"

**Solution**: Call `create_llm_provider()` first or ensure `LLM_PROVIDER` is set in `.env`.

### Provider not recognized

**Solution**: Check the provider name is spelled correctly. Use `LLMProviderFactory.get_available_providers()` to see all available options.

### Model not found / Invalid model name

**Solution**: Check that the model name is correct for your chosen provider:
- OpenAI: gpt-4, gpt-3.5-turbo, gpt-4-turbo, etc.
- Anthropic: claude-3-opus-20240229, claude-3-sonnet-20240229, etc.
- Google: gemini-pro, gemini-1.5-pro, etc.
- Ollama: Run `ollama list` to see available local models

### Slow responses

**Solution**: Try a faster/cheaper model:
```bash
# Faster OpenAI models
LLM_MODEL=gpt-3.5-turbo

# Faster Anthropic model
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-haiku-20240307
```

## API Key Management

**⚠️ Security Warning**: Never commit API keys to version control!

1. **Store in .env file** (add `.env` to `.gitignore`)
   ```bash
   LLM_API_KEY=sk-your-secret-key
   ```

2. **Use environment variables** (recommended for production)
   ```bash
   export LLM_API_KEY=sk-your-secret-key
   ```

3. **Use secrets management** (recommended for production)
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault
   - Doppler

## Additional Resources

- [OpenAI API Docs](https://platform.openai.com/docs)
- [OpenRouter Docs](https://openrouter.ai/docs)
- [Anthropic Docs](https://docs.anthropic.com)
- [Google Gemini Docs](https://ai.google.dev)
- [Ollama GitHub](https://github.com/ollama/ollama)
- [LangChain Documentation](https://python.langchain.com/)
