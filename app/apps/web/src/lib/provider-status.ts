export function providerKeyError(provider: string, key: string | null): string | null {
  if (provider === "bailian" && !key) {
    return "阿里云百炼 API 密钥未配置。请前往设置 → API 保存密钥。";
  }
  if (provider === "openrouter" && !key) {
    return "OpenRouter API key not configured. Set one in Settings.";
  }
  return null;
}
