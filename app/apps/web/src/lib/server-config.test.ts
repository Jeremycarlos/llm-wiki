import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@llm-wiki/core", () => ({
  deleteApiKey: vi.fn(),
  deleteBailianApiKey: vi.fn(),
  getApiKey: vi.fn(),
  getBailianApiKey: vi.fn(),
  isKeychainAvailable: vi.fn(),
  loadGlobalConfig: vi.fn(),
  setApiKey: vi.fn(),
  setBailianApiKey: vi.fn(),
}));

import { getBailianApiKey } from "@llm-wiki/core";
import { getBailianApiKeyStatus } from "./server-config";

beforeEach(() => vi.clearAllMocks());

describe("百炼密钥状态响应", () => {
  it("只暴露来源与末四位，不返回原密钥", async () => {
    vi.mocked(getBailianApiKey).mockResolvedValue({
      key: "secret-key-1234",
      source: "keychain",
      keychainAvailable: true,
    });
    const status = await getBailianApiKeyStatus();
    expect(status).toEqual({
      configured: true,
      source: "keychain",
      keychainAvailable: true,
      hint: "1234",
    });
    expect(status).not.toHaveProperty("key");
  });

  it("密钥长度不超过四位时不回传可还原的提示", async () => {
    vi.mocked(getBailianApiKey).mockResolvedValue({
      key: "1234",
      source: "env",
      keychainAvailable: false,
    });
    expect(await getBailianApiKeyStatus()).toMatchObject({ configured: true, hint: null });
  });
});
