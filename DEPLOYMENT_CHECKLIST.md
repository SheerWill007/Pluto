# Deployment Checklist: Multi-Provider LLM System

Use this checklist to verify your setup before deploying to production.

## Pre-Deployment Setup

### 1. Installation & Dependencies

- [ ] Run `pip install -r requirements.txt` successfully
- [ ] No errors during installation
- [ ] All provider dependencies installed:
  - [ ] `langchain-openai` (for OpenAI, OpenRouter, Azure)
  - [ ] `langchain-anthropic` (for Anthropic)
  - [ ] `langchain-google-genai` (for Google)
  - [ ] `langchain-community` (includes Ollama support)

### 2. Configuration

- [ ] Created `.env` file from `.env.example`
- [ ] `.env` added to `.gitignore`
- [ ] Never committed `.env` to git
- [ ] API keys are valid and not expired
- [ ] Selected provider is supported
- [ ] Model name is correct for selected provider

### 3. Provider Selection

Choose ONE provider for deployment. Complete the checklist for your chosen provider:

#### ☑️ OpenAI
- [ ] OpenAI account created
- [ ] API key obtained from https://platform.openai.com/api-keys
- [ ] Set `LLM_PROVIDER=openai` in `.env`
- [ ] Set valid `LLM_API_KEY`
- [ ] Set valid `LLM_MODEL` (e.g., `gpt-4`, `gpt-3.5-turbo`)
- [ ] Billing enabled and has credit
- [ ] No rate limit issues
- [ ] `.env` has correct settings:
  ```
  LLM_PROVIDER=openai
  LLM_MODEL=gpt-3.5-turbo  # or gpt-4
  LLM_API_KEY=sk-...
  ```

#### ☑️ OpenRouter
- [ ] OpenRouter account created
- [ ] API key obtained from https://openrouter.ai/keys
- [ ] Set `LLM_PROVIDER=openai` in `.env`
- [ ] Set `LLM_BASE_URL=https://openrouter.ai/api/v1`
- [ ] Set valid `LLM_API_KEY`
- [ ] Set valid `LLM_MODEL` (from OpenRouter catalog)
- [ ] Billing enabled
- [ ] `.env` has correct settings:
  ```
  LLM_PROVIDER=openai
  LLM_BASE_URL=https://openrouter.ai/api/v1
  LLM_MODEL=openai/gpt-4  # or any OpenRouter model
  LLM_API_KEY=sk-or-...
  ```

#### ☑️ Anthropic (Claude)
- [ ] Anthropic account created
- [ ] API key obtained from https://console.anthropic.com/account/keys
- [ ] Set `LLM_PROVIDER=anthropic` in `.env`
- [ ] Set valid `LLM_API_KEY`
- [ ] Set valid `LLM_MODEL` (e.g., `claude-3-opus-20240229`)
- [ ] Billing enabled and has credit
- [ ] `.env` has correct settings:
  ```
  LLM_PROVIDER=anthropic
  LLM_MODEL=claude-3-opus-20240229
  LLM_API_KEY=sk-ant-...
  ```

#### ☑️ Google Gemini
- [ ] Google account created
- [ ] API key obtained from https://makersuite.google.com/app/apikey
- [ ] Set `LLM_PROVIDER=google` in `.env`
- [ ] Set valid `LLM_API_KEY`
- [ ] Set valid `LLM_MODEL` (e.g., `gemini-pro`)
- [ ] Billing enabled (if required)
- [ ] `.env` has correct settings:
  ```
  LLM_PROVIDER=google
  LLM_MODEL=gemini-pro
  LLM_API_KEY=AIza...
  ```

#### ☑️ Azure OpenAI
- [ ] Azure account created
- [ ] OpenAI resource deployed in Azure
- [ ] API key obtained from Azure portal
- [ ] Deployment name obtained
- [ ] Set `LLM_PROVIDER=openai` in `.env`
- [ ] Set `LLM_BASE_URL` to Azure endpoint
- [ ] Set valid `LLM_API_KEY`
- [ ] Set `LLM_MODEL` to deployment name
- [ ] `.env` has correct settings:
  ```
  LLM_PROVIDER=openai
  LLM_BASE_URL=https://{resource}.openai.azure.com/openai/deployments/{deployment}/
  LLM_MODEL=gpt-4
  LLM_API_KEY=your-azure-key
  ```

#### ☑️ Local Ollama
- [ ] Ollama installed from https://ollama.ai
- [ ] Ollama service running (`ollama serve`)
- [ ] Model pulled (`ollama pull mistral` or similar)
- [ ] Set `LLM_PROVIDER=ollama` in `.env`
- [ ] Set valid `LLM_MODEL` (e.g., `mistral`)
- [ ] Optional: Set `LLM_BASE_URL=http://localhost:11434`
- [ ] `.env` has correct settings:
  ```
  LLM_PROVIDER=ollama
  LLM_MODEL=mistral
  LLM_BASE_URL=http://localhost:11434  # Optional
  ```

### 4. Testing Locally

Run verification tests:

```bash
# Test current configuration
python examples/test_providers.py

# Test specific provider
python examples/test_providers.py --provider openai

# Test all providers (if multiple configured)
python examples/test_providers.py --all

# Test in Python
python -c "from llm_provider.llm_initializer import get_llm_model; print(get_llm_model().invoke('Hello'))"
```

- [ ] No errors from test script
- [ ] Response received from LLM
- [ ] Response is coherent and in English
- [ ] Response time is acceptable (< 30 seconds)

### 5. Application Testing

- [ ] Application starts without errors
- [ ] API endpoints respond
- [ ] Chat endpoint works: `POST /chat`
- [ ] Upload endpoint works: `POST /upload`
- [ ] RAG endpoint works: `POST /rag/query`
- [ ] Health endpoint works: `GET /health`
- [ ] All agents initialize correctly
- [ ] No import errors for `llm_provider`

### 6. Security Review

- [ ] `.env` file is NOT in git history
- [ ] `.env` added to `.gitignore`
- [ ] API keys never logged or printed
- [ ] Secrets not hardcoded anywhere
- [ ] No sensitive data in code comments
- [ ] HTTPS enabled for production
- [ ] API rate limiting configured
- [ ] Input validation enabled
- [ ] Error messages don't leak secrets

### 7. Configuration Validation

- [ ] `LLM_PROVIDER` is set and valid
- [ ] `LLM_MODEL` is set and correct for provider
- [ ] `LLM_API_KEY` is set and valid
- [ ] `LLM_BASE_URL` is correct (if needed)
- [ ] `LLM_TEMPERATURE` is reasonable (0-1)
- [ ] `LLM_MAX_TOKENS` is reasonable (256-8000)
- [ ] No typos in environment variable names
- [ ] Backward compatibility settings removed or verified

### 8. Performance Baseline

Establish baseline metrics:

- [ ] API response time measured (without LLM)
- [ ] LLM response time measured
- [ ] Concurrent request handling tested
- [ ] Memory usage monitored
- [ ] CPU usage monitored
- [ ] Acceptable performance limits defined

### 9. Cost Analysis

- [ ] Monthly estimated cost calculated
- [ ] Budget alert set at provider (if available)
- [ ] Rate limiting configured appropriately
- [ ] Max token limit set reasonably
- [ ] Cost monitoring dashboard set up

**Cost Calculation:**
```
Monthly API calls: _____ × Cost per call: $_____ = $ _____
Max monthly budget: $_____
Alert threshold: $_____
```

### 10. Documentation Review

- [ ] Team members aware of new system
- [ ] Documentation shared: `LLM_PROVIDER_GUIDE.md`
- [ ] Migration guide reviewed: `MIGRATION_GUIDE.md`
- [ ] Quick reference available: `QUICK_REFERENCE.md`
- [ ] Support contact identified
- [ ] Escalation procedure documented

## Production Deployment

### 1. Environment Setup

- [ ] Production `.env` file prepared (do not commit)
- [ ] Environment variables set in deployment platform
- [ ] Secrets manager integration (if applicable)
- [ ] Database credentials configured
- [ ] Redis connection configured
- [ ] All required services started

### 2. Docker Deployment (if applicable)

- [ ] Dockerfile reviewed
- [ ] Docker image builds successfully
- [ ] `requirements.txt` included in image
- [ ] `.env` NOT in docker image (use env vars)
- [ ] Docker container runs and starts app
- [ ] Logs accessible from container
- [ ] Health check working

```bash
# Test docker build
docker build -t multi-agent-ai .

# Test docker run
docker run -e LLM_PROVIDER=openai -e LLM_API_KEY=sk-... multi-agent-ai
```

- [ ] Docker build passes
- [ ] Container starts successfully

### 3. Kubernetes Deployment (if applicable)

- [ ] ConfigMap created for non-sensitive config
- [ ] Secret created for API keys
- [ ] Deployment manifest reviewed
- [ ] Resource limits set appropriately
- [ ] Readiness probes configured
- [ ] Liveness probes configured

```yaml
# Check these in your manifests:
- env:
  - name: LLM_PROVIDER
    valueFrom: configMapKeyRef
  - name: LLM_API_KEY
    valueFrom: secretKeyRef
```

- [ ] Manifests validated with `kubectl validate`
- [ ] Deployment succeeds
- [ ] Pods are healthy

### 4. Cloud Platform Deployment

**AWS:**
- [ ] EC2 instance configured
- [ ] Security group allows inbound traffic
- [ ] IAM roles configured (if using AWS services)
- [ ] CloudWatch monitoring enabled
- [ ] Application loads successfully

**Google Cloud:**
- [ ] Cloud Run service created
- [ ] Service account configured
- [ ] Environment variables set
- [ ] Cloud Monitoring enabled
- [ ] Application loads successfully

**Azure:**
- [ ] App Service created
- [ ] App Configuration Service setup
- [ ] Key Vault configured for secrets
- [ ] Application Insights enabled
- [ ] Application loads successfully

**Other:**
- [ ] Platform documentation reviewed
- [ ] Environment variables configured
- [ ] Secrets configured
- [ ] Monitoring enabled

### 5. Network & Connectivity

- [ ] Firewall allows outbound HTTPS (API calls)
- [ ] DNS resolution working
- [ ] API endpoint reachable from app
- [ ] Fallback network routes (if applicable)
- [ ] VPN configured (if needed)
- [ ] Proxy configured (if needed)
- [ ] SSL/TLS certificates valid

### 6. Monitoring & Logging

- [ ] Logs being collected
- [ ] Error tracking enabled (Sentry, etc.)
- [ ] Performance monitoring active
- [ ] Alerts configured for:
  - [ ] High error rates
  - [ ] High latency
  - [ ] API rate limits
  - [ ] Cost thresholds
- [ ] Dashboard created
- [ ] On-call rotation established

### 7. Backup & Recovery

- [ ] Database backups configured
- [ ] Vector DB backups configured
- [ ] Recovery procedures documented
- [ ] Recovery procedures tested
- [ ] Disaster recovery plan reviewed

### 8. Final Verification

```bash
# Test production deployment

# Health check
curl https://your-app.com/health

# Chat endpoint
curl -X POST https://your-app.com/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","session_id":"test"}'

# Check logs
# Verify no errors in logs
# Verify response times acceptable
# Verify cost reasonable
```

- [ ] Health check passes
- [ ] API endpoints responsive
- [ ] No errors in logs
- [ ] Response times acceptable
- [ ] Cost within budget

### 9. Documentation Updates

- [ ] Production runbook created
- [ ] Incident response procedure documented
- [ ] Rollback procedure documented
- [ ] Scaling procedure documented
- [ ] Team trained on procedures
- [ ] Contact information updated

### 10. Go-Live

- [ ] Stakeholders notified
- [ ] Users notified of changes (if applicable)
- [ ] Monitoring team on alert
- [ ] Support team ready
- [ ] Rollback plan ready
- [ ] Post-deployment review scheduled

## Post-Deployment (Week 1)

### Daily

- [ ] Monitor error rates (should be < 0.1%)
- [ ] Monitor API latency (should be stable)
- [ ] Monitor cost (should be within budget)
- [ ] Check logs for issues
- [ ] Verify backups running

### Weekly Review

- [ ] Performance review meeting
- [ ] Cost analysis
- [ ] User feedback review
- [ ] Incident review (if any)
- [ ] System optimization opportunities

### Optimization

- [ ] Adjust temperature if needed
- [ ] Optimize token usage
- [ ] Consider cheaper models if quality acceptable
- [ ] Implement caching if applicable
- [ ] Review rate limiting

## Rollback Procedure

If issues discovered after deployment:

1. [ ] Identify the issue
2. [ ] Save logs for analysis
3. [ ] Switch provider or model (if applicable)
   ```bash
   # Update .env
   LLM_PROVIDER=openai  # Or previous provider
   LLM_MODEL=gpt-3.5-turbo  # Or previous model
   # Redeploy
   ```
4. [ ] Restart application
5. [ ] Verify health
6. [ ] Notify team
7. [ ] Post-mortem scheduled

## Troubleshooting During Deployment

| Issue | Solution |
|-------|----------|
| "Module not found" | Run `pip install -r requirements.txt` |
| "Missing API key" | Check `.env` and environment variables |
| "Connection refused" | Check API endpoint URL, firewall, VPN |
| "Model not found" | Verify model name for your provider |
| "401 Unauthorized" | Check API key validity and permissions |
| "Rate limit exceeded" | Reduce requests or upgrade plan |
| "High latency" | Check network, try different model |
| "High cost" | Switch to cheaper model or provider |

## Success Criteria

✅ All checklist items completed  
✅ No errors in logs  
✅ API responds within 5 seconds  
✅ Uptime > 99%  
✅ Error rate < 0.1%  
✅ Cost within budget  
✅ Team ready for support  
✅ Monitoring active  

## Sign-Off

- [ ] Deployment Lead: _________________ Date: _______
- [ ] Platform Lead: _________________ Date: _______
- [ ] Security Lead: _________________ Date: _______
- [ ] Operations Lead: _________________ Date: _______

---

**Go-Live Approved**: ☐ YES ☐ NO

**Date**: _____________

**Notes**: _____________________________________________________________

