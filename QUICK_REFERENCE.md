# Quick Reference: Multi-Provider LLM

## TL;DR - Get Started in 3 Minutes

### 1. Copy Configuration Template
```bash
cp .env.example .env
```

### 2. Edit .env with Your Provider

```bash
# Use OpenAI
LLM_PROVIDER=openai
LLM_MODEL=gpt-3.5-turbo
LLM_API_KEY=sk-...

# OR Anthropic
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-opus-20240229
LLM_API_KEY=sk-ant-...

# OR Google
LLM_PROVIDER=google
LLM_MODEL=gemini-pro
LLM_API_KEY=AIza...

# OR Local Ollama
LLM_PROVIDER=ollama
LLM_MODEL=mistral
```

### 3. Use in Code
```python
from llm_provider.llm_initializer import get_llm_model

model = get_llm_model()
response = model.invoke("Hello!")
```

That's it! ✅

---

## Environment Variables

| Variable | Required | Default | Example |
|----------|----------|---------|---------|
| `LLM_PROVIDER` | No | `openai` | `anthropic`, `google`, `ollama` |
| `LLM_MODEL` | No | `gpt-3.5-turbo` | `gpt-4`, `claude-3-opus-20240229` |
| `LLM_API_KEY` | Yes* | - | `sk-...`, `sk-ant-...`, `AIza...` |
| `LLM_BASE_URL` | No | Provider default | `https://openrouter.ai/api/v1` |
| `LLM_TEMPERATURE` | No | `0` | `0.0` - `1.0` |
| `LLM_MAX_TOKENS` | No | `4096` | `2048`, `8000` |

*Not required for Ollama (local)

---

## Code Examples

### Basic Usage
```python
from llm_provider.llm_initializer import get_llm_model

model = get_llm_model()
response = model.invoke("Your prompt")
```

### Override Model
```python
model = get_llm_model(model="gpt-4")
```

### Override Provider
```python
model = get_llm_model(provider="anthropic", model="claude-3-opus-20240229")
```

### Custom Settings
```python
model = get_llm_model(
    provider="openai",
    model="gpt-4",
    temperature=0.7,
    max_tokens=2000
)
```

### With LangChain Chains
```python
from llm_provider.llm_initializer import get_llm_model
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

model = get_llm_model()
prompt = ChatPromptTemplate.from_template("Tell me about {topic}")
chain = prompt | model | StrOutputParser()
response = chain.invoke({"topic": "Python"})
```

---

## Provider Comparison

### Quick Decision Tree

**Starting Development?**
→ Use **Ollama** (free, local, no API key needed)

**Need Best Quality?**
→ Use **OpenAI GPT-4** (most capable but expensive)

**Want Good Balance?**
→ Use **Anthropic Claude 3** (high quality, mid-price)

**Have Azure Enterprise?**
→ Use **Azure OpenAI** (enterprise support)

**Want Cheapest Cloud?**
→ Use **OpenRouter** (compare prices for all models)

---

## Provider Setup Checklists

### ✅ OpenAI
- [ ] Create account: https://platform.openai.com
- [ ] Get API key: https://platform.openai.com/api-keys
- [ ] Set `LLM_API_KEY` in `.env`
- [ ] Set `LLM_PROVIDER=openai`
- [ ] Choose model: `gpt-4`, `gpt-3.5-turbo`, etc.

### ✅ OpenRouter
- [ ] Create account: https://openrouter.ai
- [ ] Get API key: https://openrouter.ai/keys
- [ ] Set `LLM_API_KEY` in `.env`
- [ ] Set `LLM_PROVIDER=openai`
- [ ] Set `LLM_BASE_URL=https://openrouter.ai/api/v1`
- [ ] Choose model from OpenRouter catalog

### ✅ Anthropic
- [ ] Create account: https://console.anthropic.com
- [ ] Get API key: https://console.anthropic.com/account/keys
- [ ] Set `LLM_API_KEY` in `.env`
- [ ] Set `LLM_PROVIDER=anthropic`
- [ ] Choose model: `claude-3-opus-20240229`, etc.

### ✅ Google Gemini
- [ ] Create account: https://makersuite.google.com
- [ ] Get API key: https://makersuite.google.com/app/apikey
- [ ] Set `LLM_API_KEY` in `.env`
- [ ] Set `LLM_PROVIDER=google`
- [ ] Choose model: `gemini-pro`, `gemini-1.5-pro`

### ✅ Local Ollama
- [ ] Install: https://ollama.ai
- [ ] Run: `ollama serve`
- [ ] Pull model: `ollama pull mistral`
- [ ] Set `LLM_PROVIDER=ollama`
- [ ] Set `LLM_MODEL=mistral`
- [ ] No API key needed

### ✅ Azure OpenAI
- [ ] Create Azure account: https://azure.microsoft.com
- [ ] Deploy OpenAI service in Azure
- [ ] Get API key from Azure portal
- [ ] Get deployment name
- [ ] Set `LLM_API_KEY` in `.env`
- [ ] Set `LLM_PROVIDER=openai`
- [ ] Set `LLM_BASE_URL=https://{resource}.openai.azure.com/...`

---

## Common Tasks

### Change Provider
```bash
# Edit .env
LLM_PROVIDER=anthropic
# That's it! Code doesn't change.
```

### Compare Providers
```bash
python examples/test_providers.py --all
```

### Test Current Setup
```bash
python examples/test_providers.py
```

### List Available Providers
```python
from llm_provider.provider_factory import LLMProviderFactory
print(LLMProviderFactory.get_available_providers())
```

### Validate Configuration
```python
from llm_provider.llm_initializer import validate_provider_config

try:
    validate_provider_config("anthropic")
    print("✓ Valid")
except Exception as e:
    print(f"✗ Error: {e}")
```

---

## Model Recommendations

### By Use Case

**Chat Applications**
- Best: `gpt-4` or `claude-3-opus`
- Budget: `claude-3-haiku` or `gpt-3.5-turbo`

**Code Generation**
- Best: `gpt-4` or `claude-3-opus`
- Budget: `gpt-3.5-turbo`

**Summarization**
- Best: Any Claude 3 or GPT-4
- Budget: `gpt-3.5-turbo` or `claude-3-haiku`

**Translation**
- Best: `gpt-4` or `claude-3-opus`
- Budget: Any Claude or GPT-3.5

**Local Development**
- Free: `mistral` or `llama2` (via Ollama)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Module not found | `pip install -r requirements.txt` |
| API key error | Check `LLM_API_KEY` in `.env` |
| Provider not recognized | Use `LLMProviderFactory.get_available_providers()` |
| Model not found | Check model name for your provider |
| Connection timeout | Check API endpoint URL and network |
| 401 Unauthorized | Check API key is valid and not expired |
| 429 Rate limit | Upgrade plan or try different provider |

---

## Important Notes

⚠️ **Security**
- Never commit `.env` file
- Add `.env` to `.gitignore`
- Keep API keys confidential
- Rotate keys regularly

💰 **Cost Management**
- Set `LLM_MAX_TOKENS` to limit usage
- Use cheaper models in dev
- Monitor API usage in provider dashboard
- Set billing alerts

🚀 **Performance**
- Ollama is fastest (local, no network)
- GPT-4 is smartest (but slower)
- Haiku/Fast models are cheapest
- Temperature affects quality/randomness

---

## Documentation Links

- **Full Guide**: See `LLM_PROVIDER_GUIDE.md`
- **Migration**: See `MIGRATION_GUIDE.md`
- **Technical**: See `llm_provider/README.md`
- **Implementation**: See `IMPLEMENTATION_SUMMARY.md`

---

## Provider Pricing (Approx.)

| Provider | Input | Output | Notes |
|----------|-------|--------|-------|
| GPT-4 | $0.03 | $0.06 | Per 1K tokens |
| GPT-3.5 | $0.0005 | $0.0015 | Per 1K tokens |
| Claude 3 Opus | $0.015 | $0.075 | Per 1K tokens |
| Claude 3 Sonnet | $0.003 | $0.015 | Per 1K tokens |
| Claude 3 Haiku | $0.00025 | $0.00125 | Per 1K tokens |
| Gemini | $0.00025 | $0.0005 | Per 1K tokens |
| Ollama | Free | Free | Local only |

*Prices subject to change. Check provider sites for current rates.*

---

## One-Liner Setup

```bash
# Copy template and open in editor
cp .env.example .env && nano .env
```

```bash
# Test everything works
python examples/test_providers.py
```

```bash
# Done! Your app now works with any LLM provider! 🎉
```

---

## Getting Help

```python
# See all available providers
from llm_provider.provider_factory import LLMProviderFactory
providers = LLMProviderFactory.get_available_providers()
for name, desc in providers.items():
    print(f"{name}: {desc}")

# Validate your setup
from llm_provider.llm_initializer import validate_provider_config
validate_provider_config("your-provider")

# Test your setup
from llm_provider.llm_initializer import get_llm_model
model = get_llm_model()
print(model.invoke("Hello!"))
```

That's it! You're ready to go! 🚀
