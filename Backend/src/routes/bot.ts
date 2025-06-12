import express from 'express';
import { Bot, User, WhatsAppInstance } from '../models';
import { EvolutionAPIService } from '../services/evolutionApiService';
import { logger } from '../utils/logger';
import { validateBotCreation, validateBotUpdate } from '../validators/botValidator';
import { AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all bots for authenticated user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    
    const bots = await Bot.find({ userId, isActive: true })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: bots
    });
  } catch (error) {
    logger.error('Error fetching bots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bots'
    });
  }
});

// Get single bot by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const bot = await Bot.findOne({ _id: id, userId, isActive: true });
    
    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }

    res.json({
      success: true,
      data: bot
    });
  } catch (error) {
    logger.error('Error fetching bot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bot'
    });
  }
});

// Create new bot
router.post('/', validateBotCreation, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { name, empresa, tom, instrucoes } = req.body;

    // Check user limits
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if user has reached bot limit
    const currentBotCount = await Bot.countDocuments({ userId, isActive: true });
    if (currentBotCount >= user.planLimits.maxBots) {
      return res.status(400).json({
        success: false,
        error: `You have reached your plan limit of ${user.planLimits.maxBots} bots. Please upgrade your plan.`
      });
    }

    // Create new bot
    const bot = new Bot({
      userId,
      name,
      empresa,
      tom,
      instrucoes,
      status: 'inactive'
    });

    await bot.save();

    // Update user bot count
    await User.findByIdAndUpdate(userId, {
      $inc: { 'usage.totalBots': 1 }
    });

    logger.info(`Bot created successfully: ${bot._id} for user: ${userId}`);

    res.status(201).json({
      success: true,
      data: bot,
      message: 'Bot created successfully'
    });
  }