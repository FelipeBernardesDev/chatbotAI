import axios from 'axios';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

export interface InstanceConfig {
  instanceName: string;
  token?: string;
  qrcode?: boolean;
  number?: string;
  webhookUrl?: string;
  webhookByEvents?: boolean;
  webhookBase64?: boolean;
  events?: string[];
}

export interface MessageData {
  number: string;
  text: string;
  delay?: number;
}

export class EvolutionAPIService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
    this.apiKey = process.env.EVOLUTION_API_KEY || 'evo-chatbot-saas-2024';
  }

  /**
   * Create a new WhatsApp instance
   */
  async createInstance(instanceName: string, webhookUrl: string): Promise<any> {
    try {
      const config: InstanceConfig = {
        instanceName,
        qrcode: true,
        webhookUrl,
        webhookByEvents: true,
        webhookBase64: false,
        events: [
          'APPLICATION_STARTUP',
          'QRCODE_UPDATED',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'MESSAGES_DELETE',
          'SEND_MESSAGE',
          'CONTACTS_UPDATE',
          'CONTACTS_UPSERT',
          'PRESENCE_UPDATE',
          'CHATS_UPDATE',
          'CHATS_UPSERT',
          'CHATS_DELETE',
          'GROUPS_UPSERT',
          'GROUP_UPDATE',
          'GROUP_PARTICIPANTS_UPDATE',
          'CONNECTION_UPDATE',
          'LABELS_EDIT',
          'LABELS_ASSOCIATION',
          'CALL_UPSERT'
        ]
      };

      logger.info(`Creating Evolution API instance: ${instanceName}`);

      const response = await axios.post(
        `${this.baseUrl}/instance/create`,
        config,
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.apiKey
          },
          timeout: 30000
        }
      );

      if (response.data) {
        logger.info(`Instance ${instanceName} created successfully`);
        return response.data;
      }

      throw new Error('No response data from Evolution API');

    } catch (error) {
      logger.error(`Error creating instance ${instanceName}:`, error);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          logger.error('Evolution API response error:', {
            status: error.response.status,
            data: error.response.data
          });
        }
      }

      throw error;
    }
  }

  /**
   * Get instance connection status
   */
  async getInstanceStatus(instanceName: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/instance/connectionState/${instanceName}`,
        {
          headers: {
            'apikey': this.apiKey
          },
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      logger.error(`Error getting status for instance ${instanceName}:`, error);
      throw error;
    }
  }

  /**
   * Get QR Code for instance
   */
  async getQRCode(instanceName: string): Promise<string | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/instance/connect/${instanceName}`,
        {
          headers: {
            'apikey': this.apiKey
          },
          timeout: 10000
        }
      );

      if (response.data && response.data.base64) {
        return response.data.base64;
      }

      return null;
    } catch (error) {
      logger.error(`Error getting QR code for instance ${instanceName}:`, error);
      return null;
    }
  }

  /**
   * Send text message
   */
  async sendMessage(instanceName: string, phoneNumber: string, message: string): Promise<boolean> {
    try {
      // Ensure phone number is in correct format
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      const messageData: MessageData = {
        number: formattedNumber,
        text: message,
        delay: 1000 // 1 second delay to appear more natural
      };

      logger.info(`Sending message to ${formattedNumber} via instance ${instanceName}`);

      const response = await axios.post(
        `${this.baseUrl}/message/sendText/${instanceName}`,
        messageData,
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.apiKey
          },
          timeout: 15000
        }
      );

      if (response.status === 200 || response.status === 201) {
        logger.info(`Message sent successfully to ${formattedNumber}`);
        return true;
      }

      logger.warn(`Unexpected response status: ${response.status}`);
      return false;

    } catch (error) {
      logger.error(`Error sending message to ${phoneNumber}:`, error);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          logger.error('Send message response error:', {
            status: error.response.status,
            data: error.response.data
          });
        }
      }

      return false;
    }
  }

  /**
   * Delete instance
   */
  async deleteInstance(instanceName: string): Promise<boolean> {
    try {
      const response = await axios.delete(
        `${this.baseUrl}/instance/delete/${instanceName}`,
        {
          headers: {
            'apikey': this.apiKey
          },
          timeout: 10000
        }
      );

      if (response.status === 200) {
        logger.info(`Instance ${instanceName} deleted successfully`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error deleting instance ${instanceName}:`, error);
      return false;
    }
  }

  /**
   * Logout instance (disconnect WhatsApp)
   */
  async logoutInstance(instanceName: string): Promise<boolean> {
    try {
      const response = await axios.delete(
        `${this.baseUrl}/instance/logout/${instanceName}`,
        {
          headers: {
            'apikey': this.apiKey
          },
          timeout: 10000
        }
      );

      if (response.status === 200) {
        logger.info(`Instance ${instanceName} logged out successfully`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error logging out instance ${instanceName}:`, error);
      return false;
    }
  }

  /**
   * Restart instance
   */
  async restartInstance(instanceName: string): Promise<boolean> {
    try {
      const response = await axios.put(
        `${this.baseUrl}/instance/restart/${instanceName}`,
        {},
        {
          headers: {
            'apikey': this.apiKey
          },
          timeout: 15000
        }
      );

      if (response.status === 200) {
        logger.info(`Instance ${instanceName} restarted successfully`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error restarting instance ${instanceName}:`, error);
      return false;
    }
  }

  /**
   * Set webhook for instance
   */
  async setWebhook(instanceName: string, webhookUrl: string): Promise<boolean> {
    try {
      const webhookConfig = {
        url: webhookUrl,
        enabled: true,
        events: [
          'APPLICATION_STARTUP',
          'QRCODE_UPDATED',
          'MESSAGES_UPSERT',
          'CONNECTION_UPDATE'
        ]
      };

      const response = await axios.post(
        `${this.baseUrl}/webhook/set/${instanceName}`,
        webhookConfig,
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.apiKey
          },
          timeout: 10000
        }
      );

      if (response.status === 200 || response.status === 201) {
        logger.info(`Webhook set successfully for instance ${instanceName}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error setting webhook for instance ${instanceName}:`, error);
      return false;
    }
  }

  /**
   * Get all instances
   */
  async getAllInstances(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/instance/fetchInstances`,
        {
          headers: {
            'apikey': this.apiKey
          },
          timeout: 10000
        }
      );

      return response.data || [];
    } catch (error) {
      logger.error('Error fetching all instances:', error);
      return [];
    }
  }

  /**
   * Test Evolution API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/instance/fetchInstances`,
        {
          headers: {
            'apikey': this.apiKey
          },
          timeout: 5000
        }
      );

      return response.status === 200;
    } catch (error) {
      logger.error('Evolution API connection test failed:', error);
      return false;
    }
  }

  /**
   * Format phone number for WhatsApp
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let formatted = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing (assuming Brazil +55 as default)
    if (formatted.length === 11 && formatted.startsWith('11')) {
      formatted = '55' + formatted;
    } else if (formatted.length === 10) {
      formatted = '5511' + formatted;
    } else if (!formatted.startsWith('55') && formatted.length < 13) {
      formatted = '55' + formatted;
    }

    return formatted;
  }

  /**
   * Generate unique instance name
   */
  generateInstanceName(userId: string, botId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `bot-${userId}-${botId}-${timestamp}-${random}`;
  }
}