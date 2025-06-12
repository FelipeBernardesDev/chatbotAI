import axios from 'axios';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

export interface FlowiseMessageData {
  empresa: string;
  tom: string;
  instrucoes: string;
  input: string;
}

export class FlowiseService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly flowId: string;

  constructor() {
    this.baseUrl = process.env.FLOWISE_API_URL || 'http://flowise:3000';
    this.apiKey = process.env.FLOWISE_API_KEY || 'chatbot_saas_flowise_2024';
    this.flowId = process.env.FLOWISE_FLOW_ID || 'generic-chatbot-flow';
  }

  /**
   * Process message through Flowise AI with dynamic variables
   */
  async processMessage(data: FlowiseMessageData): Promise<string | null> {
    try {
      const { empresa, tom, instrucoes, input } = data;

      // Construct the dynamic prompt
      const systemPrompt = this.buildSystemPrompt(empresa, tom, instrucoes);
      
      logger.info(`Processing message for company: ${empresa}`);
      logger.debug('System prompt:', systemPrompt);
      logger.debug('User input:', input);

      // Send request to Flowise
      const response = await axios.post(
        `${this.baseUrl}/api/v1/prediction/${this.flowId}`,
        {
          question: input,
          overrideConfig: {
            systemMessage: systemPrompt,
            temperature: 0.7,
            maxTokens: 500
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 30000 // 30 second timeout
        }
      );

      if (response.data && response.data.text) {
        logger.info('AI response generated successfully');
        return response.data.text.trim();
      }

      logger.warn('No response text from Flowise');
      return this.getFallbackResponse();

    } catch (error) {
      logger.error('Flowise API error:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          logger.error('Flowise API response error:', {
            status: error.response.status,
            data: error.response.data
          });
        } else if (error.request) {
          logger.error('Flowise API request error:', error.request);
        }
      }

      return this.getFallbackResponse();
    }
  }

  /**
   * Build system prompt with dynamic variables
   */
  private buildSystemPrompt(empresa: string, tom: string, instrucoes: string): string {
    return `
Você é um assistente virtual inteligente da empresa "${empresa}".

PERSONALIDADE E TOM:
${tom}

INSTRUÇÕES ESPECÍFICAS:
${instrucoes}

DIRETRIZES GERAIS:
- Sempre mantenha o tom de voz definido acima
- Seja prestativo e profissional
- Responda de forma clara e objetiva
- Se não souber algo específico sobre a empresa, seja honesto mas mantenha o tom positivo
- Evite respostas muito longas, seja conciso
- Use linguagem natural e acessível
- Sempre finalize oferecendo ajuda adicional quando apropriado

Responda sempre como se você fosse parte da equipe da ${empresa}.
`.trim();
  }

  /**
   * Get fallback response when Flowise fails
   */
  private getFallbackResponse(): string {
    const fallbackResponses = [
      'Desculpe, estou com dificuldades técnicas no momento. Pode tentar novamente em alguns instantes?',
      'Olá! Tive um pequeno problema técnico. Poderia repetir sua mensagem, por favor?',
      'Estou passando por uma atualização rápida. Pode tentar enviar sua mensagem novamente?',
      'Desculpe a inconveniência, tive uma falha momentânea. Como posso ajudá-lo?'
    ];

    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  }

  /**
   * Test Flowise connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/flows`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 10000
      });

      return response.status === 200;
    } catch (error) {
      logger.error('Flowise connection test failed:', error);
      return false;
    }
  }

  /**
   * Create or update the generic flow
   */
  async setupGenericFlow(): Promise<boolean> {
    try {
      // Generic flow configuration
      const flowConfig = {
        "nodes": [
          {
            "id": "chatOpenAI_0",
            "position": { "x": 500, "y": 200 },
            "type": "customNode",
            "data": {
              "id": "chatOpenAI_0",
              "label": "ChatOpenAI",
              "name": "chatOpenAI",
              "type": "ChatOpenAI",
              "baseClasses": ["ChatOpenAI", "BaseChatModel"],
              "category": "Chat Models",
              "inputParams": [
                {
                  "id": "chatOpenAI_0-input-modelName-options",
                  "name": "modelName",
                  "label": "Model Name",
                  "type": "options",
                  "options": [
                    { "label": "gpt-3.5-turbo", "name": "gpt-3.5-turbo" },
                    { "label": "gpt-3.5-turbo-16k", "name": "gpt-3.5-turbo-16k" },
                    { "label": "gpt-4", "name": "gpt-4" },
                    { "label": "gpt-4-turbo-preview", "name": "gpt-4-turbo-preview" }
                  ],
                  "default": "gpt-3.5-turbo"
                },
                {
                  "id": "chatOpenAI_0-input-temperature-number",
                  "name": "temperature",
                  "label": "Temperature",
                  "type": "number",
                  "default": 0.7,
                  "step": 0.1
                },
                {
                  "id": "chatOpenAI_0-input-maxTokens-number",
                  "name": "maxTokens",
                  "label": "Max Tokens",
                  "type": "number",
                  "step": 1
                },
                {
                  "id": "chatOpenAI_0-input-openAIApiKey-password",
                  "name": "openAIApiKey",
                  "label": "OpenAI API Key",
                  "type": "password"
                }
              ],
              "inputs": {
                "modelName": "gpt-3.5-turbo",
                "temperature": "{{temperature}}",
                "maxTokens": "{{maxTokens}}",
                "openAIApiKey": process.env.OPENAI_API_KEY || ""
              }
            }
          },
          {
            "id": "conversationChain_0",
            "position": { "x": 800, "y": 200 },
            "type": "customNode",
            "data": {
              "id": "conversationChain_0",
              "label": "Conversation Chain",
              "name": "conversationChain",
              "type": "ConversationChain",
              "baseClasses": ["ConversationChain", "BaseChain"],
              "category": "Chains",
              "inputParams": [
                {
                  "id": "conversationChain_0-input-systemMessage-string",
                  "name": "systemMessage",
                  "label": "System Message",
                  "type": "string",
                  "rows": 4,
                  "placeholder": "You are a helpful assistant"
                }
              ],
              "inputs": {
                "model": "{{chatOpenAI_0.data.instance}}",
                "systemMessage": "{{systemMessage}}"
              }
            }
          }
        ],
        "edges": [
          {
            "source": "chatOpenAI_0",
            "sourceHandle": "chatOpenAI_0-output-chatOpenAI-ChatOpenAI|BaseChatModel",
            "target": "conversationChain_0",
            "targetHandle": "conversationChain_0-input-model-BaseChatModel",
            "type": "buttonedge",
            "id": "chatOpenAI_0-chatOpenAI_0-output-chatOpenAI-ChatOpenAI|BaseChatModel-conversationChain_0-conversationChain_0-input-model-BaseChatModel"
          }
        ]
      };

      const response = await axios.post(
        `${this.baseUrl}/api/v1/flows`,
        {
          name: 'Generic Chatbot Flow',
          flowData: JSON.stringify(flowConfig)
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      if (response.status === 201) {
        logger.info('Generic flow created successfully');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error setting up generic flow:', error);
      return false;
    }
  }
}