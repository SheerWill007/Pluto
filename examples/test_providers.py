#!/usr/bin/env python
"""
Test script to demonstrate multi-provider LLM functionality.
Run this to verify your setup and compare different providers.

Usage:
    python examples/test_providers.py
    python examples/test_providers.py --provider openai
    python examples/test_providers.py --provider anthropic --model claude-3-opus-20240229
"""

import sys
import argparse
from typing import Optional
from pathlib import Path

# Add parent directory to path to import modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from llm_provider.llm_initializer import get_llm_model, validate_provider_config
from llm_provider.provider_factory import LLMProviderFactory
from config.settings import settings


def print_header(text: str):
    """Print a formatted header."""
    print(f"\n{'=' * 70}")
    print(f"  {text}")
    print(f"{'=' * 70}")


def print_section(text: str):
    """Print a formatted section header."""
    print(f"\n{text}")
    print("-" * len(text))


def test_current_config():
    """Test the current configuration from .env"""
    print_header("CURRENT CONFIGURATION")
    
    config = settings.get_llm_config()
    print(f"Provider:    {config.get('provider', 'Not set')}")
    print(f"Model:       {config.get('model', 'Not set')}")
    print(f"API Key:     {'*' * 20} (hidden)")
    print(f"Base URL:    {config.get('base_url', 'Default')}")
    print(f"Temperature: {config.get('temperature', 0)}")
    print(f"Max Tokens:  {config.get('max_tokens', 4096)}")


def test_provider(provider: str, model: Optional[str] = None) -> bool:
    """Test a specific provider."""
    try:
        print(f"\n→ Testing {provider}...", end=" ", flush=True)
        
        config = settings.get_llm_config()
        config_copy = config.copy()
        config_copy["provider"] = provider
        if model:
            config_copy["model"] = model
        
        llm_provider = LLMProviderFactory.from_config(config_copy)
        model_instance = llm_provider.get_model()
        
        # Send a test message
        response = model_instance.invoke("What's 2+2?")
        
        print("✓ SUCCESS")
        print(f"  Response: {response[:100]}..." if len(response) > 100 else f"  Response: {response}")
        return True
        
    except Exception as e:
        print(f"✗ FAILED")
        print(f"  Error: {str(e)}")
        return False


def test_all_providers():
    """Test all available providers."""
    print_header("TESTING ALL PROVIDERS")
    
    providers = LLMProviderFactory.get_available_providers()
    
    print(f"\nAvailable providers: {', '.join(providers.keys())}\n")
    
    results = {}
    for provider in providers.keys():
        try:
            validate_provider_config(provider)
            success = test_provider(provider)
            results[provider] = success
        except ValueError as e:
            print(f"\n→ {provider}: ⚠️ SKIPPED - {str(e)}")
            results[provider] = "skipped"
    
    # Summary
    print_section("\nSUMMARY")
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    skipped = sum(1 for v in results.values() if v == "skipped")
    
    for provider, result in results.items():
        if result is True:
            status = "✓ PASSED"
        elif result is False:
            status = "✗ FAILED"
        else:
            status = "⚠ SKIPPED"
        print(f"  {provider:12} {status}")
    
    print(f"\nTotal: {passed} passed, {failed} failed, {skipped} skipped")
    return failed == 0


def test_provider_switching():
    """Test switching between providers."""
    print_header("TESTING PROVIDER SWITCHING")
    
    test_cases = [
        {
            "name": "OpenAI",
            "provider": "openai",
            "model": "gpt-3.5-turbo",
        },
        {
            "name": "Anthropic",
            "provider": "anthropic",
            "model": "claude-3-haiku-20240307",
        },
        {
            "name": "Google",
            "provider": "google",
            "model": "gemini-pro",
        },
    ]
    
    print("\nTesting quick provider switching:\n")
    
    results = {}
    for test_case in test_cases:
        try:
            print(f"→ Switching to {test_case['name']}...", end=" ", flush=True)
            model = get_llm_model(
                provider=test_case["provider"],
                model=test_case["model"]
            )
            print("✓ SUCCESS")
            results[test_case["name"]] = True
        except Exception as e:
            print(f"✗ FAILED - {str(e)}")
            results[test_case["name"]] = False
    
    # Summary
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    print(f"\n{passed}/{total} providers successfully loaded")


def show_usage_examples():
    """Show usage examples."""
    print_header("USAGE EXAMPLES")
    
    examples = [
        ("Use default provider", "get_llm_model()"),
        ("Override model", "get_llm_model(model='gpt-4')"),
        ("Switch provider", "get_llm_model(provider='anthropic', model='claude-3-opus-20240229')"),
        ("Custom parameters", "get_llm_model(temperature=0.7, max_tokens=1000)"),
        ("In a chain", "model = get_llm_model()\nresponse = model.invoke('Hello!')"),
    ]
    
    for description, code in examples:
        print(f"\n{description}:")
        print(f"  {code}")


def main():
    """Main test runner."""
    parser = argparse.ArgumentParser(
        description="Test multi-provider LLM functionality"
    )
    parser.add_argument(
        "--provider",
        type=str,
        help="Test specific provider"
    )
    parser.add_argument(
        "--model",
        type=str,
        help="Model to use"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Test all providers"
    )
    parser.add_argument(
        "--examples",
        action="store_true",
        help="Show usage examples"
    )
    
    args = parser.parse_args()
    
    # Show configuration
    test_current_config()
    
    # Run tests based on arguments
    if args.examples:
        show_usage_examples()
    elif args.provider:
        print_header(f"TESTING {args.provider.upper()}")
        test_provider(args.provider, args.model)
    elif args.all:
        success = test_all_providers()
        sys.exit(0 if success else 1)
    else:
        # Default: test current config and show examples
        print_header("TESTING CURRENT CONFIGURATION")
        try:
            model = get_llm_model()
            response = model.invoke("What's 2+2?")
            print(f"✓ Current configuration works!")
            print(f"Response: {response[:200]}...")
        except Exception as e:
            print(f"✗ Error: {e}")
        
        show_usage_examples()


if __name__ == "__main__":
    main()
