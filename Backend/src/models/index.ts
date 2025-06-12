import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// User Interface
export interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  password: string;
  plan: 'free' | 'basic' | 'premium' | 'enterprise';
  planLimits: {
    maxBots: number;
    maxConversations: number;
    maxMessages: number;
  };
  usage: {
    totalBots: number;
    totalConversations: number;
    totalMessages: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Bot Interface
export interface IBot extends Document {
  _id: string;
  userId: string;
  name: string;
  empresa: string;
  tom: string;
  instrucoes: string;
  whatsappNumber: string;
  instanceId?: string;
  status: 'inactive' | 'connecting' | 'connected' | 'error';
  qrCode?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Conversation Interface
export interface IConversation extends Document {
  _id: string;
  botId: string;
  userId: string;
  customerPhone: string;
  customerName?: string;
  messages: Array<{
    id: string;
    type: 'text' | 'image' | 'audio' | 'document';
    content: string;
    sender: 'customer' | 'bot';
    timestamp: Date;
    messageId?: string;
  }>;
  status: 'active' | 'closed';
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// WhatsApp Instance Interface
export interface IWhatsAppInstance extends Document {
  _id: string;
  botId: string;
  userId: string;
  instanceId: string;
  instanceName: string;
  status: 'disconnected' | 'connecting' | 'open' | 'closed';
  qrCode?: string;
  webhookUrl: string;
  apiKey: string;
  phoneNumber?: string;
  profileName?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// User Schema
const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  plan: {
    type: String,
    enum: ['free', 'basic', 'premium', 'enterprise'],
    default: 'free'
  },
  planLimits: {
    maxBots: { type: Number, default: 1 },
    maxConversations: { type: Number, default: 100 },
    maxMessages: { type: Number, default: 1000 }
  },
  usage: {
    totalBots: { type: Number, default: 0 },
    totalConversations: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Update plan limits based on plan
userSchema.pre('save', function(next) {
  switch (this.plan) {
    case 'free':
      this.planLimits = { maxBots: 1, maxConversations: 100, maxMessages: 1000 };
      break;
    case 'basic':
      this.planLimits = { maxBots: 5, maxConversations: 1000, maxMessages: 10000 };
      break;
    case 'premium':
      this.planLimits = { maxBots: 20, maxConversations: 5000, maxMessages: 50000 };
      break;
    case 'enterprise':
      this.planLimits = { maxBots: 100, maxConversations: 25000, maxMessages: 250000 };
      break;
  }
  next();
});

// Bot Schema
const botSchema = new Schema<IBot>({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    ref: 'User'
  },
  name: {
    type: String,
    required: [true, 'Bot name is required'],
    trim: true,
    maxlength: [100, 'Bot name cannot exceed 100 characters']
  },
  empresa: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [200, 'Company name cannot exceed 200 characters']
  },
  tom: {
    type: String,
    required: [true, 'Tone is required'],
    trim: true,
    maxlength: [500, 'Tone cannot exceed 500 characters']
  },
  instrucoes: {
    type: String,
    required: [true, 'Instructions are required'],
    trim: true,
    maxlength: [2000, 'Instructions cannot exceed 2000 characters']
  },
  whatsappNumber: {
    type: String,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
  },
  instanceId: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['inactive', 'connecting', 'connected', 'error'],
    default: 'inactive'
  },
  qrCode: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Conversation Schema
const conversationSchema = new Schema<IConversation>({
  botId: {
    type: String,
    required: [true, 'Bot ID is required'],
    ref: 'Bot'
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    ref: 'User'
  },
  customerPhone: {
    type: String,
    required: [true, 'Customer phone is required'],
    trim: true
  },
  customerName: {
    type: String,
    trim: true,
    maxlength: [100, 'Customer name cannot exceed 100 characters']
  },
  messages: [{
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'image', 'audio', 'document'],
      default: 'text'
    },
    content: { type: String, required: true },
    sender: {
      type: String,
      enum: ['customer', 'bot'],
      required: true
    },
    timestamp: { type: Date, default: Date.now },
    messageId: String
  }],
  status: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// WhatsApp Instance Schema
const whatsappInstanceSchema = new Schema<IWhatsAppInstance>({
  botId: {
    type: String,
    required: [true, 'Bot ID is required'],
    ref: 'Bot'
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    ref: 'User'
  },
  instanceId: {
    type: String,
    required: [true, 'Instance ID is required'],
    unique: true
  },
  instanceName: {
    type: String,
    required: [true, 'Instance name is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['disconnected', 'connecting', 'open', 'closed'],
    default: 'disconnected'
  },
  qrCode: String,
  webhookUrl: {
    type: String,
    required: [true, 'Webhook URL is required']
  },
  apiKey: {
    type: String,
    required: [true, 'API Key is required']
  },
  phoneNumber: String,
  profileName: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
userSchema.index({ email: 1 });
botSchema.index({ userId: 1 });
botSchema.index({ instanceId: 1 });
conversationSchema.index({ botId: 1, customerPhone: 1 });
conversationSchema.index({ userId: 1, createdAt: -1 });
whatsappInstanceSchema.index({ instanceId: 1 });
whatsappInstanceSchema.index({ botId: 1 });

// Export models
export const User = mongoose.model<IUser>('User', userSchema);
export const Bot = mongoose.model<IBot>('Bot', botSchema);
export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);
export const WhatsAppInstance = mongoose.model<IWhatsAppInstance>('WhatsAppInstance', whatsappInstanceSchema);