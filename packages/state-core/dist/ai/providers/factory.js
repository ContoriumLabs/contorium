"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOpenAIProvider = createOpenAIProvider;
exports.createAnthropicProvider = createAnthropicProvider;
exports.createOllamaProvider = createOllamaProvider;
exports.createOpenRouterProvider = createOpenRouterProvider;
exports.createGeminiProvider = createGeminiProvider;
exports.providerLabel = providerLabel;
async function postJson(url, headers, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 400)}`);
    }
    return (await res.json());
}
function createOpenAIProvider(opts) {
    const base = (opts.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    return {
        id: 'openai',
        async generate(prompt, options) {
            const started = Date.now();
            const model = options?.model ?? opts.model;
            const data = await postJson(`${base}/chat/completions`, {
                Authorization: `Bearer ${opts.apiKey}`,
            }, {
                model,
                temperature: options?.temperature ?? opts.defaultTemperature,
                max_tokens: options?.max_tokens ?? opts.defaultMaxTokens,
                messages: [
                    ...(options?.system ? [{ role: 'system', content: options.system }] : []),
                    { role: 'user', content: prompt },
                ],
            });
            const text = data.choices?.[0]?.message?.content?.trim() ?? '';
            return {
                text,
                model: data.model ?? model,
                provider: 'openai',
                usage: data.usage,
                latency_ms: Date.now() - started,
            };
        },
        async testConnection() {
            const started = Date.now();
            try {
                await this.generate('Reply with exactly: OK', { max_tokens: 8 });
                return { ok: true, latency_ms: Date.now() - started, message: 'Connection OK' };
            }
            catch (err) {
                return {
                    ok: false,
                    latency_ms: Date.now() - started,
                    message: err instanceof Error ? err.message : String(err),
                };
            }
        },
    };
}
function createAnthropicProvider(opts) {
    const base = (opts.baseUrl ?? 'https://api.anthropic.com/v1').replace(/\/$/, '');
    return {
        id: 'anthropic',
        async generate(prompt, options) {
            const started = Date.now();
            const model = options?.model ?? opts.model;
            const data = await postJson(`${base}/messages`, {
                'x-api-key': opts.apiKey,
                'anthropic-version': '2023-06-01',
            }, {
                model,
                max_tokens: options?.max_tokens ?? opts.defaultMaxTokens,
                temperature: options?.temperature ?? opts.defaultTemperature,
                system: options?.system,
                messages: [{ role: 'user', content: prompt }],
            });
            const text = data.content?.find((c) => c.type === 'text')?.text?.trim() ??
                data.content?.[0]?.text?.trim() ??
                '';
            return {
                text,
                model: data.model ?? model,
                provider: 'anthropic',
                usage: {
                    prompt_tokens: data.usage?.input_tokens,
                    completion_tokens: data.usage?.output_tokens,
                    total_tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
                },
                latency_ms: Date.now() - started,
            };
        },
        async testConnection() {
            const started = Date.now();
            try {
                await this.generate('Reply with exactly: OK', { max_tokens: 8 });
                return { ok: true, latency_ms: Date.now() - started, message: 'Connection OK' };
            }
            catch (err) {
                return {
                    ok: false,
                    latency_ms: Date.now() - started,
                    message: err instanceof Error ? err.message : String(err),
                };
            }
        },
    };
}
function createOllamaProvider(opts) {
    const base = (opts.baseUrl ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
    return {
        id: 'ollama',
        async generate(prompt, options) {
            const started = Date.now();
            const model = options?.model ?? opts.model;
            const data = await postJson(`${base}/api/chat`, {}, {
                model,
                stream: false,
                messages: [
                    ...(options?.system ? [{ role: 'system', content: options.system }] : []),
                    { role: 'user', content: prompt },
                ],
                options: { temperature: options?.temperature ?? opts.defaultTemperature },
            });
            const text = data.message?.content?.trim() ?? '';
            return {
                text,
                model: data.model ?? model,
                provider: 'ollama',
                latency_ms: Date.now() - started,
            };
        },
        async testConnection() {
            const started = Date.now();
            try {
                await this.generate('Reply with exactly: OK', { max_tokens: 8 });
                return { ok: true, latency_ms: Date.now() - started, message: 'Connection OK' };
            }
            catch (err) {
                return {
                    ok: false,
                    latency_ms: Date.now() - started,
                    message: err instanceof Error ? err.message : String(err),
                };
            }
        },
    };
}
/** OpenRouter uses OpenAI-compatible chat completions API. */
function createOpenRouterProvider(opts) {
    const inner = createOpenAIProvider({
        ...opts,
        baseUrl: 'https://openrouter.ai/api/v1',
    });
    return {
        id: 'open_router',
        generate: (prompt, options) => inner.generate(prompt, options),
        testConnection: () => inner.testConnection(),
    };
}
function createGeminiProvider(opts) {
    const base = (opts.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
    return {
        id: 'gemini',
        async generate(prompt, options) {
            const started = Date.now();
            const model = options?.model ?? opts.model;
            const pathModel = encodeURIComponent(model);
            const url = `${base}/models/${pathModel}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
            const body = {
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: options?.temperature ?? opts.defaultTemperature,
                    maxOutputTokens: options?.max_tokens ?? opts.defaultMaxTokens,
                },
            };
            if (options?.system?.trim()) {
                body.systemInstruction = { parts: [{ text: options.system.trim() }] };
            }
            const data = await postJson(url, {}, body);
            const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';
            return {
                text,
                model,
                provider: 'gemini',
                usage: {
                    prompt_tokens: data.usageMetadata?.promptTokenCount,
                    completion_tokens: data.usageMetadata?.candidatesTokenCount,
                    total_tokens: data.usageMetadata?.totalTokenCount,
                },
                latency_ms: Date.now() - started,
            };
        },
        async testConnection() {
            const started = Date.now();
            try {
                await this.generate('Reply with exactly: OK', { max_tokens: 8 });
                return { ok: true, latency_ms: Date.now() - started, message: 'Connection OK' };
            }
            catch (err) {
                return {
                    ok: false,
                    latency_ms: Date.now() - started,
                    message: err instanceof Error ? err.message : String(err),
                };
            }
        },
    };
}
function providerLabel(id) {
    switch (id) {
        case 'openai':
            return 'OpenAI';
        case 'anthropic':
            return 'Anthropic';
        case 'gemini':
            return 'Gemini';
        case 'open_router':
            return 'OpenRouter';
        case 'ollama':
            return 'Ollama';
        case 'deepseek':
            return 'DeepSeek';
        default:
            return id;
    }
}
