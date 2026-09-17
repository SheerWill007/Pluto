# Migration Guide: Multi-Provider LLM Support

This guide helps you update your project to use the new flexible multi-provider LLM system.

## What Changed?

Previously, the entire project was tightly coupled to OpenAI/OpenRouter. Now it supports:
- OpenAI
- Anthropic (Claude)
- Google Gemini
- Local Ollama models
- Azure OpenAI
- Any custom provider you create

## Step 1: Update Dependencies

### Install New Dependencies

```bash
pip install -r requirements.txt
```

The `requirements.txt` now includes:
- `langchain-anthropic` - For Anthropic Claude
- `langchain-google-genai` - For Google Gemini
- Plus existing dependencies for OpenAI and Ollama

## Step 2: Update Configuration

### Option A: Keep Using OpenAI (No Breaking Changes)

Your current `.env` will still work! We support backward compatibility:

```bash
# Old settings still work
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-3.5-turbo
BASE_URL=https://openrouter.ai/api/v1
```

### Option B: Use New Configuration (Recommended)

Replace your `.env` with the new format:

```bash
# Copy example file
cp .env.example .env

# Edit .env with your settings
LLM_PROVIDER=openai
LLM_MODEL=gpt-3.5-turbo
LLM_API_KEY=sk-your-key
LLM_BASE_URL=https://openrouter.ai/api/v1  # Optional
```

## Step 3: Update Your Code

### Agents (Already Done)

The following agent files have been automatically updated:
- `agents/orchestrator.py`
- `agents/research_agent.py`
- `agents/code_critic.py`
- `agents/code_generator.py`
- `agents/rag_agent.py`

If you have custom agents, apply the same pattern.

### Custom Agent Example

**Before (OpenAI-only):**
```python
from langchain_openai import ChatOpenAI
from config.settings import settings

def my_agent(query):
    model = ChatOpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.BASE_URL,
        model=settings.OPENAI_MODEL,
        max_tokens=2048
    )
    return model.invoke(query)
```

**After (Multi-provider):**
```python
from llm_provider.llm_initializer import get_llm_model

def my_agent(query):
    model = get_llm_model(max_tokens=2048)
    return model.invoke(query)
```

That's it! Your agent now works with any provider configured in `.env`.

### Custom Initialization

If you need specific provider logic in your code:

**Option 1: Override provider for specific calls**
```python
from llm_provider.llm_initializer import get_llm_model

# Use Anthropic for this specific task
model = get_llm_model(provider="anthropic", model="claude-3-opus-20240229")
result = model.invoke(query)
```

**Option 2: Set global provider**
```python
from llm_provider.llm_initializer import create_llm_provider

# Initialize once at startup
create_llm_provider(provider="anthropic", model="claude-3-opus-20240229")

# Then all calls use this provider
model = get_llm_model()
```

## Step 4: Test Your Setup

### Quick Test

```python
from llm_provider.llm_initializer import get_llm_model

# Test with current configuration
model = get_llm_model()
response = model.invoke("Hello! What's 2+2?")
print(response)
```

### Test Different Providers

```python
from llm_provider.llm_initializer import get_llm_model
from llm_provider.provider_factory import LLMProviderFactory

# See available providers
providers = LLMProviderFactory.get_available_providers()
print("Available providers:", providers)

# Test switching between providers
for provider in ["openai", "anthropic", "google"]:
    try:
        model = get_llm_model(provider=provider)
        print(f"✓ {provider} configured correctly")
    except Exception as e:
        print(f"✗ {provider}: {e}")
```

## Step 5: Deploy to Production

### Environment Variables

Set these environment variables in your production environment:

```bash
LLM_PROVIDER=openai
LLM_MODEL=gpt-4
LLM_API_KEY=your-production-key
```

### Docker

If using Docker, update your `Dockerfile`:

```dockerfile
# Already configured in requirements.txt
RUN pip install -r requirements.txt
```

### Kubernetes/Cloud

Set environment variables in your deployment config:

```yaml
env:
  - name: LLM_PROVIDER
    value: openai
  - name: LLM_MODEL
    value: gpt-4
  - name: LLM_API_KEY
    valueFrom:
      secretKeyRef:
        name: llm-secrets
        key: api-key
```

## Common Scenarios

### Scenario 1: Switch from OpenAI to Anthropic

**Before:**
```bash
OPENAI_API_KEY=sk-openai-key
OPENAI_MODEL=gpt-4
```

**After:**
```bash
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-opus-20240229
LLM_API_KEY=sk-ant-anthropic-key
```

No code changes needed! Just update `.env` and restart.

### Scenario 2: Use Local Ollama for Development

```bash
# .env
LLM_PROVIDER=ollama
LLM_MODEL=mistral
LLM_BASE_URL=http://localhost:11434
```

Start Ollama:
```bash
ollama serve
ollama pull mistral
```

### Scenario 3: Use OpenRouter to Compare Models

```bash
# .env
LLM_PROVIDER=openai
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openai/gpt-4
LLM_API_KEY=your-openrouter-key
```

### Scenario 4: Cost Optimization - Use Cheaper Model

```bash
# Development: Use cheap model
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-haiku-20240307  # Cheapest Claude

# Production: Use better model
# LLM_MODEL=claude-3-opus-20240229  # Best quality
```

## Troubleshooting

### Issue: "No module named 'llm_provider'"

**Solution**: Make sure you're in the project root directory and have installed dependencies:
```bash
pip install -r requirements.txt
```

### Issue: "Missing required field: api_key"

**Solution**: Set `LLM_API_KEY` in your `.env`:
```bash
LLM_API_KEY=your-api-key-here
```

### Issue: Works locally but fails in production

**Possible causes:**
1. Environment variables not set in production
2. API key is expired or invalid
3. Network/firewall blocking API calls

**Solution:**
```bash
# Test API connectivity
python -c "from llm_provider.llm_initializer import get_llm_model; print(get_llm_model().invoke('test'))"
```

### Issue: Model not found error

**Solution**: Check the model name is correct for your provider:
```python
from llm_provider.provider_factory import LLMProviderFactory

# List available providers
providers = LLMProviderFactory.get_available_providers()
for name, desc in providers.items():
    print(f"{name}: {desc}")
```

## Breaking Changes

### Only If You Were Directly Importing ChatOpenAI

If your custom code imported `ChatOpenAI` directly:

**Before:**
```python
from langchain_openai import ChatOpenAI
from config.settings import settings

model = ChatOpenAI(api_key=settings.OPENAI_API_KEY, ...)
```

**After:**
```python
from llm_provider.llm_initializer import get_llm_model

model = get_llm_model()
```

### Backward Compatible

These still work (but use the new system under the hood):
- `settings.OPENAI_API_KEY` - Still supported
- `settings.OPENAI_MODEL` - Still supported
- `settings.BASE_URL` - Still supported

## Verification Checklist

Before going to production:

- [ ] Dependencies installed: `pip install -r requirements.txt`
- [ ] `.env` file configured with your LLM provider
- [ ] Tested with `python -c "from llm_provider.llm_initializer import get_llm_model; print(get_llm_model().invoke('test'))"`
- [ ] All agents updated (or using default `get_llm_model()`)
- [ ] API key is valid and has sufficient credits
- [ ] Network/firewall allows outgoing connections to API endpoint
- [ ] Docker/K8s environment variables set correctly (if applicable)

## Need Help?

### Resources

1. **LLM_PROVIDER_GUIDE.md** - Comprehensive provider usage guide
2. **LangChain Docs** - https://python.langchain.com/
3. **Provider-specific docs:**
   - OpenAI: https://platform.openai.com/docs
   - Anthropic: https://docs.anthropic.com
   - Google: https://ai.google.dev
   - Ollama: https://github.com/ollama/ollama

### Common Issues

See LLM_PROVIDER_GUIDE.md "Troubleshooting" section for detailed help.

## Next Steps

1. ✅ Update configuration
2. ✅ Update code (if needed)
3. ✅ Test locally
4. ✅ Deploy to production
5. Monitor and optimize costs by switching providers as needed
