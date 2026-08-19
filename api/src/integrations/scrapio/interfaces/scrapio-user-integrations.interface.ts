import { ScrapioListQuery } from './scrapio-common.interface';

/** AI providers a Scrapio user integration can connect to. */
export type ScrapioIntegrationType =
  | 'OPENAI'
  | 'ANTHROPIC'
  | 'GEMINI'
  | 'DEEPSEEK';

export type ScrapioIntegrationModelValue =
  | 'CLAUDE_OPUS_4_8'
  | 'CLAUDE_SONNET_4_6'
  | 'COMPUTER_USE_PREVIEW'
  | 'GPT_4O'
  | 'GPT_4O_MINI'
  | 'GPT_4_TURBO'
  | 'GPT_4'
  | 'GPT_35_TURBO'
  | 'GEMINI_2_5_PRO'
  | 'GEMINI_2_5_FLASH'
  | 'GEMINI_2_0_FLASH'
  | 'GEMINI_1_5_PRO'
  | 'GEMINI_1_5_FLASH'
  | 'DEEPSEEK_CHAT'
  | 'DEEPSEEK_REASONER';

export interface UserIntegration {
  id: string;
  user_id: string;
  integration_type: ScrapioIntegrationType;
  /** Configured computer-use model, if applicable. */
  computer_use_model: ScrapioIntegrationModelValue | null;
  /** Configured AI model, if applicable. */
  ai_model: ScrapioIntegrationModelValue | null;
  /** Masked API key. The raw credential is never returned after it is stored. */
  api_key_masked: string;
  is_active: boolean;
  is_default: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectUserIntegrationDto {
  integration_type: ScrapioIntegrationType;
  api_key: string;
  /** Required if the integration type supports computer use. */
  computer_use_model?: ScrapioIntegrationModelValue;
  /** Required if the integration type supports AI models. */
  ai_model?: ScrapioIntegrationModelValue;
  /** Only allowed for AI integrations with an ai_model set. If omitted, becomes the default automatically when the user has no other default AI integration. */
  is_default?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateUserIntegrationDto {
  /** Replace the stored API key credential. Omit to keep the current one. */
  api_key?: string;
  computer_use_model?: ScrapioIntegrationModelValue;
  ai_model?: ScrapioIntegrationModelValue;
  is_active?: boolean;
  /** Requires an ai_model to be set. */
  is_default?: boolean;
  metadata?: Record<string, any>;
}

export interface ListUserIntegrationsQuery extends ScrapioListQuery {
  /** ADMIN, SUPER_ADMIN, SUPPORT only — ignored for other roles. */
  user_id?: string;
  is_active?: 'true' | 'false';
  integration_type?: ScrapioIntegrationType;
}
