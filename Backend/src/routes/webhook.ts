import express from 'express';
import { Bot, Conversation, User } from '../models';
import { FlowiseService } from '../services/flowiseService';
import { EvolutionAPIService } from '../services/evolutionApiService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// WhatsApp Webhook Handler
router.post('/whatsapp/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const webhookData = req.body;

    logger.info(`Webhook received for instance ${instanceId}:`, JSON.stringify(webhookData, null, 2));

    // Validate webhook data
    if (!webhookData || !webhookData.data) {
      logger.warn('Invalid webhook data received');
      return res.status(400).json({ error: 'Invalid webhook data' });
    }

    const { event, data } = webhookData;

    // Handle different webhook events
    switch (event) {
      case 'messages.upsert':
        await handleIncomingMessage(instanceId, data);
        break;
      
      case 'connection.update':
        await handleConnectionUpdate(instanceId, data);
        break;
      
      case 'qrcode.updated':
        await handleQRCodeUpdate(instanceId, data);
        break;
      
      default:
        logger.info(`Unhandled webhook event: ${event}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle incoming WhatsApp messages
async function handleIncomingMessage(instanceId: string, messageData: any) {
  try {
    if (!messageData?.messages || messageData.messages.length === 0) {
      return;
    }

    const message = messageData.messages[0];
    
    // Skip if message is from bot itself
    if (message.key?.fromMe) {
      return;
    }

    // Extract customer phone number (remove WhatsApp suffix)
    const customerPhone = message.key?.remoteJid?.replace('@s.whatsapp.net', '');
    if (!customerPhone) {
      logger.warn('No customer phone found in message');
      return;
    }

    // Find bot by instance ID
    const bot = await Bot.findOne({ instanceId, isActive: true });
    if (!bot) {
      logger.warn(`No active bot found for instance ${instanceId}`);
      return;
    }

    // Get or create conversation
    let conversation = await Conversation.findOne({
      botId: bot._id,
      customerPhone,
      status: 'active'
    });

    if (!conversation) {
      conversation = new Conversation({
        botId: bot._id,
        userId: bot.userId,
        customerPhone,
        customerName: message.pushName || customerPhone,
        messages: [],
        status: 'active',
        lastMessageAt: new Date()
      });
    }

    // Extract message content
    const messageContent = extractMessageContent(message);
    if (!messageContent) {
      logger.warn('No message content found');
      return;
    }

    // Add customer message to conversation
    const customerMessage = {
      id: uuidv4(),
      type: 'text',
      content: messageContent,
      sender: 'customer' as const,
      timestamp: new Date(),
      messageId: message.key?.id
    };
    
    conversation.messages.push(customerMessage);
    conversation.lastMessageAt = new Date();

    // Get AI response from Flowise
    const flowiseService = new FlowiseService();
    const aiResponse = await flowiseService.processMessage({
      empresa: bot.empresa,
      tom: bot.tom,
      instrucoes: bot.instrucoes,
      input: messageContent
    });

    if (aiResponse) {
      // Add bot response to conversation
      const botMessage = {
        id: uuidv4(),
        type: 'text' as const,
        content: aiResponse,
        sender: 'bot' as const,
        timestamp: new Date()
      };
      
      conversation.messages.push(botMessage);

      // Send response via WhatsApp
      const evolutionService = new EvolutionAPIService();
      await evolutionService.sendMessage(instanceId, customerPhone, aiResponse);

      // Update user message usage
      await User.findByIdAndUpdate(bot.userId, {
        $inc: { 'usage.totalMessages': 2 } // Customer message + bot response
      });
    }

    // Save conversation
    await conversation.save();

  } catch (error) {
    logger.error('Error handling incoming message:', error);
  }
}

// Handle connection status updates
async function handleConnectionUpdate(instanceId: string, connectionData: any) {
  try {
    const { state, lastDisconnect } = connectionData;
    
    logger.info(`Connection update for ${instanceId}:`, { state, lastDisconnect });

    // Update bot status based on connection state
    const status = mapConnectionStateToStatus(state);
    
    await Bot.findOneAndUpdate(
      { instanceId },
      { 
        status,
        ...(state === 'open' && { qrCode: null }) // Clear QR code when connected
      }
    );

    logger.info(`Bot ${instanceId} status updated to: ${status}`);
    
  } catch (error) {
    logger.error('Error handling connection update:', error);
  }
}

// Handle QR code updates
async function handleQRCodeUpdate(instanceId: string, qrData: any) {
  try {
    const { qrcode } = qrData;
    
    if (qrcode) {
      await Bot.findOneAndUpdate(
        { instanceId },
        { 
          qrCode: qrcode,
          status: 'connecting'
        }
      );
      
      logger.info(`QR Code updated for instance ${instanceId}`);
    }
    
  } catch (error) {
    logger.error('Error handling QR code update:', error);
  }
}

// Extract message content from WhatsApp message object
function extractMessageContent(message: any): string | null {
  try {
    if (message.message?.conversation) {
      return message.message.conversation;
    }
    
    if (message.message?.extendedTextMessage?.text) {
      return message.message.extendedTextMessage.text;
    }
    
    if (message.message?.imageMessage?.caption) {
      return `[Image] ${message.message.imageMessage.caption}`;
    }
    
    if (message.message?.videoMessage?.caption) {
      return `[Video] ${message.message.videoMessage.caption}`;
    }
    
    if (message.message?.documentMessage?.caption) {
      return `[Document] ${message.message.documentMessage.caption}`;
    }
    
    if (message.message?.audioMessage) {
      return '[Audio Message]';
    }
    
    if (message.message?.stickerMessage) {
      return '[Sticker]';
    }
    
    return null;
  } catch (error) {
    logger.error('Error extracting message content:', error);
    return null;
  }
}

// Map Evolution API connection states to our bot statuses
function mapConnectionStateToStatus(state: string): string {
  switch (state) {
    case 'open':
      return 'connected';
    case 'connecting':
      return 'connecting';
    case 'close':
    case 'closed':
      return 'inactive';
    default:
      return 'error';
  }
}

// Health check for webhooks
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Webhook Handler',
    timestamp: new Date().toISOString()
  });
});

// Webhook verification (for some WhatsApp providers)
router.get('/whatsapp/:instanceId', (req, res) => {
  const { instanceId } = req.params;
  const challenge = req.query['hub.challenge'];
  
  if (challenge) {
    logger.info(`Webhook verification for instance ${instanceId}`);
    res.status(200).send(challenge);
  } else {
    res.status(400).json({ error: 'Missing challenge parameter' });
  }
});

export default router;