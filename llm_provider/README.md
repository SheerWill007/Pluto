# LLM Provider Module

A flexible, provider-agnostic LLM abstraction layer that allows seamless switching between different LLM providers without code changes.

## Architecture

### Core Components

1. **BaseLLMProvider** (`base_provider.py`)
   - Abstract base class defining the LLM provider interface
   - Implements common functionality like invoke, batch_invoke
   - Requires subclasses to implement `get_model()` and `validate_config()`

2. **Provider Implementations**
   - `OpenAIProvider` - OpenAI, Azure OpenAI, OpenRouter
   - `AnthropicProvider` - Anthropic Claude models
   - `GoogleProvider` - Google Gemini models
   - `OllamaProvider` - Local Ollama models

3. **LLMProviderFactory** (`provider_factory.py`)
   - Factory pattern for creating provider instances
   - Manages provider registration and aliases
   - Singleton pattern for global state management
   - Supports custom provider registration

4. **LLM Initializer** (`llm_initializer.py`)
   - Convenience functions for common tasks
   - Integration with settings configuration
   - Provider validation and testing utilities

## Class Hierarchy

```
BaseLLMProvider (abstract)
├── OpenAIProvider
├── AnthropicProvider
├── GoogleProvider
└── OllamaProvider
```

## File Structure

```
llm_provider/
├── __init__.py                 # Package exports
├── base_provider.py            # Abstract base class
├── openai_provider.py          # OpenAI implementation
├── anthropic_provider.py       # Anthropic implementation
├── google_provider.py          # Google implementation
├── ollama_provider.py          # Ollama implementation
├── provider_factory.py         # Factory and management
├── llm_initializer.py          # Convenience functions
└── README.md                   # This file
```

## Usage Patterns

### Pattern 1: Simple Usage (Recommended)

```python
from llm_provider.llm_initializer import get_llm_model

# Uses default provider from settings
model = get_llm_model()
response = model.invoke("Hello!")
```

### Pattern 2: Override Provider

```python
from llm_provider.llm_initializer import get_llm_model

# Use specific provider for this call
model = get_llm_model(provider="anthropic", model="claude-3-opus-20240229")
response = model.invoke("Hello!")
```

### Pattern 3: Set Global Provider

```python
from llm_provider.llm_initializer import create_llm_provider

# Initialize once
create_llm_provider(provider="anthropic", model="claude-3-opus-20240229")

# All subsequent calls use this provider
model = get_llm_model()
```

### Pattern 4: Direct Provider Usage

```python
from llm_provider.provider_factory import LLMProviderFactory

# Create provider directly
provider = LLMProviderFactory.create(
    "openai",
    api_key="sk-...",
    model="gpt-4",
    base_url="https://openrouter.ai/api/v1"
)

# Get model instance
model = provider.get_model()
response = model.invoke("Hello!")
```

### Pattern 5: Custom Provider

```python
from llm_provider.base_provider import BaseLLMProvider
from llm_provider.provider_factory import LLMProviderFactory
from langchain_core.language_models.llm import LLM

class MyCustomProvider(BaseLLMProvider):
    def validate_config(self):
        if not self.config.get("api_key"):
            raise ValueError("Missing api_key")
        return True
    
    def get_model(self) -> LLM:
        # Return your LLM instance
        pass

# Register custom provider
LLMProviderFactory.register_provider("custom", MyCustomProvider)

# Use it
from llm_provider.llm_initializer import get_llm_model
model = get_llm_model(provider="custom")
```

## Adding a New Provider

### Step 1: Create Provider Class

```python
# llm_provider/new_provider.py
from .base_provider import BaseLLMProvider
from langchain_new_api import ChatNewAPI

class NewProvider(BaseLLMProvider):
    REQUIRED_FIELDS = ["api_key", "model"]
    
    def __init__(self, api_key, model, **kwargs):
        config = {
            "api_key": api_key,
            "model": model,
            **kwargs
        }
        super().__init__(**config)
        self.validate_config()
    
    def validate_config(self):
        for field in self.REQUIRED_FIELDS:
            if not self.config.get(field):
                raise ValueError(f"Missing: {field}")
        return True
    
    def get_model(self):
        if self._model is None:
            self._model = ChatNewAPI(
                api_key=self.config["api_key"],
                model=self.config["model"]
            )
        return self._model
```

### Step 2: Register Provider

```python
# llm_provider/__init__.py
from .new_provider import NewProvider

# Update __all__
__all__ = [
    ...,
    "NewProvider",
]
```

### Step 3: Update Factory

```python
# llm_provider/provider_factory.py
from .new_provider import NewProvider

class LLMProviderFactory:
    PROVIDERS = {
        ...,
        "new": NewProvider,
    }
    
    ALIASES = {
        ...,
        "custom": "new",
    }
```

### Step 4: Add to Requirements

```bash
pip install langchain-new-api
```

## Testing

### Run Test Script

```bash
# Test current configuration
python examples/test_providers.py

# Test specific provider
python examples/test_providers.py --provider anthropic

# Test all providers
python examples/test_providers.py --all

# Show examples
python examples/test_providers.py --examples
```

### Manual Testing

```python
from llm_provider.llm_initializer import get_llm_model
from llm_provider.provider_factory import LLMProviderFactory

# Test available providers
providers = LLMProviderFactory.get_available_providers()
for name, desc in providers.items():
    print(f"{name}: {desc}")

# Test provider switching
for provider in ["openai", "anthropic", "google", "ollama"]:
    try:
        model = get_llm_model(provider=provider)
        print(f"✓ {provider} works")
    except Exception as e:
        print(f"✗ {provider}: {e}")
```

## Configuration Precedence

1. Explicit parameters to `get_llm_model()` - highest priority
2. Environment variables (`LLM_*`)
3. Backward compatible variables (`OPENAI_*`)
4. Defaults in settings - lowest priority

Example:
```python
# Uses environment variable
model = get_llm_model()

# Override with explicit parameter
model = get_llm_model(model="gpt-4")

# Override multiple parameters
model = get_llm_model(provider="anthropic", model="claude-3-opus-20240229")
```

## Provider Aliases

For convenience, the factory supports aliases:

| Alias | Maps To |
|-------|---------|
| `openrouter` | `openai` |
| `azure` | `openai` |
| `claude` | `anthropic` |
| `gemini` | `google` |
| `llama` | `ollama` |
| `mistral` | `ollama` |

```python
# These are equivalent
get_llm_model(provider="openai")
get_llm_model(provider="openrouter")  # Alias

get_llm_model(provider="anthropic")
get_llm_model(provider="claude")  # Alias
```

## Error Handling

### Configuration Errors

```python
try:
    model = get_llm_model(provider="anthropic")
except ValueError as e:
    print(f"Config error: {e}")
    # Handle missing API key or invalid configuration
```

### Runtime Errors

```python
try:
    model = get_llm_model()
    response = model.invoke("Hello!")
except Exception as e:
    print(f"Runtime error: {e}")
    # Handle API errors, network issues, etc.
```

## Performance Considerations

### Model Caching

Models are cached within provider instances:
```python
# Same model instance returned
model1 = get_llm_model()
model2 = get_llm_model()
# model1 and model2 reference the same underlying LLM instance
```

### Singleton Factory

The factory is a singleton for global state management:
```python
from llm_provider.provider_factory import LLMProviderFactory

factory1 = LLMProviderFactory()
factory2 = LLMProviderFactory()
# factory1 and factory2 are the same instance
```

## Security Considerations

### API Keys

- Never hardcode API keys in code
- Use environment variables or secrets management
- See LLM_PROVIDER_GUIDE.md for secure key management practices

### Configuration Files

- Add `.env` to `.gitignore`
- Never commit files with API keys
- Use `.env.example` as a template

## Troubleshooting

### Issue: Provider not found

```python
from llm_provider.provider_factory import LLMProviderFactory
providers = LLMProviderFactory.get_available_providers()
print("Available:", providers)
```

### Issue: Missing API key

```python
from llm_provider.llm_initializer import validate_provider_config
try:
    validate_provider_config("openai")
except ValueError as e:
    print(f"Validation error: {e}")
```

### Issue: Model initialization fails

Check:
1. Provider type is correct
2. Model name is valid for that provider
3. API key is valid and has sufficient credits
4. Network connectivity to API endpoint

## Dependencies

### Required

- `langchain>=0.3.1`
- `langchain-core` (included with langchain)
- `pydantic>=2.0`

### Provider-Specific

- OpenAI: `langchain-openai>=0.2.1`
- Anthropic: `langchain-anthropic>=0.1.15`
- Google: `langchain-google-genai>=0.1.13`
- Ollama: `langchain-ollama` (via langchain-community)

## Contributing

To add support for new providers:

1. Create new provider class in `llm_provider/new_provider.py`
2. Inherit from `BaseLLMProvider`
3. Implement `validate_config()` and `get_model()`
4. Register in `provider_factory.py`
5. Update `__init__.py`
6. Add tests

See "Adding a New Provider" section above for details.

## License

See project LICENSE file
